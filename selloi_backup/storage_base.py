"""Base interface and resilience framework for Selloi Backup storage destinations.

Defines the contract for upload, download, verification, and retention.
Enforces non-destructive synchronization, exponential backoff with jitter,
immediate fail-closed on auth/permission errors, and post-transfer verification.
"""

import time
import random
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List, Union, Callable, TypeVar, Optional

logger = logging.getLogger(__name__)

T = TypeVar("T")


class StorageAdapterError(Exception):
    """Base exception for storage adapter operations."""
    pass


class StorageAuthenticationError(StorageAdapterError):
    """Raised when authentication credentials or signature validation fails."""
    pass


class StoragePermissionError(StorageAuthenticationError):
    """Raised when access is denied or bucket/folder permissions are insufficient."""
    pass


class StorageTransientError(StorageAdapterError):
    """Raised on recoverable network drops, timeouts, or HTTP 5xx responses."""
    pass


class StorageTimeoutError(StorageTransientError):
    """Raised when an operation exceeds configured connect or read timeout."""
    pass


class StorageIntegrityError(StorageAdapterError):
    """Raised when post-transfer size or SHA-256 verification fails."""
    pass


class StorageDuplicateConflictError(StorageAdapterError):
    """Raised when a remote object already exists with a different checksum."""
    pass


class StorageConfigurationConflictError(StorageAdapterError):
    """Raised when canonical and legacy environment variables are both set with conflicting values."""
    pass


def execute_with_retry(
    operation: Callable[..., T],
    operation_name: str,
    max_retries: int = 3,
    initial_backoff: float = 0.5,
    backoff_factor: float = 2.0,
    jitter_max: float = 0.5,
    sleep_fn: Callable[[float], None] = time.sleep
) -> T:
    """Execute an operation with exponential backoff and additive random jitter.
    
    Retry Policy Consistency:
    - Exactly 1 initial attempt + maximum 3 retries = 4 total attempts.
    - Retries strictly on transient errors (HTTP 5xx, HTTP 429 rate limit, socket timeouts, network errors).
    - Immediate fail-closed (0 retries, 1 attempt total) on authentication, permission,
      integrity mismatch, or duplicate conflict errors.
    
    Jitter Architecture:
    - Additive Jitter: delay = (initial_backoff * (backoff_factor ** (attempt - 1))) + uniform(0, jitter_max).
      Guarantees a progressive backoff floor so the server is never immediately re-hammered,
      while random jitter prevents thundering herd synchronization.
    - Full Jitter: delay = uniform(0, initial_backoff * (backoff_factor ** (attempt - 1))).
      Can generate near-zero delays, risking immediate repeated collisions.
      Selloi intentionally enforces Additive Jitter across all storage adapters.
    """
    attempt = 0
    total_allowed_attempts = max_retries + 1
    while True:
        try:
            return operation()
        except (StorageAuthenticationError, StoragePermissionError, StorageIntegrityError, StorageDuplicateConflictError):
            # Immediate fail-closed: 0 retries on credential, permission, or checksum conflict errors
            logger.error(f"Non-retryable failure during {operation_name} (0 retries allowed)")
            raise
        except (StorageTransientError, TimeoutError, ConnectionError, IOError, OSError) as e:
            attempt += 1
            if attempt > max_retries:
                logger.error(f"Exceeded max retries ({max_retries}) for {operation_name} (total attempts: {total_allowed_attempts}): {e}")
                raise StorageAdapterError(f"Operation {operation_name} failed after {max_retries} retries ({total_allowed_attempts} total attempts): {e}") from e
            
            backoff = (initial_backoff * (backoff_factor ** (attempt - 1))) + random.uniform(0, jitter_max)
            logger.warning(
                f"Transient error during {operation_name} (retry {attempt}/{max_retries}, "
                f"attempt {attempt + 1}/{total_allowed_attempts}): {e}. "
                f"Retrying in {backoff:.2f}s (additive jitter)..."
            )
            sleep_fn(backoff)
        except Exception as e:
            # Unclassified errors: treat as non-retryable by default
            logger.error(f"Fatal error during {operation_name}: {e}")
            raise StorageAdapterError(f"Fatal error in {operation_name}: {e}") from e


class StorageAdapter(ABC):
    """Abstract base class for backup destination adapters."""

    @abstractmethod
    def destination_name(self) -> str:
        """Name of the destination adapter (e.g. 'local', 'r2', 'gdrive')."""
        pass

    @abstractmethod
    def upload_file(
        self,
        local_path: Union[str, Path],
        remote_filename: str,
        expected_sha256: str
    ) -> Dict[str, Any]:
        """Upload a file to the storage destination.
        
        Must verify size and SHA-256 after upload.
        Returns dict with destination status, size, and remote identifier.
        """
        pass

    @abstractmethod
    def list_backups(self) -> List[Dict[str, Any]]:
        """List all stored backup bundles at this destination."""
        pass

    @abstractmethod
    def download_file(
        self,
        remote_filename: str,
        local_destination: Union[str, Path]
    ) -> Path:
        """Download an artifact from the storage destination."""
        pass

    @abstractmethod
    def verify_remote_artifact(
        self,
        remote_filename: str,
        expected_size: int,
        expected_sha256: str
    ) -> bool:
        """Verify that a remote artifact exists and matches expected size and hash."""
        pass
