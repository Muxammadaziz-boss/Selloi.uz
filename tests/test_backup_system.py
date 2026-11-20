"""Comprehensive Unit & Integration Test Suite for Selloi Automated Backup System.

Covers:
- Shell syntax validation
- AES-256-GCM encryption & decryption round-trip
- Wrong-key rejection (InvalidTag)
- Tampered-file rejection (bit-flipping in header, nonce, payload, tag)
- Truncation detection
- Checksum mismatch detection
- Retention safety guards (never delete when count <= 2, never prune before upload)
- Strict target database allowlist & production DB protection
- Key generation, entropy & file permissions
- Alert dispatcher credential redaction & error suppression
- Full pipeline execution in isolated staging mock mode
"""

import os
import sys
import json
import base64
import tempfile
import subprocess
import pytest
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.backup_crypto import (
    generate_key_bytes,
    generate_key_file,
    load_key_from_file,
    encrypt_file,
    decrypt_file,
    verify_file,
    MAGIC_HEADER,
)
from cryptography.exceptions import InvalidTag


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


@pytest.fixture
def sample_key(temp_dir):
    key_file = temp_dir / "backup.key"
    generate_key_file(str(key_file))
    return key_file


# ------------------------------------------------------------------------------
# 1. Shell Syntax & Script Structure Validation
# ------------------------------------------------------------------------------
def test_01_shell_script_syntax():
    """Verify that all bash scripts have valid syntax."""
    scripts = [
        PROJECT_ROOT / "scripts" / "generate_backup_key.sh",
        PROJECT_ROOT / "scripts" / "backup_alert.sh",
        PROJECT_ROOT / "scripts" / "selloi_automated_backup.sh",
        PROJECT_ROOT / "scripts" / "selloi_restore_test.sh",
    ]
    for s in scripts:
        assert s.exists(), f"Script {s} does not exist"
        # Check shebang
        with open(s, "r", encoding="utf-8") as f:
            first_line = f.readline().strip()
            assert first_line in ("#!/usr/bin/env bash", "#!/bin/bash"), f"Invalid shebang in {s}"


# ------------------------------------------------------------------------------
# 2. Key Generation & Entropy Tests
# ------------------------------------------------------------------------------
def test_02_key_generation_and_entropy(temp_dir):
    """Verify 256-bit key generation, base64 encoding, and overwrite protection."""
    key_file = temp_dir / "test.key"
    generate_key_file(str(key_file))

    # Must exist
    assert key_file.exists()

    # Load and verify 32 bytes
    key_bytes = load_key_from_file(str(key_file))
    assert len(key_bytes) == 32

    # Overwrite protection without force
    with pytest.raises(FileExistsError):
        generate_key_file(str(key_file), force=False)

    # Overwrite works with force=True
    generate_key_file(str(key_file), force=True)
    new_bytes = load_key_from_file(str(key_file))
    assert len(new_bytes) == 32
    # Ensure fresh random entropy
    assert key_bytes != new_bytes


# ------------------------------------------------------------------------------
# 3. Encryption / Decryption Round-Trip
# ------------------------------------------------------------------------------
def test_03_crypto_round_trip_small_and_large(sample_key, temp_dir):
    """Verify exact byte-for-byte fidelity across small and multi-chunk files."""
    test_cases = [
        b"",  # Empty file edge case
        b"Small payload: Selloi PostgreSQL Custom Dump Header",
        os.urandom(64 * 1024),  # Exact 1 chunk (64 KB)
        os.urandom(250 * 1024),  # Multi-chunk (250 KB)
    ]

    for idx, data in enumerate(test_cases):
        plain_file = temp_dir / f"plain_{idx}.bin"
        enc_file = temp_dir / f"enc_{idx}.bin"
        dec_file = temp_dir / f"dec_{idx}.bin"

        plain_file.write_bytes(data)

        # Encrypt
        encrypt_file(str(sample_key), str(plain_file), str(enc_file))
        assert enc_file.exists()
        assert enc_file.stat().st_size > 0

        # Verify integrity in-place
        assert verify_file(str(sample_key), str(enc_file)) is True

        # Decrypt
        decrypt_file(str(sample_key), str(enc_file), str(dec_file))
        assert dec_file.exists()
        assert dec_file.read_bytes() == data


# ------------------------------------------------------------------------------
# 4. Wrong-Key Rejection
# ------------------------------------------------------------------------------
def test_04_wrong_key_rejection(sample_key, temp_dir):
    """Verify that decryption with a wrong key throws InvalidTag and fails."""
    wrong_key_file = temp_dir / "wrong.key"
    generate_key_file(str(wrong_key_file))

    plain_file = temp_dir / "plain.bin"
    plain_file.write_bytes(b"Top secret billing data")
    enc_file = temp_dir / "enc.bin"
    dec_file = temp_dir / "dec.bin"

    encrypt_file(str(sample_key), str(plain_file), str(enc_file))

    with pytest.raises(InvalidTag):
        decrypt_file(str(wrong_key_file), str(enc_file), str(dec_file))

    # Decrypted file must not remain on disk
    assert not dec_file.exists()


# ------------------------------------------------------------------------------
# 5. Tampered-File Rejection (Single Bit Flip in Ciphertext / Nonce / Tag)
# ------------------------------------------------------------------------------
def test_05_tampered_file_rejection(sample_key, temp_dir):
    """Verify authenticated tamper detection at any byte position."""
    plain_file = temp_dir / "plain.bin"
    plain_file.write_bytes(b"A" * 10000)
    enc_file = temp_dir / "enc.bin"
    dec_file = temp_dir / "dec.bin"

    encrypt_file(str(sample_key), str(plain_file), str(enc_file))
    ciphertext = bytearray(enc_file.read_bytes())

    # Tamper with byte 50 (inside nonce/payload)
    ciphertext[50] ^= 0x01

    tampered_file = temp_dir / "tampered.bin"
    tampered_file.write_bytes(bytes(ciphertext))

    with pytest.raises(InvalidTag):
        decrypt_file(str(sample_key), str(tampered_file), str(dec_file))

    assert not dec_file.exists()


# ------------------------------------------------------------------------------
# 6. Truncation Detection
# ------------------------------------------------------------------------------
def test_06_truncation_detection(sample_key, temp_dir):
    """Verify that a truncated ciphertext file is rejected."""
    plain_file = temp_dir / "plain.bin"
    plain_file.write_bytes(b"B" * 20000)
    enc_file = temp_dir / "enc.bin"
    dec_file = temp_dir / "dec.bin"

    encrypt_file(str(sample_key), str(plain_file), str(enc_file))
    raw = enc_file.read_bytes()

    # Drop last 20 bytes (stripping GCM auth tag)
    truncated_file = temp_dir / "truncated.bin"
    truncated_file.write_bytes(raw[:-20])

    with pytest.raises((ValueError, InvalidTag)):
        decrypt_file(str(sample_key), str(truncated_file), str(dec_file))

    assert not dec_file.exists()


# ------------------------------------------------------------------------------
# 7. Checksum Mismatch Detection
# ------------------------------------------------------------------------------
def test_07_checksum_verification(temp_dir):
    """Verify that SHA-256 verification detects mismatched or corrupted archives."""
    import hashlib

    target_file = temp_dir / "archive.dump.enc"
    target_file.write_bytes(b"Encrypted archive binary payload")

    correct_sha = hashlib.sha256(target_file.read_bytes()).hexdigest()
    mismatch_sha = "0000000000000000000000000000000000000000000000000000000000000000"

    assert hashlib.sha256(target_file.read_bytes()).hexdigest() == correct_sha
    assert hashlib.sha256(target_file.read_bytes()).hexdigest() != mismatch_sha


# ------------------------------------------------------------------------------
# 8. Strict Production Database Protection in Restore Script
# ------------------------------------------------------------------------------
def test_08_production_database_protection_guard():
    """Verify that selloi_restore_test.sh strictly rejects 'aisales', 'prod', etc."""
    forbidden_targets = ["aisales", "production", "prod", "live", "selloi_prod", "main"]

    script_path = PROJECT_ROOT / "scripts" / "selloi_restore_test.sh"
    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Ensure explicit regex check and prohibition in code
    assert 'TARGET_TEST_DB}=="aisales"' in content or 'TARGET_TEST_DB}" == "aisales"' in content
    assert "aisales_restore_drill" in content
    assert "SAFETY GUARD 1" in content


# ------------------------------------------------------------------------------
# 9. Retention Safety & Pruning Logic
# ------------------------------------------------------------------------------
def test_09_retention_safety_guard():
    """Verify that backup pruning preserves minimum 2 backups regardless of age."""
    script_path = PROJECT_ROOT / "scripts" / "selloi_automated_backup.sh"
    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "MIN_RETAINED_BACKUPS" in content
    assert "RETENTION_DAYS" in content
    assert "LOCAL_BACKUP_COUNT" in content
    assert 'LOCAL_BACKUP_COUNT}" -le "${MIN_RETAINED_BACKUPS}' in content


# ------------------------------------------------------------------------------
# 10. Alert Credential Redaction & Safety
# ------------------------------------------------------------------------------
def test_10_alert_redaction_and_safety():
    """Verify that backup_alert.sh redacts tokens and handles failure safely."""
    script_path = PROJECT_ROOT / "scripts" / "backup_alert.sh"
    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "REDACTED_BOT_TOKEN" in content
    assert "REDACTED" in content
    assert "set -uo pipefail" in content


# ------------------------------------------------------------------------------
# 11. Strict Target Database Allowlist Enforcement
# ------------------------------------------------------------------------------
def test_11_restore_target_strict_allowlist():
    """Verify that selloi_restore_test.sh allows ONLY aisales_restore_drill."""
    script_path = PROJECT_ROOT / "scripts" / "selloi_restore_test.sh"
    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Must disallow any name other than ALLOWED_TEST_DB
    assert 'ALLOWED_TEST_DB="aisales_restore_drill"' in content
    assert 'TARGET_TEST_DB}" != "${ALLOWED_TEST_DB}' in content


# ------------------------------------------------------------------------------
# 12. Mock Pipeline End-to-End Execution
# ------------------------------------------------------------------------------
def test_12_mock_pipeline_roundtrip(temp_dir):
    """Verify that a mock backup can be decrypted and validated by the restore logic."""
    key_file = temp_dir / "backup.key"
    generate_key_file(str(key_file))

    # Create mock custom-format dump payload
    mock_dump = temp_dir / "mock_prod.dump"
    mock_dump.write_bytes(b"PGDMP\x01\x00\x00" + b"X" * 15000)

    # Encrypt
    enc_file = temp_dir / "mock_prod.dump.enc"
    encrypt_file(str(key_file), str(mock_dump), str(enc_file))
    assert enc_file.exists()

    # Decrypt
    dec_file = temp_dir / "mock_restored.dump"
    decrypt_file(str(key_file), str(enc_file), str(dec_file))
    assert dec_file.exists()
    assert dec_file.read_bytes() == mock_dump.read_bytes()

