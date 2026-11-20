#!/usr/bin/env python3
"""Selloi Backup Cryptography Engine.

Authenticated File Encryption & Decryption using AES-256-GCM.
Provides:
- 256-bit symmetric encryption
- 128-bit authentication tag per block (tamper detection)
- Chunked AEAD streaming (O(1) memory footprint)
- Truncation & reordering resistance via index & EOF flags in AAD
- Standalone CLI interface for shell backup integration
"""

import os
import sys
import argparse
import base64
import struct
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

MAGIC_HEADER = b"SELLOI_GCM_V1\n"
CHUNK_SIZE = 64 * 1024  # 64 KB plaintext blocks
NONCE_SIZE = 12  # 96-bit AES-GCM standard nonce


def generate_key_bytes() -> bytes:
    """Generate 32 cryptographically secure random bytes (256-bit key)."""
    return os.urandom(32)


def generate_key_file(output_path: str, force: bool = False) -> str:
    """Generate a high-entropy 256-bit key and save it base64-encoded to a file."""
    if os.path.exists(output_path):
        if not force:
            raise FileExistsError(f"Key file '{output_path}' already exists. Use --force to overwrite.")
        try:
            os.chmod(output_path, 0o600)
            os.remove(output_path)
        except OSError:
            pass

    key_bytes = generate_key_bytes()
    key_b64 = base64.b64encode(key_bytes).decode("ascii")

    # Ensure parent directory exists
    parent_dir = os.path.dirname(output_path)
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, mode=0o700, exist_ok=True)

    # Write key with strict 0600 / 0400 permissions
    fd = os.open(output_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o400)
    with os.fdopen(fd, "w") as f:
        f.write(f"# Selloi Backup AES-256-GCM Key\n# Generated at: {os.environ.get('KEY_GEN_TIME', 'auto')}\n{key_b64}\n")

    return output_path


def load_key_from_file(key_path: str) -> bytes:
    """Load and validate a 32-byte key from a base64 key file or raw binary file."""
    if not os.path.exists(key_path):
        raise FileNotFoundError(f"Key file '{key_path}' does not exist.")

    with open(key_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    if not lines:
        raise ValueError(f"Key file '{key_path}' is empty or contains no valid key data.")

    raw_val = lines[0]
    try:
        key_bytes = base64.b64decode(raw_val)
    except Exception:
        key_bytes = raw_val.encode("utf-8")

    if len(key_bytes) != 32:
        raise ValueError(f"Invalid key length: expected 32 bytes (256-bit), got {len(key_bytes)} bytes.")

    return key_bytes


def _derive_chunk_nonce(base_nonce: bytes, chunk_index: int) -> bytes:
    """Derive a unique 12-byte nonce for each chunk from the base nonce and chunk index."""
    # XOR the last 8 bytes of base_nonce with the 64-bit big-endian chunk index
    counter_bytes = struct.pack(">Q", chunk_index)
    prefix = base_nonce[:4]
    suffix = bytes(a ^ b for a, b in zip(base_nonce[4:], counter_bytes))
    return prefix + suffix


def encrypt_stream(key: bytes, in_file, out_file):
    """Encrypt input stream to output stream using chunked AES-256-GCM."""
    aesgcm = AESGCM(key)
    base_nonce = os.urandom(NONCE_SIZE)

    # Write header
    out_file.write(MAGIC_HEADER)
    out_file.write(base_nonce)

    chunk_index = 0
    chunk = in_file.read(CHUNK_SIZE)

    if not chunk:
        # Empty file edge case: emit 1 final empty block with EOF flag
        nonce = _derive_chunk_nonce(base_nonce, 0)
        aad = b"SELLOI_CHUNK_" + struct.pack(">Q", 0) + b"\x01"
        enc = aesgcm.encrypt(nonce, b"", aad)
        out_file.write(struct.pack(">I", len(enc)))
        out_file.write(enc)
        return

    while chunk:
        next_chunk = in_file.read(CHUNK_SIZE)
        is_last = (len(next_chunk) == 0)

        nonce = _derive_chunk_nonce(base_nonce, chunk_index)
        aad = b"SELLOI_CHUNK_" + struct.pack(">Q", chunk_index) + (b"\x01" if is_last else b"\x00")
        enc = aesgcm.encrypt(nonce, chunk, aad)

        out_file.write(struct.pack(">I", len(enc)))
        out_file.write(enc)

        chunk_index += 1
        chunk = next_chunk


def decrypt_stream(key: bytes, in_file, out_file):
    """Decrypt input stream to output stream, strictly verifying AES-GCM authentication tags."""
    magic = in_file.read(len(MAGIC_HEADER))
    if magic != MAGIC_HEADER:
        raise ValueError(f"Invalid file format: magic header mismatch. Found: {magic!r}")

    base_nonce = in_file.read(NONCE_SIZE)
    if len(base_nonce) != NONCE_SIZE:
        raise ValueError("Truncated file: missing or incomplete base nonce.")

    aesgcm = AESGCM(key)
    chunk_index = 0
    seen_eof = False

    while True:
        len_bytes = in_file.read(4)
        if not len_bytes:
            break

        if len(len_bytes) != 4:
            raise ValueError(f"Truncated chunk header at block {chunk_index}.")

        chunk_len = struct.unpack(">I", len_bytes)[0]
        enc_payload = in_file.read(chunk_len)
        if len(enc_payload) != chunk_len:
            raise ValueError(f"Truncated chunk payload at block {chunk_index}: expected {chunk_len}, got {len(enc_payload)}.")

        nonce = _derive_chunk_nonce(base_nonce, chunk_index)

        # Try decrypting with non-final AAD first, then final AAD
        decrypted = None
        aad_final = b"SELLOI_CHUNK_" + struct.pack(">Q", chunk_index) + b"\x01"
        aad_normal = b"SELLOI_CHUNK_" + struct.pack(">Q", chunk_index) + b"\x00"

        try:
            decrypted = aesgcm.decrypt(nonce, enc_payload, aad_normal)
            seen_eof = False
        except InvalidTag:
            try:
                decrypted = aesgcm.decrypt(nonce, enc_payload, aad_final)
                seen_eof = True
            except InvalidTag:
                raise InvalidTag(f"Authentication failed at chunk {chunk_index}: invalid key, tampered data, or corrupted block.")

        out_file.write(decrypted)
        chunk_index += 1

        if seen_eof:
            # Check if there are trailing bytes after legitimate EOF
            trailing = in_file.read(1)
            if trailing:
                raise ValueError("Unexpected trailing bytes detected after EOF chunk.")
            break

    if not seen_eof and chunk_index > 0:
        raise ValueError("Incomplete archive: stream ended without final EOF block (truncation detected).")


def encrypt_file(key_path: str, in_path: str, out_path: str):
    """Encrypt a file from in_path to out_path."""
    key = load_key_from_file(key_path)
    temp_out = f"{out_path}.tmp_{os.getpid()}"
    try:
        with open(in_path, "rb") as fin:
            with open(temp_out, "wb") as fout:
                encrypt_stream(key, fin, fout)
        os.replace(temp_out, out_path)
        os.chmod(out_path, 0o600)
    finally:
        if os.path.exists(temp_out):
            try:
                os.remove(temp_out)
            except OSError:
                pass


def decrypt_file(key_path: str, in_path: str, out_path: str):
    """Decrypt a file from in_path to out_path, ensuring atomic output replacement on success."""
    key = load_key_from_file(key_path)
    temp_out = f"{out_path}.tmp_{os.getpid()}"
    try:
        with open(in_path, "rb") as fin:
            with open(temp_out, "wb") as fout:
                decrypt_stream(key, fin, fout)
        os.replace(temp_out, out_path)
        os.chmod(out_path, 0o600)
    finally:
        if os.path.exists(temp_out):
            try:
                os.remove(temp_out)
            except OSError:
                pass


def verify_file(key_path: str, in_path: str) -> bool:
    """Verify authentication tags across an entire encrypted file without storing output."""
    class NullWriter:
        def write(self, data):
            pass

    key = load_key_from_file(key_path)
    with open(in_path, "rb") as fin:
        decrypt_stream(key, fin, NullWriter())
    return True


def main():
    parser = argparse.ArgumentParser(description="Selloi Backup Cryptography Engine (AES-256-GCM)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # generate-key
    gen_parser = subparsers.add_parser("generate-key", help="Generate a new 256-bit AES-GCM key file")
    gen_parser.add_argument("--out", required=True, help="Destination path for key file")
    gen_parser.add_argument("--force", action="store_true", help="Overwrite existing key file")

    # encrypt
    enc_parser = subparsers.add_parser("encrypt", help="Encrypt a file using AES-256-GCM")
    enc_parser.add_argument("--key-file", required=True, help="Path to key file")
    enc_parser.add_argument("--in", dest="in_path", required=True, help="Path to input plaintext file")
    enc_parser.add_argument("--out", dest="out_path", required=True, help="Path to output encrypted file")

    # decrypt
    dec_parser = subparsers.add_parser("decrypt", help="Decrypt a file using AES-256-GCM")
    dec_parser.add_argument("--key-file", required=True, help="Path to key file")
    dec_parser.add_argument("--in", dest="in_path", required=True, help="Path to input encrypted file")
    dec_parser.add_argument("--out", dest="out_path", required=True, help="Path to output decrypted file")

    # verify
    ver_parser = subparsers.add_parser("verify", help="Verify integrity of an encrypted file without writing output")
    ver_parser.add_argument("--key-file", required=True, help="Path to key file")
    ver_parser.add_argument("--in", dest="in_path", required=True, help="Path to input encrypted file")

    args = parser.parse_args()

    try:
        if args.command == "generate-key":
            generate_key_file(args.out, force=args.force)
            print(f"[OK] Generated AES-256-GCM key at: {args.out}")
        elif args.command == "encrypt":
            encrypt_file(args.key_file, args.in_path, args.out_path)
            print(f"[OK] Encrypted: {args.in_path} -> {args.out_path}")
        elif args.command == "decrypt":
            decrypt_file(args.key_file, args.in_path, args.out_path)
            print(f"[OK] Decrypted: {args.in_path} -> {args.out_path}")
        elif args.command == "verify":
            verify_file(args.key_file, args.in_path)
            print(f"[OK] Integrity verified: {args.in_path}")
    except InvalidTag as e:
        print(f"[ERROR] Authentication tag verification failed: {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"[ERROR] Cryptography operation failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
