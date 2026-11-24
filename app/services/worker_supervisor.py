import asyncio
import logging
import uuid
from typing import Any, Callable, Coroutine
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import SessionLocal
from app.services.durable_inbox import (
    claim_inbox_batch,
    claim_outbox_batch,
    dispatch_outbox_batch,
    get_queue_metrics,
    process_inbox_job_atomically,
)

logger = logging.getLogger(__name__)


class WorkerSupervisor:
    """Supervises persistent, isolated background workers for durable inbox and transactional outbox.

    Features:
    - Bounded concurrency with independent polling loops.
    - PostgreSQL row-level claim fencing via SELECT ... FOR UPDATE SKIP LOCKED.
    - Graceful shutdown draining in-flight jobs without dropping messages.
    - Real-time observability: queue depth, in-flight jobs, throughput metrics.
    """

    def __init__(
        self,
        concurrency: int | None = None,
        batch_size: int | None = None,
        poll_interval: float | None = None,
        lease_seconds: int = 60,
        shutdown_timeout: float = 10.0,
    ) -> None:
        self.concurrency = concurrency or settings.worker_concurrency
        self.batch_size = batch_size or settings.worker_batch_size
        self.poll_interval = poll_interval or settings.worker_poll_interval_seconds
        self.lease_seconds = lease_seconds
        self.shutdown_timeout = shutdown_timeout

        self.is_running: bool = False
        self.stop_event: asyncio.Event = asyncio.Event()
        self.worker_tasks: list[asyncio.Task] = []

        self.active_inbox_jobs: set[int] = set()
        self.active_outbox_jobs: set[int] = set()

        self.metrics: dict[str, int] = {
            "inbox_claimed": 0,
            "inbox_processed": 0,
            "inbox_failed": 0,
            "outbox_dispatched": 0,
            "outbox_failed": 0,
        }

    async def start(self) -> None:
        """Start persistent background workers if not already running."""
        if self.is_running:
            logger.warning("WorkerSupervisor is already running.")
            return

        self.is_running = True
        self.stop_event.clear()
        self.worker_tasks.clear()

        # Launch inbox workers
        for i in range(self.concurrency):
            task = asyncio.create_task(
                self._inbox_worker_loop(worker_idx=i),
                name=f"inbox_worker_{i}",
            )
            self.worker_tasks.append(task)

        # Launch outbox workers
        for i in range(max(1, self.concurrency // 2)):
            task = asyncio.create_task(
                self._outbox_worker_loop(worker_idx=i),
                name=f"outbox_worker_{i}",
            )
            self.worker_tasks.append(task)

        logger.info(
            "WorkerSupervisor started with %s inbox workers, %s outbox workers (batch_size=%s, poll_interval=%ss).",
            self.concurrency,
            max(1, self.concurrency // 2),
            self.batch_size,
            self.poll_interval,
        )

    async def stop(self, timeout: float | None = None) -> None:
        """Gracefully stop all persistent workers, allowing in-flight jobs to finish."""
        if not self.is_running:
            return

        effective_timeout = timeout or self.shutdown_timeout
        logger.info(
            "Stopping WorkerSupervisor gracefully (waiting up to %ss for in-flight jobs: inbox=%s, outbox=%s)...",
            effective_timeout,
            len(self.active_inbox_jobs),
            len(self.active_outbox_jobs),
        )

        self.stop_event.set()

        if self.worker_tasks:
            try:
                await asyncio.wait_for(
                    asyncio.gather(*self.worker_tasks, return_exceptions=True),
                    timeout=effective_timeout,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    "WorkerSupervisor graceful shutdown timed out after %ss. Cancelling remaining tasks.",
                    effective_timeout,
                )
                for t in self.worker_tasks:
                    if not t.done():
                        t.cancel()
                await asyncio.gather(*self.worker_tasks, return_exceptions=True)

        self.worker_tasks.clear()
        self.is_running = False
        logger.info("WorkerSupervisor stopped.")

    async def _inbox_worker_loop(self, worker_idx: int) -> None:
        """Dedicated loop claiming and processing batches from telegram_inbox."""
        worker_id = f"inbox_w_{worker_idx}_{uuid.uuid4().hex[:6]}"
        from app.api.webhooks import execute_update_payload

        while not self.stop_event.is_set():
            try:
                claimed_items = []
                async with SessionLocal() as db:
                    claimed_items = await claim_inbox_batch(
                        db,
                        batch_size=self.batch_size,
                        lease_seconds=self.lease_seconds,
                        worker_id=worker_id,
                    )

                if not claimed_items:
                    try:
                        await asyncio.wait_for(self.stop_event.wait(), timeout=self.poll_interval)
                    except asyncio.TimeoutError:
                        pass
                    continue

                self.metrics["inbox_claimed"] += len(claimed_items)

                for item in claimed_items:
                    if self.stop_event.is_set():
                        break

                    inbox_id, lease_token, payload, attempts, org_id, fencing_gen = item
                    self.active_inbox_jobs.add(inbox_id)
                    try:
                        async with SessionLocal() as db:
                            success = await process_inbox_job_atomically(
                                db,
                                inbox_id=inbox_id,
                                lease_token=lease_token,
                                fencing_generation=fencing_gen,
                                business_func=execute_update_payload,
                            )
                            if success:
                                self.metrics["inbox_processed"] += 1
                            else:
                                self.metrics["inbox_failed"] += 1
                    except Exception as e:
                        self.metrics["inbox_failed"] += 1
                        logger.exception("Unexpected error processing inbox item %s: %s", inbox_id, e)
                    finally:
                        self.active_inbox_jobs.discard(inbox_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Exception in inbox worker loop (%s): %s", worker_id, e)
                try:
                    await asyncio.wait_for(self.stop_event.wait(), timeout=min(5.0, self.poll_interval * 2))
                except asyncio.TimeoutError:
                    pass

    async def _outbox_worker_loop(self, worker_idx: int) -> None:
        """Dedicated loop claiming and dispatching batches from telegram_outbox outside locks."""
        worker_id = f"outbox_w_{worker_idx}_{uuid.uuid4().hex[:6]}"

        while not self.stop_event.is_set():
            try:
                dispatched_count = 0
                async with SessionLocal() as db:
                    dispatched_count = await dispatch_outbox_batch(
                        db,
                        batch_size=self.batch_size,
                        worker_id=worker_id,
                    )

                if dispatched_count == 0:
                    try:
                        await asyncio.wait_for(self.stop_event.wait(), timeout=self.poll_interval)
                    except asyncio.TimeoutError:
                        pass
                    continue

                self.metrics["outbox_dispatched"] += dispatched_count

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.metrics["outbox_failed"] += 1
                logger.error("Exception in outbox worker loop (%s): %s", worker_id, e)
                try:
                    await asyncio.wait_for(self.stop_event.wait(), timeout=min(5.0, self.poll_interval * 2))
                except asyncio.TimeoutError:
                    pass

    async def get_diagnostics(self) -> dict[str, Any]:
        """Collect current supervisor state and underlying PostgreSQL queue metrics."""
        async with SessionLocal() as db:
            queue_metrics = await get_queue_metrics(db)

        return {
            "is_running": self.is_running,
            "concurrency": self.concurrency,
            "batch_size": self.batch_size,
            "poll_interval": self.poll_interval,
            "active_inbox_jobs": list(self.active_inbox_jobs),
            "active_outbox_jobs": list(self.active_outbox_jobs),
            "supervisor_metrics": dict(self.metrics),
            "queue_metrics": queue_metrics,
        }


# Singleton supervisor instance
worker_supervisor = WorkerSupervisor()


async def run_inbox_worker_once(
    batch_size: int = 10,
    lease_seconds: int = 60,
    worker_id: str | None = None,
    bot_id: str | None = None,
    business_func: Callable[[dict, AsyncSession, int | None], Coroutine[Any, Any, None]] | None = None,
) -> int:
    """Execute a single atomic claim-and-process iteration for inbox items.

    Returns:
        Number of items successfully processed.
    """
    from app.api.webhooks import execute_update_payload
    func = business_func or execute_update_payload
    worker = worker_id or f"single_inbox_w_{uuid.uuid4().hex[:6]}"

    async with SessionLocal() as db:
        claimed = await claim_inbox_batch(
            db,
            batch_size=batch_size,
            lease_seconds=lease_seconds,
            worker_id=worker,
            bot_id=bot_id,
        )

    if not claimed:
        return 0

    processed = 0
    for inbox_id, lease_token, payload, attempts, org_id, fencing_gen in claimed:
        async with SessionLocal() as db:
            success = await process_inbox_job_atomically(
                db,
                inbox_id=inbox_id,
                lease_token=lease_token,
                fencing_generation=fencing_gen,
                business_func=func,
            )
            if success:
                processed += 1

    return processed


async def run_outbox_worker_once(
    batch_size: int = 10,
    worker_id: str | None = None,
    sender_func: Callable[[str, dict, int | None], Coroutine[Any, Any, None]] | None = None,
) -> int:
    """Execute a single atomic claim-and-dispatch iteration for outbox events.

    Returns:
        Number of events successfully dispatched.
    """
    worker = worker_id or f"single_outbox_w_{uuid.uuid4().hex[:6]}"
    async with SessionLocal() as db:
        return await dispatch_outbox_batch(
            db,
            batch_size=batch_size,
            sender_func=sender_func,
            worker_id=worker,
        )
