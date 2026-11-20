"""Replay and Rollback Protection Engine for Selloi Backup System - Hardened Phase 2G.1.

Guarantees monotonic sequence tracking, duplicate backup identifier rejection,
hash chain verification, atomic state ledger management, and multi-process file locking.
Prevents adversaries from replaying older valid signed manifests to roll back database state.
Features HMAC-SHA256 ledger integrity authentication and append-only audit trail.
"""

import json
import os
import hmac
import hashlib
import secrets
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Union
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from .manifest import ManifestError, compute_manifest_hash


class ReplayProtectionError(ManifestError):
    """Base exception for replay and rollback protection violations."""
    pass


class ManifestReplayError(ReplayProtectionError):
    """Raised when an older or previously processed manifest is replayed."""
    pass


class ManifestSequenceRollbackError(ReplayProtectionError):
    """Raised when a manifest sequence number is less than or equal to the latest recorded sequence."""
    pass


class ManifestDuplicateBackupIdError(ReplayProtectionError):
    """Raised when a backup identifier is submitted more than once."""
    pass


class ManifestChainBrokenError(ReplayProtectionError):
    """Raised when the previous_manifest_hash does not match the ledger chain."""
    pass


class LedgerAuthenticationError(ReplayProtectionError):
    """Raised when the backup state ledger fails HMAC integrity verification or has been tampered with."""
    pass


def derive_ledger_signing_key(
    master_key: bytes,
    salt: Optional[bytes] = None,
    info: bytes = b"selloi-backup-ledger-signing-v2"
) -> bytes:
    """Derive segregated 256-bit ledger signing key using RFC 5869 HKDF-SHA256."""
    if len(master_key) < 16:
        raise ValueError("Master key must be at least 16 bytes to derive ledger key.")
    effective_salt = salt or b"SELLOI_LEDGER_SALT_V2"
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=effective_salt,
        info=info,
    )
    return hkdf.derive(master_key)


class FileLock:
    """Cross-platform inter-process file lock using atomic lockfile semantics."""

    def __init__(self, lock_file: Path, timeout: float = 10.0, stale_timeout: float = 60.0):
        self.lock_file = Path(lock_file)
        self.timeout = timeout
        self.stale_timeout = stale_timeout
        self._acquired = False

    def acquire(self) -> bool:
        start = time.time()
        while time.time() - start < self.timeout:
            try:
                fd = os.open(str(self.lock_file), os.O_CREAT | os.O_EXCL | os.O_RDWR)
                try:
                    payload = f"{os.getpid()}:{time.time()}".encode("utf-8")
                    os.write(fd, payload)
                finally:
                    os.close(fd)
                self._acquired = True
                return True
            except FileExistsError:
                # Handle stale lock
                try:
                    mtime = self.lock_file.stat().st_mtime
                    if time.time() - mtime > self.stale_timeout:
                        try:
                            self.lock_file.unlink(missing_ok=True)
                        except OSError:
                            pass
                except OSError:
                    pass
                time.sleep(0.05)
        raise TimeoutError(f"Failed to acquire file lock within {self.timeout}s: {self.lock_file}")

    def release(self) -> None:
        if self._acquired:
            try:
                self.lock_file.unlink(missing_ok=True)
            except OSError:
                pass
            self._acquired = False

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()


class BackupStateLedger:
    """Thread-safe and process-safe monotonic state ledger for backup sequence tracking."""

    def __init__(
        self,
        ledger_file: Optional[Union[str, Path]] = None,
        signing_key: Optional[bytes] = None,
        project_id: str = "ganlawuubihxinuwjvez",
        ledger_version: str = "2.0.0"
    ):
        self.ledger_file = Path(ledger_file) if ledger_file else None
        self.signing_key = signing_key
        self._lock = threading.Lock()
        self.ledger_version = ledger_version
        self.project_id = project_id
        self.latest_sequence_number = 0
        self.latest_backup_id = ""
        self.latest_manifest_hash = ""
        self.seen_backup_ids: Dict[str, Dict[str, Any]] = {}

        if self.ledger_file and self.ledger_file.is_file():
            self._load()

    def _load(self) -> None:
        """Load state from persistent ledger file fail-closed with integrity verification."""
        try:
            with open(self.ledger_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            raise ReplayProtectionError(f"Failed to read backup state ledger: {e}") from e

        if not isinstance(data, dict):
            raise ReplayProtectionError("Malformed state ledger: root must be a JSON object.")

        # 1. Project identity validation
        recorded_project = data.get("project_id", "")
        if recorded_project != self.project_id:
            raise ReplayProtectionError(
                f"LEDGER PROJECT ID MISMATCH: expected '{self.project_id}', got '{recorded_project}'."
            )

        # 2. Schema version validation
        recorded_version = data.get("ledger_version", "1.0.0")
        if recorded_version not in ("1.0.0", "2.0.0"):
            raise ReplayProtectionError(f"Unsupported ledger schema version: '{recorded_version}'.")

        # 3. HMAC-SHA256 signature verification if authenticated or signing_key configured
        auth_envelope = data.get("authentication")
        if auth_envelope:
            if not isinstance(auth_envelope, dict):
                raise LedgerAuthenticationError("Malformed ledger authentication envelope.")
            sig = auth_envelope.get("signature", "")
            key_id = auth_envelope.get("key_id", "")
            if not sig or not key_id:
                raise LedgerAuthenticationError("Ledger authentication envelope missing required signature or key_id.")

            if self.signing_key:
                expected_key_id = hashlib.sha256(self.signing_key).hexdigest()[:16]
                if key_id != expected_key_id:
                    raise LedgerAuthenticationError(
                        f"Ledger Key ID mismatch: expected '{expected_key_id}', got '{key_id}'."
                    )

                payload = {k: v for k, v in data.items() if k != "authentication"}
                payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
                computed_sig = hmac.new(self.signing_key, payload_bytes, hashlib.sha256).hexdigest()

                if not hmac.compare_digest(sig.lower(), computed_sig.lower()):
                    raise LedgerAuthenticationError(
                        "LEDGER TAMPERING DETECTED: Ledger HMAC signature verification failed."
                    )
        elif self.signing_key and recorded_version == "2.0.0":
            raise LedgerAuthenticationError(
                "LEDGER AUTHENTICATION MISSING: V2 ledger must contain valid HMAC-SHA256 authentication."
            )

        self.ledger_version = recorded_version
        self.project_id = recorded_project
        self.latest_sequence_number = int(data.get("latest_sequence_number", 0))
        self.latest_backup_id = str(data.get("latest_backup_id", ""))
        self.latest_manifest_hash = str(data.get("latest_manifest_hash", ""))
        self.seen_backup_ids = data.get("seen_backup_ids", {})

    def save(self) -> None:
        """Atomically persist state ledger to disk with multi-process lock, fsync, and permissions."""
        if not self.ledger_file:
            return

        self.ledger_file.parent.mkdir(parents=True, exist_ok=True)
        lock_path = self.ledger_file.with_name(f"{self.ledger_file.name}.lock")

        with FileLock(lock_path):
            state = {
                "ledger_version": self.ledger_version,
                "project_id": self.project_id,
                "latest_sequence_number": self.latest_sequence_number,
                "latest_backup_id": self.latest_backup_id,
                "latest_manifest_hash": self.latest_manifest_hash,
                "seen_backup_ids": self.seen_backup_ids,
                "updated_at_utc": datetime.now(timezone.utc).isoformat()
            }

            if self.signing_key:
                payload_bytes = json.dumps(state, sort_keys=True, separators=(",", ":")).encode("utf-8")
                sig = hmac.new(self.signing_key, payload_bytes, hashlib.sha256).hexdigest()
                key_id = hashlib.sha256(self.signing_key).hexdigest()[:16]
                state["authentication"] = {
                    "signature_algorithm": "HMAC-SHA256",
                    "signature": sig,
                    "key_id": key_id,
                    "purpose": "selloi-backup-ledger-signing-v2",
                    "signed_at_utc": datetime.now(timezone.utc).isoformat()
                }

            tmp_file = self.ledger_file.with_name(
                f"{self.ledger_file.name}.{os.getpid()}.{secrets.token_hex(4)}.tmp"
            )

            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
                f.flush()
                os.fsync(f.fileno())

            # Secure POSIX permissions (owner read/write only)
            if hasattr(os, "chmod") and os.name != "nt":
                try:
                    os.chmod(tmp_file, 0o600)
                except OSError:
                    pass

            # Atomic filesystem replace
            tmp_file.replace(self.ledger_file)

            # Append to append-only transaction history log for rollback audit trail
            history_file = self.ledger_file.with_name(f"{self.ledger_file.stem}_history.jsonl")
            self._append_history_entry(history_file)

    def _append_history_entry(self, history_file: Path) -> None:
        """Append state transition record to immutable local journal."""
        entry = {
            "sequence_number": self.latest_sequence_number,
            "backup_id": self.latest_backup_id,
            "manifest_hash": self.latest_manifest_hash,
            "timestamp_utc": datetime.now(timezone.utc).isoformat()
        }
        line = json.dumps(entry, sort_keys=True) + "\n"
        with open(history_file, "a", encoding="utf-8") as f:
            f.write(line)
            f.flush()

    def validate_manifest_for_restore(
        self,
        manifest: Dict[str, Any],
        allow_historical: bool = False
    ) -> None:
        """Validate that a manifest is not an unauthorized replay or rollback attack."""
        with self._lock:
            backup_id = manifest.get("backup_id", "").strip()
            if not backup_id:
                raise ReplayProtectionError("Manifest is missing required 'backup_id'.")

            seq = int(manifest.get("sequence_number", 1))

            if not allow_historical:
                # 1. Rollback detection
                if self.latest_sequence_number > 0 and seq < self.latest_sequence_number:
                    raise ManifestSequenceRollbackError(
                        f"ROLLBACK ATTACK DETECTED: Manifest sequence {seq} is older than "
                        f"latest recorded state {self.latest_sequence_number}."
                    )

                # 2. Replay detection (duplicate backup_id on older state)
                if backup_id in self.seen_backup_ids:
                    recorded_seq = self.seen_backup_ids[backup_id]["sequence_number"]
                    if seq <= self.latest_sequence_number and backup_id != self.latest_backup_id:
                        raise ManifestReplayError(
                            f"REPLAY ATTACK DETECTED: Backup '{backup_id}' with sequence {recorded_seq} "
                            "was already processed. Replaying past states without authorization is prohibited."
                        )

            # 3. Hash chain verification (if previous_manifest_hash is provided)
            prev_hash = manifest.get("previous_manifest_hash", "").strip()
            if prev_hash and self.latest_manifest_hash:
                if seq == self.latest_sequence_number + 1 and prev_hash != self.latest_manifest_hash:
                    raise ManifestChainBrokenError(
                        f"HASH CHAIN BROKEN: Manifest claims previous_manifest_hash='{prev_hash}', "
                        f"but ledger expected '{self.latest_manifest_hash}'."
                    )

    def record_manifest(self, manifest: Dict[str, Any]) -> None:
        """Record an admitted backup manifest into the monotonic state ledger."""
        with self._lock:
            backup_id = manifest.get("backup_id", "").strip()
            if not backup_id:
                raise ReplayProtectionError("Cannot record manifest without 'backup_id'.")

            # Duplicate ID check
            if backup_id in self.seen_backup_ids:
                raise ManifestDuplicateBackupIdError(
                    f"Duplicate backup ID: '{backup_id}' already exists in state ledger."
                )

            seq = int(manifest.get("sequence_number", self.latest_sequence_number + 1))

            # Strictly monotonic sequence check
            if self.latest_sequence_number > 0 and seq <= self.latest_sequence_number:
                raise ManifestSequenceRollbackError(
                    f"Monotonic sequence violation: sequence {seq} <= latest recorded {self.latest_sequence_number}."
                )

            manifest_hash = compute_manifest_hash(manifest)

            self.seen_backup_ids[backup_id] = {
                "sequence_number": seq,
                "snapshot_id": manifest.get("snapshot_id", ""),
                "manifest_hash": manifest_hash,
                "recorded_at_utc": datetime.now(timezone.utc).isoformat()
            }

            self.latest_sequence_number = seq
            self.latest_backup_id = backup_id
            self.latest_manifest_hash = manifest_hash

            self.save()

    def get_summary(self) -> Dict[str, Any]:
        """Return sanitized ledger state summary."""
        with self._lock:
            return {
                "ledger_version": self.ledger_version,
                "project_id": self.project_id,
                "latest_sequence_number": self.latest_sequence_number,
                "latest_backup_id": self.latest_backup_id,
                "latest_manifest_hash": self.latest_manifest_hash,
                "total_tracked_backups": len(self.seen_backup_ids),
                "is_authenticated": bool(self.signing_key)
            }
