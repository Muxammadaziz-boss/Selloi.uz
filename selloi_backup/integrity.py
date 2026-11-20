"""Integrity verification module for Selloi Backup System.

Computes and validates SHA-256 hashes for all backup artifacts.
Guarantees bit-level integrity before encryption and after transmission.
"""

import hashlib
from pathlib import Path
from typing import Union, Tuple

CHUNK_SIZE = 64 * 1024  # 64 KB streaming chunks


class IntegrityError(Exception):
    """Raised when an integrity check fails."""
    pass


def calculate_sha256(file_path: Union[str, Path]) -> str:
    """Calculate the hex-encoded SHA-256 hash of a file."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found for hash calculation: {path}")

    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def calculate_bytes_sha256(data: bytes) -> str:
    """Calculate the hex-encoded SHA-256 hash of raw bytes."""
    return hashlib.sha256(data).hexdigest().lower()


def write_sha256_file(target_file: Union[str, Path]) -> Path:
    """Compute hash and write a companion .sha256 file matching standard sha256sum format."""
    path = Path(target_file)
    checksum = calculate_sha256(path)
    checksum_path = path.with_name(f"{path.name}.sha256")
    
    # Standard format: <hash>  <filename>
    content = f"{checksum}  {path.name}\n"
    with open(checksum_path, "w", encoding="utf-8") as f:
        f.write(content)
    return checksum_path


def verify_sha256_file(checksum_file: Union[str, Path]) -> Tuple[bool, str, str]:
    """Verify a target file against its companion .sha256 file.
    
    Returns (is_valid, expected_hash, actual_hash).
    """
    chk_path = Path(checksum_file)
    if not chk_path.is_file():
        raise FileNotFoundError(f"Checksum file not found: {chk_path}")

    with open(chk_path, "r", encoding="utf-8") as f:
        line = f.readline().strip()

    parts = line.split(maxsplit=1)
    if len(parts) < 2:
        raise IntegrityError(f"Malformed checksum file format in {chk_path}")

    expected_hash = parts[0].strip().lower()
    target_filename = parts[1].strip()
    target_path = chk_path.parent / target_filename

    if not target_path.is_file():
        raise FileNotFoundError(f"Target file for checksum not found: {target_path}")

    actual_hash = calculate_sha256(target_path)
    is_valid = (expected_hash == actual_hash)
    return is_valid, expected_hash, actual_hash


def verify_file_hash(file_path: Union[str, Path], expected_hash: str) -> bool:
    """Verify that a file matches an expected SHA-256 hash."""
    actual_hash = calculate_sha256(file_path)
    return actual_hash.lower() == expected_hash.strip().lower()
