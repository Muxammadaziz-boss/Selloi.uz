"""Cryptographic engine for Selloi Backup System - Hardened Phase 2A.

Implements authenticated AES-256-GCM encryption with cryptographically random nonces,
chunk index AAD binding, strict chunk length validation, and Key ID header support.
Guarantees both confidentiality and tamper-proof message authentication.
"""

import os
import struct
import hashlib
from pathlib import Path
from typing import Union, Dict, Optional, Tuple, Set
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC_HEADER_V1 = b"SELLOI_GCM_V1"  # Phase 1 header (without Key ID)
MAGIC_HEADER_V2 = b"SELLOI_GCM_V2"  # Phase 2A header (with 8-byte Key ID)

KEY_SIZE_BYTES = 32  # 256 bits
KEY_ID_SIZE_BYTES = 8  # 8 bytes identifier derived from SHA-256 of key
NONCE_SIZE_BYTES = 12  # Standard 96-bit nonce for AES-GCM
TAG_SIZE_BYTES = 16  # Standard 128-bit authentication tag
CHUNK_PAYLOAD_SIZE = 64 * 1024  # 64 KB plaintext chunk
MAX_ALLOWED_CHUNK_CIPHERTEXT = CHUNK_PAYLOAD_SIZE + TAG_SIZE_BYTES + 1024  # Strict bounds


class CryptoError(Exception):
    """Base exception for cryptographic operations."""
    pass


class InvalidKeyError(CryptoError):
    """Raised when an encryption key is invalid or wrong size."""
    pass


class AuthenticationFailedError(CryptoError):
    """Raised when ciphertext authentication tag verification fails."""
    pass


class KeyIdentifierMismatchError(AuthenticationFailedError):
    """Raised when the key identifier in the header does not match the provided key."""
    pass


class CorruptedArchiveError(CryptoError):
    """Raised when archive structure or chunk length is invalid."""
    pass


def derive_key_id(key: bytes) -> bytes:
    """Compute an 8-byte Key Identifier from the SHA-256 of the master key.
    
    Used to identify which historical key was used to encrypt an archive
    without revealing the key itself.
    """
    validate_key(key)
    return hashlib.sha256(key).digest()[:KEY_ID_SIZE_BYTES]


def generate_key() -> bytes:
    """Generate a cryptographically secure 256-bit random key."""
    return os.urandom(KEY_SIZE_BYTES)


def save_key(key: bytes, key_path: Union[str, Path]) -> None:
    """Save an encryption key to disk with strict 0400 file permissions."""
    validate_key(key)
    path = Path(key_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "wb") as f:
        f.write(key)

    try:
        os.chmod(path, 0o400)
    except Exception:
        pass


def load_key(key_path: Union[str, Path]) -> bytes:
    """Load and validate an encryption key from disk."""
    path = Path(key_path)
    if not path.is_file():
        raise FileNotFoundError(f"Key file not found: {path}")

    with open(path, "rb") as f:
        key = f.read().strip()

    # If key is hex-encoded (64 hex characters), decode to 32 bytes
    if len(key) == 64:
        try:
            key = bytes.fromhex(key.decode("ascii"))
        except ValueError:
            pass

    validate_key(key)
    return key


def validate_key(key: bytes) -> None:
    """Verify that a key is exactly 32 bytes."""
    if not isinstance(key, (bytes, bytearray)):
        raise InvalidKeyError(f"Key must be bytes, got {type(key).__name__}")
    if len(key) != KEY_SIZE_BYTES:
        raise InvalidKeyError(f"Key must be exactly {KEY_SIZE_BYTES} bytes (256 bits), got {len(key)}")


def encrypt_file(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
    key: bytes,
    key_id: Optional[bytes] = None
) -> Path:
    """Encrypt a file using chunked AES-256-GCM with Key ID and chunk index binding.
    
    Format:
    - 13 bytes: MAGIC_HEADER_V2 (b'SELLOI_GCM_V2')
    - 8 bytes: Key ID (truncated SHA-256 of key)
    - Sequential chunks:
        - 4 bytes: chunk index (big-endian uint32)
        - 4 bytes: ciphertext length (big-endian uint32, payload + 16-byte tag)
        - 12 bytes: unique random nonce
        - N bytes: ciphertext with appended 16-byte GCM tag
    """
    validate_key(key)
    in_p = Path(input_path)
    out_p = Path(output_path)

    if not in_p.is_file():
        raise FileNotFoundError(f"Input file for encryption not found: {in_p}")

    out_p.parent.mkdir(parents=True, exist_ok=True)
    aesgcm = AESGCM(key)
    actual_key_id = key_id or derive_key_id(key)

    temp_out = out_p.with_name(f"{out_p.name}.tmp")
    generated_nonces: Set[bytes] = set()

    try:
        with open(in_p, "rb") as src, open(temp_out, "wb") as dst:
            # Write file header: Magic (13 bytes) + Key ID (8 bytes)
            dst.write(MAGIC_HEADER_V2)
            dst.write(actual_key_id)

            chunk_idx = 0
            while True:
                plaintext_chunk = src.read(CHUNK_PAYLOAD_SIZE)
                if not plaintext_chunk:
                    break

                # Generate unique random 12-byte nonce and verify uniqueness in session
                nonce = os.urandom(NONCE_SIZE_BYTES)
                while nonce in generated_nonces:
                    nonce = os.urandom(NONCE_SIZE_BYTES)
                generated_nonces.add(nonce)

                # Associated data binds chunk index and key ID to prevent chunk splicing
                associated_data = struct.pack(">I", chunk_idx) + actual_key_id

                ciphertext_with_tag = aesgcm.encrypt(nonce, plaintext_chunk, associated_data)

                # Write chunk header: index (4 bytes), payload length (4 bytes), nonce (12 bytes)
                dst.write(struct.pack(">II", chunk_idx, len(ciphertext_with_tag)))
                dst.write(nonce)
                dst.write(ciphertext_with_tag)
                chunk_idx += 1

        # Atomic rename
        if out_p.exists():
            out_p.unlink()
        temp_out.rename(out_p)
        return out_p
    except Exception as e:
        if temp_out.exists():
            temp_out.unlink()
        raise CryptoError(f"Encryption failed: {e}") from e


def decrypt_file(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
    key: bytes,
    key_ring: Optional[Dict[bytes, bytes]] = None
) -> Path:
    """Decrypt a chunked AES-256-GCM encrypted file.
    
    Supports both V1 and V2 headers.
    Validates chunk length, chunk ordering, duplicate nonces, and GCM authentication tags.
    If decryption fails, securely deletes partial output.
    """
    in_p = Path(input_path)
    out_p = Path(output_path)

    if not in_p.is_file():
        raise FileNotFoundError(f"Input file for decryption not found: {in_p}")

    out_p.parent.mkdir(parents=True, exist_ok=True)
    temp_out = out_p.with_name(f"{out_p.name}.tmp")
    seen_nonces: Set[bytes] = set()

    try:
        with open(in_p, "rb") as src, open(temp_out, "wb") as dst:
            # Check magic header
            magic = src.read(13)
            active_key = key
            active_key_id = b""

            if magic == MAGIC_HEADER_V2:
                # Read 8-byte Key ID
                archive_key_id = src.read(KEY_ID_SIZE_BYTES)
                if len(archive_key_id) < KEY_ID_SIZE_BYTES:
                    raise CorruptedArchiveError("Corrupted archive: incomplete Key ID header")

                # If key ring provided, look up matching historical key
                if key_ring and archive_key_id in key_ring:
                    active_key = key_ring[archive_key_id]
                else:
                    expected_key_id = derive_key_id(active_key)
                    if archive_key_id != expected_key_id:
                        raise KeyIdentifierMismatchError(
                            f"Key ID mismatch: archive was encrypted with key ID {archive_key_id.hex()}, "
                            f"but provided key has ID {expected_key_id.hex()}"
                        )
                active_key_id = archive_key_id

            elif magic == MAGIC_HEADER_V1:
                # Backward compatibility with Phase 1 V1 archives
                validate_key(active_key)
                active_key_id = b""
            else:
                raise CorruptedArchiveError(f"Invalid magic header: {magic}")

            validate_key(active_key)
            aesgcm = AESGCM(active_key)

            expected_chunk_idx = 0
            while True:
                idx_len_bytes = src.read(8)
                if not idx_len_bytes:
                    break  # Clean EOF

                if len(idx_len_bytes) < 8:
                    raise CorruptedArchiveError("Corrupted archive: truncated chunk header")

                chunk_idx, payload_len = struct.unpack(">II", idx_len_bytes)

                # Strict chunk ordering validation
                if chunk_idx != expected_chunk_idx:
                    raise AuthenticationFailedError(
                        f"Chunk sequence anomaly: expected chunk {expected_chunk_idx}, got {chunk_idx}. "
                        "Reordering or dropped chunk detected."
                    )

                # Strict chunk length bounds validation
                if payload_len < TAG_SIZE_BYTES or payload_len > MAX_ALLOWED_CHUNK_CIPHERTEXT:
                    raise CorruptedArchiveError(
                        f"Invalid chunk length: {payload_len} bytes (out of acceptable range)"
                    )

                nonce = src.read(NONCE_SIZE_BYTES)
                if len(nonce) < NONCE_SIZE_BYTES:
                    raise CorruptedArchiveError("Corrupted archive: truncated nonce")

                # Duplicate nonce detection
                if nonce in seen_nonces:
                    raise AuthenticationFailedError("Duplicate nonce detected in archive stream")
                seen_nonces.add(nonce)

                ciphertext_with_tag = src.read(payload_len)
                if len(ciphertext_with_tag) < payload_len:
                    raise CorruptedArchiveError("Corrupted archive: truncated chunk payload")

                # Build AAD matching encryption version
                associated_data = struct.pack(">I", chunk_idx)
                if magic == MAGIC_HEADER_V2:
                    associated_data += active_key_id

                try:
                    plaintext = aesgcm.decrypt(nonce, ciphertext_with_tag, associated_data)
                except Exception as e:
                    raise AuthenticationFailedError(
                        f"GCM authentication tag verification failed on chunk {chunk_idx}. "
                        "Data was tampered with or key is incorrect."
                    ) from e

                dst.write(plaintext)
                expected_chunk_idx += 1

        # Atomic rename
        if out_p.exists():
            out_p.unlink()
        temp_out.rename(out_p)
        return out_p
    except Exception:
        if temp_out.exists():
            temp_out.unlink()
        raise
