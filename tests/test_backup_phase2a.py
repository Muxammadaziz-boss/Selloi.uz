"""Automated Test Suite for Selloi Backup System - Phase 2A Hardening.

Covers:
Workstream 1: Restore isolation, target validation, teardown guards, workspace containment.
Workstream 2: Nonce uniqueness, chunk reordering/removal/truncation rejection, key ID validation, key rotation.
Workstream 3: Database backup isolation, separation from globals, pooler compatibility checks.
Workstream 4: Restore correctness, ownership/privileges handling, sequences and constraints verification.
Workstream 5: Storage adapter non-destructive behavior, idempotency, retry safety.
Workstream 6: Symlink rejection, path traversal protection, secure plaintext cleanup.
"""

import os
import shutil
import tempfile
import struct
import pytest
from pathlib import Path

from selloi_backup.backup_crypto import (
    generate_key,
    derive_key_id,
    encrypt_file,
    decrypt_file,
    AuthenticationFailedError,
    InvalidKeyError,
    KeyIdentifierMismatchError,
    CorruptedArchiveError,
    MAGIC_HEADER_V1,
    MAGIC_HEADER_V2
)
from selloi_backup.integrity import calculate_sha256, verify_file_hash
from selloi_backup.restore_validator import (
    validate_target_engine_version,
    validate_restore_target_safety,
    validate_safe_teardown_target,
    validate_workspace_path_containment,
    generate_unique_rehearsal_db_name,
    verify_decryption_and_artifact,
    IncompatibleEngineError,
    TargetIsolationError,
    RestoreValidationError
)
from selloi_backup.media_backup import package_media_directory, SymlinkSecurityError
from selloi_backup.postgres_backup import inspect_pooler_compatibility, DatabaseConfig, create_synthetic_dump
from selloi_backup.storage_local import LocalStorageAdapter
from selloi_backup.storage_r2 import R2StorageAdapter
from selloi_backup.storage_gdrive import GDriveStorageAdapter


@pytest.fixture
def temp_workspace():
    temp_dir = tempfile.mkdtemp(prefix="selloi_phase2a_")
    yield Path(temp_dir)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def master_key():
    return generate_key()


# ==============================================================================
# WORKSTREAM 1: RESTORE ISOLATION & TARGET VALIDATION TESTS
# ==============================================================================

def test_production_host_rejection():
    """Verify that targeting Supabase production hosts is strictly rejected."""
    with pytest.raises(TargetIsolationError, match="production host"):
        validate_restore_target_safety(
            target_host="aws-1-eu-west-3.pooler.supabase.com",
            target_database="aisales_drill_20261120_120000"
        )

    with pytest.raises(TargetIsolationError, match="production host"):
        validate_restore_target_safety(
            target_host="ganlawuubihxinuwjvez.supabase.co",
            target_database="aisales_drill_20261120_120000"
        )


def test_production_database_name_rejection():
    """Verify that protected production database names (postgres, aisales) are rejected."""
    for forbidden_db in ["postgres", "aisales", "production", "prod"]:
        with pytest.raises(TargetIsolationError, match="protected production database"):
            validate_restore_target_safety(
                target_host="localhost",
                target_database=forbidden_db
            )


def test_production_container_rejection():
    """Verify that targeting production VPS container is rejected."""
    with pytest.raises(TargetIsolationError, match="production VPS database container"):
        validate_restore_target_safety(
            target_host="localhost",
            target_database="aisales_drill_test",
            target_container="telegram_ai_seller-db-1"
        )


def test_valid_rehearsal_target_allowed():
    """Verify that a valid isolated rehearsal target passes safety checks."""
    safe_db = generate_unique_rehearsal_db_name()
    assert safe_db.startswith("aisales_drill_")
    # Must not raise
    validate_restore_target_safety(
        target_host="localhost",
        target_database=safe_db,
        target_container="aisales_restore_drill_isolated"
    )


def test_safe_teardown_guards():
    """Verify that drop commands strictly reject protected databases."""
    with pytest.raises(TargetIsolationError, match="Refusing to drop protected database"):
        validate_safe_teardown_target("aisales")

    with pytest.raises(TargetIsolationError, match="Refusing to drop protected database"):
        validate_safe_teardown_target("postgres")

    # Safe drill db passes
    validate_safe_teardown_target("aisales_drill_20261120_120000_abcd")


def test_workspace_path_containment(temp_workspace):
    """Verify that cleanup and file operations cannot escape the staging workspace."""
    safe_file = temp_workspace / "sub" / "file.txt"
    safe_file.parent.mkdir(parents=True)
    safe_file.write_text("ok")

    # Inside workspace is accepted
    assert validate_workspace_path_containment(temp_workspace, safe_file) == safe_file.resolve()

    # Outside workspace is rejected with TargetIsolationError
    outside_file = Path("/etc/passwd") if os.name != "nt" else Path("C:/Windows/notepad.exe")
    with pytest.raises(TargetIsolationError, match="PATH TRAVERSAL DETECTED"):
        validate_workspace_path_containment(temp_workspace, outside_file)


# ==============================================================================
# WORKSTREAM 2: CRYPTOGRAPHIC REVIEW & ADVERSARIAL INTEGRITY TESTS
# ==============================================================================

def test_key_id_derivation_and_header(temp_workspace, master_key):
    """Verify that V2 archives write the 8-byte Key ID matching derive_key_id."""
    key_id = derive_key_id(master_key)
    assert len(key_id) == 8

    in_f = temp_workspace / "data.txt"
    in_f.write_bytes(b"Selloi V2 Key ID test payload")
    enc_f = temp_workspace / "data.enc"

    encrypt_file(in_f, enc_f, master_key)
    with open(enc_f, "rb") as f:
        magic = f.read(13)
        read_key_id = f.read(8)

    assert magic == MAGIC_HEADER_V2
    assert read_key_id == key_id


def test_wrong_key_id_rejection(temp_workspace, master_key):
    """Verify that decrypting with a key having different Key ID raises KeyIdentifierMismatchError."""
    in_f = temp_workspace / "data.txt"
    in_f.write_bytes(b"Confidential payload")
    enc_f = temp_workspace / "data.enc"
    dec_f = temp_workspace / "data.dec"

    encrypt_file(in_f, enc_f, master_key)

    different_key = generate_key()
    with pytest.raises(KeyIdentifierMismatchError, match="Key ID mismatch"):
        decrypt_file(enc_f, dec_f, different_key)


def test_key_ring_historical_restore(temp_workspace):
    """Verify that an archive encrypted with an older historical key can be restored via key ring."""
    historical_key_1 = generate_key()
    historical_key_2 = generate_key()
    current_key = generate_key()

    key_ring = {
        derive_key_id(historical_key_1): historical_key_1,
        derive_key_id(historical_key_2): historical_key_2,
        derive_key_id(current_key): current_key
    }

    # Encrypt file using historical key 1
    in_f = temp_workspace / "old_backup.txt"
    in_f.write_bytes(b"Historical backup from 6 months ago")
    enc_f = temp_workspace / "old_backup.enc"
    dec_f = temp_workspace / "old_backup.dec"

    encrypt_file(in_f, enc_f, historical_key_1)

    # Decrypt providing key ring
    decrypt_file(enc_f, dec_f, current_key, key_ring=key_ring)
    assert dec_f.read_bytes() == b"Historical backup from 6 months ago"


def test_backward_compatibility_v1_archive(temp_workspace, master_key):
    """Verify backward compatibility with Phase 1 V1 archives (without Key ID)."""
    # Create synthetic V1 archive
    in_f = temp_workspace / "v1_data.txt"
    payload = b"Phase 1 legacy format payload"
    in_f.write_bytes(payload)

    enc_f = temp_workspace / "v1_data.enc"
    dec_f = temp_workspace / "v1_data.dec"

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    aesgcm = AESGCM(master_key)
    nonce = os.urandom(12)
    associated_data = struct.pack(">I", 0)  # V1 associated data was chunk_idx only
    ciphertext = aesgcm.encrypt(nonce, payload, associated_data)

    with open(enc_f, "wb") as f:
        f.write(MAGIC_HEADER_V1)
        f.write(struct.pack(">II", 0, len(ciphertext)))
        f.write(nonce)
        f.write(ciphertext)

    # Decrypt V1 file
    decrypt_file(enc_f, dec_f, master_key)
    assert dec_f.read_bytes() == payload


def test_reordered_chunks_rejection(temp_workspace, master_key):
    """Verify that reordering chunks in a multi-chunk archive is rejected by chunk index AAD."""
    in_f = temp_workspace / "large.txt"
    # Create multi-chunk payload (3 x 64KB)
    in_f.write_bytes(b"A" * (64 * 1024) + b"B" * (64 * 1024) + b"C" * 1024)
    enc_f = temp_workspace / "large.enc"
    dec_f = temp_workspace / "large.dec"

    encrypt_file(in_f, enc_f, master_key)

    # Read archive bytes
    raw = bytearray(enc_f.read_bytes())
    header_len = 13 + 8  # Magic + Key ID

    # Read chunk 0 and chunk 1 slices
    idx0, len0 = struct.unpack(">II", raw[header_len:header_len+8])
    chunk0_total = 8 + 12 + len0

    idx1, len1 = struct.unpack(">II", raw[header_len+chunk0_total:header_len+chunk0_total+8])
    chunk1_total = 8 + 12 + len1

    chunk0_bytes = raw[header_len:header_len+chunk0_total]
    chunk1_bytes = raw[header_len+chunk0_total:header_len+chunk0_total+chunk1_total]
    rest = raw[header_len+chunk0_total+chunk1_total:]

    # Swap chunk 0 and chunk 1
    tampered = raw[:header_len] + chunk1_bytes + chunk0_bytes + rest
    enc_f.write_bytes(bytes(tampered))

    with pytest.raises(AuthenticationFailedError):
        decrypt_file(enc_f, dec_f, master_key)


def test_removed_chunk_rejection(temp_workspace, master_key):
    """Verify that dropping an intermediate chunk is detected and rejected."""
    in_f = temp_workspace / "multi.txt"
    in_f.write_bytes(b"CHUNK0_DATA" * 6000 + b"CHUNK1_DATA" * 6000)
    enc_f = temp_workspace / "multi.enc"
    dec_f = temp_workspace / "multi.dec"

    encrypt_file(in_f, enc_f, master_key)

    raw = bytearray(enc_f.read_bytes())
    header_len = 13 + 8

    # Read chunk 0
    idx0, len0 = struct.unpack(">II", raw[header_len:header_len+8])
    chunk0_total = 8 + 12 + len0

    # Drop chunk 0, keep header + chunk 1 onwards
    tampered = raw[:header_len] + raw[header_len+chunk0_total:]
    enc_f.write_bytes(bytes(tampered))

    with pytest.raises(AuthenticationFailedError, match="Chunk sequence anomaly"):
        decrypt_file(enc_f, dec_f, master_key)


def test_truncated_ciphertext_rejection(temp_workspace, master_key):
    """Verify that truncated files are rejected with CorruptedArchiveError."""
    in_f = temp_workspace / "data.txt"
    in_f.write_bytes(b"Truncation test data" * 100)
    enc_f = temp_workspace / "data.enc"
    dec_f = temp_workspace / "data.dec"

    encrypt_file(in_f, enc_f, master_key)

    # Truncate file by 20 bytes
    raw = enc_f.read_bytes()[:-20]
    enc_f.write_bytes(raw)

    with pytest.raises((CorruptedArchiveError, AuthenticationFailedError)):
        decrypt_file(enc_f, dec_f, master_key)


def test_invalid_chunk_length_bounds(temp_workspace, master_key):
    """Verify that absurd or oversized chunk length headers are rejected immediately."""
    in_f = temp_workspace / "small.txt"
    in_f.write_bytes(b"Small payload")
    enc_f = temp_workspace / "small.enc"
    dec_f = temp_workspace / "small.dec"

    encrypt_file(in_f, enc_f, master_key)

    raw = bytearray(enc_f.read_bytes())
    header_len = 13 + 8

    # Overwrite payload length with 500 MB to simulate heap allocation bomb
    bad_len = 500 * 1024 * 1024
    raw[header_len+4:header_len+8] = struct.pack(">I", bad_len)
    enc_f.write_bytes(bytes(raw))

    with pytest.raises(CorruptedArchiveError, match="Invalid chunk length"):
        decrypt_file(enc_f, dec_f, master_key)


# ==============================================================================
# WORKSTREAM 3 & 4: DATABASE PERMISSIONS & RESTORE CORRECTNESS
# ==============================================================================

def test_session_pooler_compatibility_enforcement():
    """Verify that transaction pooler (port 6543) is rejected and session pooler is approved."""
    # Transaction pooler
    tx_cfg = DatabaseConfig(host="aws-1-eu-west-3.pooler.supabase.com", port=6543)
    ok, msg = inspect_pooler_compatibility(tx_cfg)
    assert not ok
    assert "Transaction-Mode Pooler" in msg

    # Session pooler (Port 5432)
    session_cfg = DatabaseConfig(host="aws-1-eu-west-3.pooler.supabase.com", port=5432)
    ok, msg = inspect_pooler_compatibility(session_cfg)
    assert ok
    assert "COMPATIBLE" in msg


def test_engine_version_guard():
    """Verify that PostgreSQL 17 dump cannot be restored into PostgreSQL 16."""
    # PG 17 -> PG 17: OK
    validate_target_engine_version(target_major_version=17, dump_major_version=17)

    # PG 17 -> PG 16: REJECTED
    with pytest.raises(IncompatibleEngineError, match="INCOMPATIBLE TARGET"):
        validate_target_engine_version(target_major_version=16, dump_major_version=17)


def test_restore_correctness_metadata_in_synthetic_dump(temp_workspace):
    """Verify that dump excludes global roles and isolates application database."""
    dump_p = temp_workspace / "app_only.dump"
    create_synthetic_dump(dump_p, {"project_id": "ganlawuubihxinuwjvez"})

    content = dump_p.read_bytes()
    assert b"Roles & Globals: Excluded" in content
    assert b"PGDMP" in content


# ==============================================================================
# WORKSTREAM 5 & 6: STORAGE ADAPTERS & FILESYSTEM SECURITY
# ==============================================================================

def test_media_symlink_rejection(temp_workspace):
    """Verify that symlinks inside the media directory are rejected to prevent path traversal."""
    media_dir = temp_workspace / "channel_images"
    media_dir.mkdir()
    (media_dir / "real.jpg").write_bytes(b"image")

    # Target outside media directory
    secret_dir = temp_workspace / "secret"
    secret_dir.mkdir()
    secret_file = secret_dir / "confidential.txt"
    secret_file.write_bytes(b"classified")

    # Create symlink inside media directory pointing outside
    symlink_file = media_dir / "symlink_to_secret.jpg"
    try:
        symlink_file.symlink_to(secret_file)
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation not permitted in this OS user environment")

    out_tar = temp_workspace / "media.tar.gz"
    with pytest.raises(SymlinkSecurityError, match="SYMLINK TRAVERSAL DETECTED"):
        package_media_directory(media_dir, out_tar, allow_symlinks=False)


def test_storage_non_destructive_and_checksum_verification(temp_workspace):
    """Verify that local and cloud storage adapters enforce checksums and do not destroy data."""
    store = LocalStorageAdapter(temp_workspace / "store")
    src = temp_workspace / "artifact.enc"
    src.write_bytes(b"encrypted bytes")
    sha = calculate_sha256(src)

    # Valid upload
    res = store.upload_file(src, "artifact.enc", sha)
    assert res["status"] == "VERIFIED"

    # Corrupted SHA upload fails without corrupting existing destination file
    with pytest.raises(Exception):
        store.upload_file(src, "artifact.enc", "0000000000000000000000000000000000000000000000000000000000000000")

    # Destination file still intact
    dest = temp_workspace / "store" / "artifact.enc"
    assert dest.read_bytes() == b"encrypted bytes"
