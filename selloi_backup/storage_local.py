"""Local filesystem destination adapter for Selloi Backup System.

Stores encrypted backup artifacts in a dedicated local directory on the VPS.
Enforces atomic writes and post-write SHA-256 integrity verification.
"""

import shutil
from pathlib import Path
from typing import Dict, Any, List, Union
from .storage_base import StorageAdapter, StorageAdapterError
from .integrity import calculate_sha256


class LocalStorageAdapter(StorageAdapter):
    """Storage adapter for local filesystem storage."""

    def __init__(self, base_directory: Union[str, Path]):
        self.base_dir = Path(base_directory)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def destination_name(self) -> str:
        return "local"

    def upload_file(
        self,
        local_path: Union[str, Path],
        remote_filename: str,
        expected_sha256: str
    ) -> Dict[str, Any]:
        src = Path(local_path)
        if not src.is_file():
            raise StorageAdapterError(f"Local source file not found: {src}")

        dest = self.base_dir / remote_filename
        dest.parent.mkdir(parents=True, exist_ok=True)

        # Atomic copy via temporary file
        temp_dest = dest.with_name(f"{dest.name}.tmp")
        try:
            shutil.copy2(src, temp_dest)
            
            # Post-write SHA-256 verification
            actual_sha = calculate_sha256(temp_dest)
            actual_size = temp_dest.stat().st_size

            if actual_sha.lower() != expected_sha256.lower():
                if temp_dest.exists():
                    temp_dest.unlink()
                raise StorageAdapterError(
                    f"Local destination checksum mismatch for {remote_filename}: "
                    f"expected {expected_sha256}, got {actual_sha}"
                )

            if dest.exists():
                dest.unlink()
            temp_dest.rename(dest)

            return {
                "destination": self.destination_name(),
                "status": "VERIFIED",
                "remote_path": str(dest),
                "size_bytes": actual_size,
                "sha256": actual_sha
            }
        except Exception as e:
            if temp_dest.exists():
                temp_dest.unlink()
            raise StorageAdapterError(f"Local storage transfer failed for {remote_filename}: {e}") from e

    def list_backups(self) -> List[Dict[str, Any]]:
        backups = []
        for item in self.base_dir.iterdir():
            if item.is_file() and not item.name.endswith(".tmp"):
                backups.append({
                    "name": item.name,
                    "path": str(item),
                    "size_bytes": item.stat().st_size,
                    "modified_time": item.stat().st_mtime
                })
        return backups

    def download_file(
        self,
        remote_filename: str,
        local_destination: Union[str, Path]
    ) -> Path:
        src = self.base_dir / remote_filename
        if not src.is_file():
            raise StorageAdapterError(f"Artifact not found in local storage: {remote_filename}")

        dest = Path(local_destination)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        return dest

    def verify_remote_artifact(
        self,
        remote_filename: str,
        expected_size: int,
        expected_sha256: str
    ) -> bool:
        target = self.base_dir / remote_filename
        if not target.is_file():
            return False
        if target.stat().st_size != expected_size:
            return False
        actual_sha = calculate_sha256(target)
        return actual_sha.lower() == expected_sha256.lower()
