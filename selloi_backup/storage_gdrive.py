"""Google Drive destination adapter for Selloi Backup System - Resilient Phase 2C.2.

Uploads encrypted backup artifacts to a dedicated Google Drive folder.
Features:
- Service Account authentication validation.
- Dedicated folder restriction (enforces non-root folder scoping).
- Resumable upload protocol implementation and chunk-level integrity tracking.
- Network interruption simulation and resumable offset query recovery.
- Download-time byte-level SHA-256 verification (rejecting untrusted appProperties metadata).
- Remote Object Safety: Operates without requiring destructive delete permissions;
  corrupted or mismatched uploads are isolated in a dedicated quarantine namespace.
- Non-destructive Policy: Never automatically overwrites or deletes existing remote objects.
- 1 initial attempt + maximum 3 retries = 4 total attempts for transient errors.
- Additive jitter with exponential backoff.
- Configurable connect and read timeouts.
- Transient HTTP 5xx and HTTP 429 rate limit retry handling.
- Immediate fail-closed (0 retries) on authentication, permission, and credential errors.
- Duplicate object detection with hash-verified idempotency.
- Post-upload file ID, size, and byte-verified SHA-256 tracking.
"""

import os
import time
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Union, Optional

logger = logging.getLogger(__name__)
from .storage_base import (
    StorageAdapter,
    StorageAdapterError,
    StorageAuthenticationError,
    StoragePermissionError,
    StorageTransientError,
    StorageTimeoutError,
    StorageIntegrityError,
    StorageDuplicateConflictError,
    execute_with_retry
)
from .integrity import calculate_sha256, calculate_bytes_sha256
from .config import resolve_storage_env_var


class GDriveStorageAdapter(StorageAdapter):
    """Resilient storage adapter for Google Drive offsite destination."""

    def __init__(
        self,
        folder_id: str = "",
        service_account_json: str = "",
        mock_mode: bool = False,
        connect_timeout: float = 10.0,
        read_timeout: float = 30.0,
        max_retries: int = 3,
        initial_backoff: float = 0.5,
        backoff_factor: float = 2.0,
        jitter_max: float = 0.5,
        quarantine_prefix: str = "quarantine/"
    ):
        # Reconcile standard (GDRIVE_*) and legacy (BACKUP_GDRIVE_*) environment variables with conflict detection
        resolved_folder_id = (
            folder_id
            or resolve_storage_env_var("GDRIVE_FOLDER_ID", "BACKUP_GDRIVE_FOLDER_ID", default="")
        ).strip()
        resolved_sa_json = (
            service_account_json
            or resolve_storage_env_var(
                "GDRIVE_SERVICE_ACCOUNT_JSON",
                ["BACKUP_GDRIVE_SERVICE_ACCOUNT_JSON", "BACKUP_GDRIVE_CREDENTIALS_FILE"],
                default=""
            )
        ).strip()

        self.folder_id = resolved_folder_id
        self.service_account_json = resolved_sa_json
        self.mock_mode = mock_mode
        self.quarantine_prefix = quarantine_prefix.rstrip("/") + "/"

        # Resilience & Retry configuration (1 initial + max 3 retries = 4 total attempts)
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.max_retries = max_retries
        self.initial_backoff = initial_backoff
        self.backoff_factor = backoff_factor
        self.jitter_max = jitter_max

        # Mock in-memory storage: file_name -> metadata dict
        self._mock_storage: Dict[str, Dict[str, Any]] = {}
        # Quarantine storage: isolated corrupt/mismatched objects without deletion
        self._quarantine_storage: Dict[str, Dict[str, Any]] = {}
        # Resumable upload sessions: session_id -> session state
        self._resumable_sessions: Dict[str, Dict[str, Any]] = {}

        # Simulation controls for resilience tests
        self.transient_errors_remaining: int = 0
        self.rate_limit_errors_remaining: int = 0
        self.simulate_chunk_network_drops_remaining: int = 0
        self.simulate_auth_failure: bool = False
        self.simulate_timeout: bool = False

    def destination_name(self) -> str:
        return "gdrive"

    def _execute(self, op_name: str, op_callable):
        """Execute callable with configured retry policy (1 initial + max 3 retries = 4 attempts)."""
        return execute_with_retry(
            operation=op_callable,
            operation_name=f"GDrive:{op_name}",
            max_retries=self.max_retries,
            initial_backoff=self.initial_backoff,
            backoff_factor=self.backoff_factor,
            jitter_max=self.jitter_max
        )

    def _quarantine_object(
        self,
        remote_name: str,
        data: bytes,
        reason: str,
        file_id: Optional[str] = None
    ) -> str:
        """Isolate a corrupted or mismatched object in quarantine namespace without deleting."""
        timestamp = int(time.time())
        quarantine_key = f"{self.quarantine_prefix}{remote_name.replace('/', '_')}_{timestamp}.corrupt"
        fid = file_id or f"gdrive_quarantine_fid_{hash(quarantine_key) & 0xffffffff:08x}"
        actual_sha = calculate_bytes_sha256(data) if data else ""
        self._quarantine_storage[quarantine_key] = {
            "content": data,
            "reason": reason,
            "size_bytes": len(data),
            "sha256": actual_sha,
            "file_id": fid,
            "original_remote_name": remote_name,
            "quarantined_at": timestamp,
            "status": "QUARANTINED"
        }
        logger.error(
            "Google Drive artifact isolated in quarantine (no remote delete): "
            "file_id=%s, remote_name=%s, quarantine_key=%s, size_bytes=%d, sha256=%s, reason=%s",
            fid, remote_name, quarantine_key, len(data), actual_sha, reason
        )
        return quarantine_key

    def list_quarantine(self) -> List[Dict[str, Any]]:
        """List objects currently in the Google Drive quarantine namespace."""
        return [
            {
                "quarantine_key": k,
                "size_bytes": v["size_bytes"],
                "sha256": v["sha256"],
                "file_id": v.get("file_id", ""),
                "original_remote_name": v.get("original_remote_name", ""),
                "reason": v["reason"],
                "quarantined_at": v["quarantined_at"],
                "status": "QUARANTINED"
            }
            for k, v in self._quarantine_storage.items()
        ]

    def validate_service_account(self) -> Dict[str, Any]:
        """Validate Service Account JSON configuration without leaking secrets."""
        if self.mock_mode:
            return {"type": "service_account", "client_email": "mock-backup-sa@selloi-staging.iam.gserviceaccount.com"}

        if not self.service_account_json:
            raise StorageAuthenticationError("Google Drive service account credentials (JSON path) not configured.")

        sa_path = Path(self.service_account_json)
        if not sa_path.is_file():
            raise StorageAuthenticationError(f"Google Drive Service Account file not found at: {sa_path}")

        try:
            with open(sa_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            required_keys = {"type", "project_id", "private_key_id", "private_key", "client_email"}
            if not required_keys.issubset(data.keys()):
                raise StorageAuthenticationError("Invalid Service Account JSON: Missing required credential fields.")
            
            if data.get("type") != "service_account":
                raise StorageAuthenticationError("Invalid Service Account JSON: 'type' must be 'service_account'.")

            return {
                "type": data["type"],
                "project_id": data["project_id"],
                "client_email": data["client_email"]
            }
        except json.JSONDecodeError as e:
            raise StorageAuthenticationError(f"Malformed Service Account JSON file: {e}") from e

    def _check_folder_restriction(self) -> str:
        """Enforce dedicated non-root folder scoping."""
        effective_folder = self.folder_id or "mock_staging_folder_phase2c"
        if not effective_folder or effective_folder in ("root", "/", ""):
            raise StoragePermissionError(
                "Google Drive folder_id must be a dedicated non-root folder. "
                "Root uploads are strictly prohibited by security boundaries."
            )
        return effective_folder

    def upload_file(
        self,
        local_path: Union[str, Path],
        remote_filename: str,
        expected_sha256: str
    ) -> Dict[str, Any]:
        src = Path(local_path)
        if not src.is_file():
            raise StorageAdapterError(f"Source file not found for Google Drive upload: {src}")

        effective_folder = self._check_folder_restriction()
        size_bytes = src.stat().st_size
        expected_hash = expected_sha256.strip().lower()

        def _do_upload():
            # 1. Immediate authentication and permission guard (0 retries)
            if self.simulate_auth_failure:
                raise StorageAuthenticationError("Google Drive Service Account authentication failed: 401 Unauthorized")

            if self.simulate_timeout:
                raise StorageTimeoutError(f"Google Drive connection timed out after {self.connect_timeout}s")

            # 2. Transient error simulation: HTTP 429 Rate Limiting
            if self.rate_limit_errors_remaining > 0:
                self.rate_limit_errors_remaining -= 1
                raise StorageTransientError("Google Drive API returned HTTP 429 Too Many Requests (simulated)")

            # 3. Transient error simulation: HTTP 503 Backend Error
            if self.transient_errors_remaining > 0:
                self.transient_errors_remaining -= 1
                raise StorageTransientError("Google Drive API returned 503 Backend Error (simulated)")

            # 4. Duplicate object handling (idempotency check)
            if self.mock_mode:
                if remote_filename in self._mock_storage:
                    existing = self._mock_storage[remote_filename]
                    existing_bytes = existing["content"]
                    existing_sha = calculate_bytes_sha256(existing_bytes)
                    existing_size = len(existing_bytes)

                    if existing_sha == expected_hash and existing_size == size_bytes:
                        return {
                            "destination": self.destination_name(),
                            "status": "VERIFIED_IDEMPOTENT",
                            "folder_id": effective_folder,
                            "file_id": existing["file_id"],
                            "remote_name": remote_filename,
                            "size_bytes": size_bytes,
                            "sha256": existing_sha,
                            "note": "Existing file verified identical; upload skipped."
                        }
                    else:
                        raise StorageDuplicateConflictError(
                            f"Remote file '{remote_filename}' already exists with different checksum "
                            f"(existing: {existing_sha}, expected: {expected_hash}). "
                            "Automatic overwrite is strictly prohibited."
                        )

                with open(src, "rb") as f:
                    content = f.read()

                mock_file_id = f"gdrive_file_id_{hash(remote_filename) & 0xffffffff:08x}"
                remote_size = len(content)
                remote_sha = calculate_bytes_sha256(content)

                # Post-upload verification: NEVER delete, isolate in quarantine
                if remote_size != size_bytes:
                    q_key = self._quarantine_object(remote_filename, content, "size_mismatch")
                    raise StorageIntegrityError(
                        f"Google Drive remote size mismatch: expected {size_bytes}, got {remote_size}. "
                        f"Isolated in quarantine namespace: {q_key} (No delete issued)."
                    )

                if remote_sha != expected_hash:
                    q_key = self._quarantine_object(remote_filename, content, "sha256_mismatch")
                    raise StorageIntegrityError(
                        f"Google Drive remote checksum mismatch: expected {expected_hash}, got {remote_sha}. "
                        f"Isolated in quarantine namespace: {q_key} (No delete issued)."
                    )

                self._mock_storage[remote_filename] = {
                    "content": content,
                    "file_id": mock_file_id,
                    "folder_id": effective_folder,
                    "app_properties": {"sha256": remote_sha},
                    "md5_checksum": f"simulated_md5_{hash(content) & 0xffff:04x}"
                }

                return {
                    "destination": self.destination_name(),
                    "status": "VERIFIED",
                    "folder_id": effective_folder,
                    "file_id": mock_file_id,
                    "remote_name": remote_filename,
                    "size_bytes": remote_size,
                    "sha256": remote_sha
                }

            # Live Google Drive execution guard
            self.validate_service_account()
            raise StorageAdapterError(
                "Live Google Drive upload requires Phase 2 service account credentials. "
                "Use mock_mode=True for Phase 1/2 verification."
            )

        return self._execute(f"upload({remote_filename})", _do_upload)

    # --- GOOGLE DRIVE RESUMABLE UPLOAD PROTOCOL ---

    def initiate_resumable_session(
        self,
        remote_filename: str,
        total_size: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Step 1: Initiate a resumable upload session.
        
        Corresponds to POST /upload/drive/v3/files?uploadType=resumable.
        Returns a resumable upload session URI.
        """
        effective_folder = self._check_folder_restriction()
        if self.simulate_auth_failure:
            raise StorageAuthenticationError("Google Drive authentication failed during resumable session init: 401")

        session_id = f"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id={hash(remote_filename) & 0xffffffff:08x}_{int(time.time())}"
        mock_file_id = f"gdrive_file_id_{hash(remote_filename) & 0xffffffff:08x}"

        self._resumable_sessions[session_id] = {
            "remote_name": remote_filename,
            "total_size": total_size,
            "folder_id": effective_folder,
            "file_id": mock_file_id,
            "uploaded_bytes": bytearray(),
            "metadata": metadata or {},
            "status": "IN_PROGRESS",
            "created_at": time.time()
        }
        return session_id

    def upload_resumable_chunk(
        self,
        session_id: str,
        chunk_data: bytes,
        start_byte: int,
        total_size: int
    ) -> Dict[str, Any]:
        """Step 2: Upload a chunk to the resumable upload session.
        
        Corresponds to PUT {session_uri} with Content-Range: bytes start-end/total.
        Returns status dict representing HTTP 308 (Incomplete) or HTTP 200/201 (Completed).
        """
        if session_id not in self._resumable_sessions:
            raise StorageAdapterError(f"Invalid or expired Google Drive resumable session: {session_id}")

        session = self._resumable_sessions[session_id]

        if self.simulate_auth_failure:
            raise StorageAuthenticationError("Google Drive session token expired or invalid: 401 Unauthorized")

        # Transient error simulation: HTTP 429 Rate Limiting
        if self.rate_limit_errors_remaining > 0:
            self.rate_limit_errors_remaining -= 1
            raise StorageTransientError("Google Drive returned HTTP 429 Too Many Requests during chunk upload")

        # Simulated network drop / socket disconnect during chunk transfer
        if self.simulate_chunk_network_drops_remaining > 0:
            self.simulate_chunk_network_drops_remaining -= 1
            raise StorageTransientError("Connection broken during resumable chunk upload (simulated socket reset)")

        if self.transient_errors_remaining > 0:
            self.transient_errors_remaining -= 1
            raise StorageTransientError("Google Drive returned HTTP 503 Backend Error during chunk upload")

        # Validate sequential chunk position
        current_len = len(session["uploaded_bytes"])
        if start_byte != current_len:
            raise StorageAdapterError(
                f"Resumable chunk offset mismatch: expected start {current_len}, got {start_byte}. "
                "Query resumable offset before retrying."
            )

        session["uploaded_bytes"].extend(chunk_data)
        new_len = len(session["uploaded_bytes"])

        if new_len < total_size:
            return {
                "status": "RESUME_INCOMPLETE",
                "http_status": 308,
                "bytes_received": new_len,
                "range_header": f"bytes=0-{new_len - 1}",
                "total_size": total_size
            }
        elif new_len == total_size:
            # Complete upload
            final_content = bytes(session["uploaded_bytes"])
            session["status"] = "COMPLETED"
            remote_name = session["remote_name"]
            file_id = session["file_id"]

            self._mock_storage[remote_name] = {
                "content": final_content,
                "file_id": file_id,
                "folder_id": session["folder_id"],
                "app_properties": session["metadata"].get("appProperties", {}),
                "md5_checksum": f"simulated_md5_{hash(final_content) & 0xffff:04x}"
            }

            return {
                "status": "COMPLETED",
                "http_status": 200,
                "file_id": file_id,
                "remote_name": remote_name,
                "size_bytes": total_size,
                "sha256": calculate_bytes_sha256(final_content),
                "md5_checksum": self._mock_storage[remote_name]["md5_checksum"],
                "app_properties": session["metadata"].get("appProperties", {})
            }
        else:
            raise StorageIntegrityError(
                f"Uploaded bytes exceeded total size: received {new_len}, expected {total_size}"
            )

    def query_resumable_offset(self, session_id: str, total_size: int) -> int:
        """Step 3: Query the current offset for an interrupted resumable upload session.
        
        Corresponds to PUT {session_uri} with Content-Range: bytes */total_size.
        Returns the next expected byte offset (0 if no bytes received yet).
        """
        if session_id not in self._resumable_sessions:
            raise StorageAdapterError(f"Resumable session not found: {session_id}")

        session = self._resumable_sessions[session_id]
        return len(session["uploaded_bytes"])

    def resumable_upload_file(
        self,
        local_path: Union[str, Path],
        remote_filename: str,
        expected_sha256: str,
        chunk_size: int = 256 * 1024
    ) -> Dict[str, Any]:
        """High-level orchestration for multi-chunk Resumable Upload with offset recovery.
        
        Reads local file in chunks, uploads sequentially, queries offset on transient interruptions,
        and finishes with byte-level SHA-256 verification.
        """
        src = Path(local_path)
        if not src.is_file():
            raise StorageAdapterError(f"Source file not found for resumable upload: {src}")

        total_size = src.stat().st_size
        expected_hash = expected_sha256.strip().lower()

        # Check duplicate before starting session
        if self.mock_mode and remote_filename in self._mock_storage:
            existing = self._mock_storage[remote_filename]
            existing_bytes = existing["content"]
            existing_sha = calculate_bytes_sha256(existing_bytes)
            if existing_sha == expected_hash and len(existing_bytes) == total_size:
                return {
                    "destination": self.destination_name(),
                    "status": "VERIFIED_IDEMPOTENT",
                    "file_id": existing["file_id"],
                    "remote_name": remote_filename,
                    "size_bytes": total_size,
                    "sha256": existing_sha,
                    "note": "Existing file verified identical; resumable upload skipped."
                }
            else:
                raise StorageDuplicateConflictError(
                    f"Remote file '{remote_filename}' already exists with different checksum. "
                    "Automatic overwrite is strictly prohibited."
                )

        metadata = {
            "name": remote_filename,
            "appProperties": {"sha256": expected_hash}
        }
        session_id = self.initiate_resumable_session(remote_filename, total_size, metadata)

        with open(src, "rb") as f:
            while True:
                # Query current remote offset to support resuming after interruption
                offset = self.query_resumable_offset(session_id, total_size)
                if offset >= total_size:
                    break

                f.seek(offset)
                chunk_bytes = f.read(chunk_size)
                if not chunk_bytes:
                    break

                def _upload_chunk_operation():
                    return self.upload_resumable_chunk(
                        session_id=session_id,
                        chunk_data=chunk_bytes,
                        start_byte=offset,
                        total_size=total_size
                    )

                result = self._execute(
                    f"resumable_chunk({remote_filename}, offset={offset})",
                    _upload_chunk_operation
                )
                if result.get("status") == "COMPLETED":
                    break

        # Verification
        if self.mock_mode:
            stored = self._mock_storage[remote_filename]
            stored_bytes = stored["content"]
            actual_size = len(stored_bytes)
            actual_sha = calculate_bytes_sha256(stored_bytes)

            if actual_size != total_size:
                q_key = self._quarantine_object(remote_filename, stored_bytes, "resumable_size_mismatch")
                raise StorageIntegrityError(
                    f"Resumable upload size mismatch: expected {total_size}, got {actual_size}. "
                    f"Quarantined in: {q_key} (No delete issued)."
                )

            if actual_sha != expected_hash:
                q_key = self._quarantine_object(remote_filename, stored_bytes, "resumable_sha256_mismatch")
                raise StorageIntegrityError(
                    f"Resumable upload SHA-256 mismatch: expected {expected_hash}, got {actual_sha}. "
                    f"Quarantined in: {q_key} (No delete issued)."
                )

            return {
                "destination": self.destination_name(),
                "status": "VERIFIED",
                "folder_id": self._check_folder_restriction(),
                "file_id": stored["file_id"],
                "remote_name": remote_filename,
                "size_bytes": actual_size,
                "sha256": actual_sha,
                "protocol": "RESUMABLE_UPLOAD"
            }

        raise StorageAdapterError("Live resumable upload requires Phase 2 service account credentials.")

    # --- CRYPTOGRAPHIC SHA-256 DOWNLOAD VERIFICATION ---

    def download_and_verify_sha256(
        self,
        remote_filename: str,
        local_destination: Union[str, Path],
        expected_sha256: str
    ) -> Path:
        """Download artifact and compute SHA-256 directly on downloaded byte stream.
        
        Security Boundary:
        - Google Drive API provides native md5Checksum. It does NOT compute SHA-256 natively.
        - appProperties is mutable, unverified client metadata, NOT cryptographic proof.
        - This method downloads the actual payload and independently calculates SHA-256 over
          the received bytes, strictly validating against the signed backup manifest.
        - If SHA-256 does not match, the downloaded artifact is unlinked immediately,
          and StorageIntegrityError is raised fail-closed to abort any restore attempt.
        """
        dest = Path(local_destination)
        expected_hash = expected_sha256.strip().lower()

        # Step 1: Download to local destination (using atomic download_file)
        self.download_file(remote_filename, dest)

        # Step 2: Cryptographic SHA-256 verification directly from downloaded disk bytes
        actual_sha = calculate_sha256(dest)
        if actual_sha != expected_hash:
            # Safe temporary file cleanup: overwrite with null bytes before unlinking
            if dest.exists():
                try:
                    with open(dest, "wb") as f_clean:
                        f_clean.write(b"\x00" * min(dest.stat().st_size, 4096))
                except Exception:
                    pass
                dest.unlink(missing_ok=True)

            # Isolate remote object in quarantine without invoking remote delete
            file_id = "unknown_file_id"
            if self.mock_mode and remote_filename in self._mock_storage:
                entry = self._mock_storage.pop(remote_filename)
                file_id = entry.get("file_id", "mock_file_id")
                self._quarantine_object(
                    remote_name=remote_filename,
                    data=entry.get("content", b""),
                    reason=f"download_sha256_mismatch: expected {expected_hash}, got {actual_sha}",
                    file_id=file_id
                )

            logger.error(
                "Google Drive checksum mismatch detected: file_id=%s, remote_name=%s, "
                "expected_sha256=%s, actual_sha256=%s. Remote delete NOT invoked. "
                "Artifact marked QUARANTINED.",
                file_id, remote_filename, expected_hash, actual_sha
            )
            raise StorageIntegrityError(
                f"Google Drive downloaded artifact SHA-256 mismatch: expected {expected_hash}, got {actual_sha}. "
                f"Remote file '{remote_filename}' (file_id: {file_id}) marked QUARANTINED without remote deletion. "
                "Restore rejected fail-closed."
            )

        return dest

    def list_backups(self) -> List[Dict[str, Any]]:
        def _do_list():
            if self.simulate_auth_failure:
                raise StorageAuthenticationError("Google Drive list failed: 403 Forbidden")
            if self.simulate_timeout:
                raise StorageTimeoutError("Google Drive list timed out")
            if self.transient_errors_remaining > 0:
                self.transient_errors_remaining -= 1
                raise StorageTransientError("Google Drive HTTP 500 Internal Server Error")

            if self.mock_mode:
                return [
                    {
                        "name": k,
                        "size_bytes": len(v["content"]),
                        "file_id": v["file_id"],
                        "folder_id": v["folder_id"],
                        "sha256": calculate_bytes_sha256(v["content"])
                    }
                    for k, v in self._mock_storage.items()
                    if not k.startswith(self.quarantine_prefix)
                    and v.get("status") != "QUARANTINED"
                ]
            return []

        return self._execute("list_backups", _do_list)

    def download_file(
        self,
        remote_filename: str,
        local_destination: Union[str, Path]
    ) -> Path:
        dest = Path(local_destination)
        dest.parent.mkdir(parents=True, exist_ok=True)

        def _do_download():
            if self.simulate_auth_failure:
                raise StorageAuthenticationError("Google Drive download failed: 401 Unauthorized")
            if self.simulate_timeout:
                raise StorageTimeoutError("Google Drive download timed out")
            if self.transient_errors_remaining > 0:
                self.transient_errors_remaining -= 1
                raise StorageTransientError("Google Drive HTTP 503 Backend Error during download")

            if self.mock_mode:
                if remote_filename not in self._mock_storage:
                    raise StorageAdapterError(f"File '{remote_filename}' not found in Google Drive mock storage")

                # Atomic write via temporary file
                temp_dest = dest.with_name(f"{dest.name}.tmp")
                try:
                    with open(temp_dest, "wb") as f:
                        f.write(self._mock_storage[remote_filename]["content"])
                    if dest.exists():
                        dest.unlink()
                    temp_dest.rename(dest)
                finally:
                    if temp_dest.exists():
                        temp_dest.unlink()

                return dest

            raise StorageAdapterError("Live Google Drive download requires Phase 2 authorization.")

        return self._execute(f"download({remote_filename})", _do_download)

    def verify_remote_artifact(
        self,
        remote_filename: str,
        expected_size: int,
        expected_sha256: str
    ) -> bool:
        if self.mock_mode:
            if remote_filename not in self._mock_storage:
                return False
            data = self._mock_storage[remote_filename]["content"]
            if len(data) != expected_size:
                return False
            return calculate_bytes_sha256(data).lower() == expected_sha256.strip().lower()
        return False
