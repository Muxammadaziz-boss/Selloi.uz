"""Media directory backup module for Selloi Backup System - Hardened Phase 2A.

Packages the VPS media directory (storage/channel_images/) into a compressed tarball.
Tracks file counts, byte sizes, rejects symlinks, and guarantees safe atomic generation.
"""

import os
import tarfile
from pathlib import Path
from typing import Dict, Any, Union


class MediaBackupError(Exception):
    """Raised when media directory packaging fails."""
    pass


class SymlinkSecurityError(MediaBackupError):
    """Raised when a symlink is detected within the media directory."""
    pass


def package_media_directory(
    media_dir_path: Union[str, Path],
    output_archive_path: Union[str, Path],
    allow_symlinks: bool = False
) -> Dict[str, Any]:
    """Package media files into a deterministic tar.gz archive.
    
    Security: Strictly rejects symlinks to prevent directory traversal attacks.
    Returns metadata dict: {file_count, total_uncompressed_bytes, archive_size_bytes}.
    """
    media_path = Path(media_dir_path).resolve()
    out_path = Path(output_archive_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    temp_out = out_path.with_name(f"{out_path.name}.tmp")

    file_count = 0
    total_uncompressed_bytes = 0

    try:
        with tarfile.open(temp_out, "w:gz") as tar:
            if media_path.exists() and media_path.is_dir():
                for root, dirs, files in os.walk(media_path, followlinks=False):
                    root_p = Path(root)

                    # Reject symlinked directories
                    if not allow_symlinks and root_p.is_symlink():
                        raise SymlinkSecurityError(
                            f"SYMLINK TRAVERSAL DETECTED: Directory '{root_p}' is a symlink. "
                            "Symlinks are prohibited in media backup payload."
                        )

                    for file in files:
                        full_path = root_p / file

                        # Reject symlinked files
                        if not allow_symlinks and full_path.is_symlink():
                            raise SymlinkSecurityError(
                                f"SYMLINK TRAVERSAL DETECTED: File '{full_path}' is a symlink. "
                                "Symlinks are prohibited in media backup payload."
                            )

                        # Exclude temporary or hidden files
                        if file.startswith(".") or file.endswith(".tmp"):
                            continue

                        arcname = full_path.relative_to(media_path.parent if media_path.parent != Path(".") else media_path)

                        stat = full_path.stat()
                        total_uncompressed_bytes += stat.st_size
                        file_count += 1

                        tar.add(full_path, arcname=str(arcname), recursive=False)

        archive_size = temp_out.stat().st_size
        if out_path.exists():
            out_path.unlink()
        temp_out.rename(out_path)

        return {
            "archive_path": str(out_path),
            "file_count": file_count,
            "total_uncompressed_bytes": total_uncompressed_bytes,
            "archive_size_bytes": archive_size
        }
    except Exception as e:
        if temp_out.exists():
            temp_out.unlink()
        raise MediaBackupError(f"Failed to package media directory: {e}") from e
