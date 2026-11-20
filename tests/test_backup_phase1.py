"""Automated Test Suite for Selloi Backup System - Phase 1.

Verifies all 13 required test categories:
1. Synthetic database backup
2. Media archive backup
3. Encryption/decryption round-trip
4. Incorrect key rejection
5. Corrupted artifact rejection
6. SHA-256 mismatch detection
7. Interrupted upload handling
8. Duplicate backup handling
9. Local destination verification
10. R2 adapter tests
11. Google Drive adapter tests
12. Retention dry-run evaluation
13. Isolated PostgreSQL 17 restore and incompatible engine rejection
"""

import os
import shutil
import tempfile
import pytest
from pathlib import Path
from datetime import datetime, timezone, timedelta

from selloi_backup.config import BackupConfig, DatabaseConfig, StorageConfig, RetentionConfig
from selloi_backup.backup_crypto import (
    generate_key,
    save_key,
    load_key,
    encrypt_file,
    decrypt_file,
    AuthenticationFailedError,
    InvalidKeyError,
    CryptoError
)
from selloi_backup.integrity import (
    calculate_sha256,
    calculate_bytes_sha256,
    write_sha256_file,
    verify_sha256_file,
    verify_file_hash,
    IntegrityError
)
from selloi_backup.postgres_backup import (
    dump_database,
    create_synthetic_dump,
    inspect_pooler_compatibility,
    validate_client_version
)
from selloi_backup.media_backup import package_media_directory
from selloi_backup.manifest import create_manifest, save_manifest, load_manifest, ManifestError
from selloi_backup.storage_base import StorageAdapterError
from selloi_backup.storage_local import LocalStorageAdapter
from selloi_backup.storage_r2 import R2StorageAdapter
from selloi_backup.storage_gdrive import GDriveStorageAdapter
from selloi_backup.restore_validator import (
    verify_decryption_and_artifact,
    validate_target_engine_version,
    IncompatibleEngineError,
    RestoreValidationError
)
from selloi_backup.retention import RetentionManager
from selloi_backup.backup_orchestrator import BackupOrchestrator


@pytest.fixture
def temp_workspace():
    """Create a temporary workspace for isolated test execution."""
    temp_dir = tempfile.mkdtemp(prefix="selloi_test_")
    yield Path(temp_dir)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def master_key():
    """Generate a valid 256-bit AES-GCM key."""
    return generate_key()


# Test 1: Synthetic Database Backup
def test_synthetic_database_backup(temp_workspace):
    dump_path = temp_workspace / "test_aisales.dump"
    db_config = DatabaseConfig(host="localhost", port=5432, database="aisales_synthetic")

    out_file = dump_database(
        db_config=db_config,
        output_path=dump_path,
        mock_mode=True,
        extra_metadata={"project_id": "ganlawuubihxinuwjvez"}
    )

    assert out_file.is_file()
    assert out_file.stat().st_size > 0
    with open(out_file, "rb") as f:
        header = f.read(5)
        assert header == b"PGDMP"


# Test 2: Media Archive Backup
def test_media_archive_backup(temp_workspace):
    # Create fake media directory
    media_dir = temp_workspace / "channel_images"
    channel_dir = media_dir / "test_channel"
    channel_dir.mkdir(parents=True)
    (channel_dir / "1.jpg").write_bytes(b"\xff\xd8\xff\xe0" + b"fake_jpg_content_1")
    (channel_dir / "2.jpg").write_bytes(b"\xff\xd8\xff\xe0" + b"fake_jpg_content_2")

    archive_path = temp_workspace / "media.tar.gz"
    meta = package_media_directory(media_dir, archive_path)

    assert archive_path.is_file()
    assert meta["file_count"] == 2
    assert meta["archive_size_bytes"] > 0
    assert meta["total_uncompressed_bytes"] > 0


# Test 3: Encryption/Decryption Round-Trip
def test_encryption_decryption_roundtrip(temp_workspace, master_key):
    orig_file = temp_workspace / "plaintext.dat"
    orig_content = b"Selloi production payload data for backup roundtrip verification!" * 500
    orig_file.write_bytes(orig_content)

    enc_file = temp_workspace / "encrypted.dat.enc"
    dec_file = temp_workspace / "decrypted.dat"

    # Encrypt
    encrypt_file(orig_file, enc_file, master_key)
    assert enc_file.is_file()
    assert enc_file.read_bytes() != orig_content

    # Decrypt
    decrypt_file(enc_file, dec_file, master_key)
    assert dec_file.is_file()
    assert dec_file.read_bytes() == orig_content


# Test 4: Incorrect Key Rejection
def test_incorrect_key_rejection(temp_workspace, master_key):
    orig_file = temp_workspace / "plaintext.dat"
    orig_file.write_bytes(b"Super secret customer data")

    enc_file = temp_workspace / "encrypted.dat.enc"
    dec_file = temp_workspace / "decrypted.dat"

    encrypt_file(orig_file, enc_file, master_key)

    wrong_key = generate_key()
    with pytest.raises(AuthenticationFailedError):
        decrypt_file(enc_file, dec_file, wrong_key)

    assert not dec_file.exists()


# Test 5: Corrupted Artifact Rejection
def test_corrupted_artifact_rejection(temp_workspace, master_key):
    orig_file = temp_workspace / "plaintext.dat"
    orig_file.write_bytes(b"Sensitive transaction data")

    enc_file = temp_workspace / "encrypted.dat.enc"
    dec_file = temp_workspace / "decrypted.dat"

    encrypt_file(orig_file, enc_file, master_key)

    # Tamper with encrypted bytes (flip a single bit)
    raw = bytearray(enc_file.read_bytes())
    raw[-1] ^= 0x01
    enc_file.write_bytes(bytes(raw))

    with pytest.raises(AuthenticationFailedError):
        decrypt_file(enc_file, dec_file, master_key)

    assert not dec_file.exists()


# Test 6: SHA-256 Mismatch Detection
def test_sha256_mismatch_detection(temp_workspace):
    test_file = temp_workspace / "data.bin"
    test_file.write_bytes(b"Hello SHA256")

    real_hash = calculate_sha256(test_file)
    assert verify_file_hash(test_file, real_hash)

    fake_hash = "0000000000000000000000000000000000000000000000000000000000000000"
    assert not verify_file_hash(test_file, fake_hash)


# Test 7: Interrupted Upload Handling
def test_interrupted_upload_handling(temp_workspace):
    local_storage = LocalStorageAdapter(temp_workspace / "local_store")
    src_file = temp_workspace / "sample.dump.enc"
    src_file.write_bytes(b"dump content")
    correct_sha = calculate_sha256(src_file)

    # Provide intentionally incorrect hash to simulate corrupted/interrupted transfer
    corrupted_sha = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    with pytest.raises(StorageAdapterError):
        local_storage.upload_file(src_file, "sample.dump.enc", corrupted_sha)

    # Verify no partial/corrupted artifact remains in destination
    dest = (temp_workspace / "local_store" / "sample.dump.enc")
    assert not dest.exists()
    assert not (temp_workspace / "local_store" / "sample.dump.enc.tmp").exists()


# Test 8: Duplicate Backup Handling
def test_duplicate_backup_handling(temp_workspace):
    local_storage = LocalStorageAdapter(temp_workspace / "local_store")
    src_file = temp_workspace / "backup_v1.dump.enc"
    src_file.write_bytes(b"initial version")
    sha1 = calculate_sha256(src_file)

    # First upload
    res1 = local_storage.upload_file(src_file, "backup_v1.dump.enc", sha1)
    assert res1["status"] == "VERIFIED"

    # Second upload of the same filename (overwrite protection/atomic update)
    src_file.write_bytes(b"updated content")
    sha2 = calculate_sha256(src_file)
    res2 = local_storage.upload_file(src_file, "backup_v1.dump.enc", sha2)
    assert res2["status"] == "VERIFIED"
    assert res2["size_bytes"] == len(b"updated content")


# Test 9: Local Destination Verification
def test_local_destination_verification(temp_workspace):
    local_dir = temp_workspace / "vault"
    adapter = LocalStorageAdapter(local_dir)

    src = temp_workspace / "test.enc"
    src.write_bytes(b"encrypted blob")
    sha = calculate_sha256(src)

    res = adapter.upload_file(src, "test.enc", sha)
    assert res["status"] == "VERIFIED"
    assert adapter.verify_remote_artifact("test.enc", src.stat().st_size, sha)
    assert not adapter.verify_remote_artifact("test.enc", 9999, sha)


# Test 10: R2 Adapter Tests (Mock Mode)
def test_r2_adapter_upload_and_verify(temp_workspace):
    adapter = R2StorageAdapter(
        endpoint_url="https://fake.r2.cloudflarestorage.com",
        bucket_name="selloi-test",
        mock_mode=True
    )
    src = temp_workspace / "archive.enc"
    src.write_bytes(b"R2 encrypted payload")
    sha = calculate_sha256(src)

    res = adapter.upload_file(src, "archive.enc", sha)
    assert res["status"] == "VERIFIED"
    assert res["destination"] == "r2"

    # Verify remote artifact check
    assert adapter.verify_remote_artifact("archive.enc", src.stat().st_size, sha)

    # Test download
    dl_path = temp_workspace / "downloaded.enc"
    adapter.download_file("archive.enc", dl_path)
    assert dl_path.read_bytes() == b"R2 encrypted payload"


# Test 11: Google Drive Adapter Tests (Mock Mode)
def test_gdrive_adapter_upload_and_verify(temp_workspace):
    adapter = GDriveStorageAdapter(
        folder_id="mock_folder_123",
        mock_mode=True
    )
    src = temp_workspace / "gdrive_test.enc"
    src.write_bytes(b"GDrive test archive bytes")
    sha = calculate_sha256(src)

    res = adapter.upload_file(src, "gdrive_test.enc", sha)
    assert res["status"] == "VERIFIED"
    assert res["destination"] == "gdrive"
    assert adapter.verify_remote_artifact("gdrive_test.enc", src.stat().st_size, sha)

    # Test download
    dl_path = temp_workspace / "gdrive_downloaded.enc"
    adapter.download_file("gdrive_test.enc", dl_path)
    assert dl_path.read_bytes() == b"GDrive test archive bytes"


# Test 12: Retention Dry-Run Evaluation
def test_retention_dry_run():
    retention_mgr = RetentionManager(daily_days=30, weekly_weeks=8, monthly_months=12, dry_run=True)
    now = datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc)

    # Generate synthetic backup timestamps
    backups = [
        {"name": "recent_1", "timestamp": (now - timedelta(days=2)).isoformat()},
        {"name": "recent_29", "timestamp": (now - timedelta(days=29)).isoformat()},
        {"name": "weekly_5", "timestamp": (now - timedelta(days=35)).isoformat()},
        {"name": "monthly_6", "timestamp": (now - timedelta(days=150)).isoformat()},
        {"name": "expired_old", "timestamp": (now - timedelta(days=500)).isoformat()},
    ]

    plan = retention_mgr.evaluate_retention(backups, now_utc=now)
    assert plan["dry_run"] is True
    assert plan["total_backups"] == 5
    assert plan["retained_count"] == 4
    assert plan["expired_count"] == 1
    assert any(b["name"] == "expired_old" for b in plan["expired"])


# Test 13: Isolated PostgreSQL 17 Restore and Incompatible Engine Rejection
def test_isolated_postgres17_restore_and_incompatible_engine_rejection(temp_workspace, master_key):
    # 1. Compatible engine validation (PG 17 -> PG 17)
    validate_target_engine_version(target_major_version=17, dump_major_version=17)

    # 2. Incompatible engine rejection (PG 17 -> PG 16 must raise IncompatibleEngineError)
    with pytest.raises(IncompatibleEngineError):
        validate_target_engine_version(target_major_version=16, dump_major_version=17)

    # 3. Test decrypt and validate synthetic dump
    dump_raw = temp_workspace / "pg17_synth.dump"
    create_synthetic_dump(dump_raw, {"project_id": "test"})
    dump_raw_sha = calculate_sha256(dump_raw)

    dump_enc = temp_workspace / "pg17_synth.dump.enc"
    encrypt_file(dump_raw, dump_enc, master_key)

    val_res = verify_decryption_and_artifact(
        encrypted_path=dump_enc,
        expected_plaintext_sha256=dump_raw_sha,
        key=master_key,
        work_dir=temp_workspace / "restore_test",
        mock_mode=True
    )
    assert val_res["status"] == "PASSED"
    assert val_res["gcm_tag_verified"] is True
    assert val_res["plaintext_sha256_verified"] is True


# Test 14: End-to-End Orchestrator Execution
def test_orchestrator_end_to_end_flow(temp_workspace, master_key):
    media_dir = temp_workspace / "media"
    media_dir.mkdir()
    (media_dir / "post1.jpg").write_bytes(b"media_bytes")

    local_vault = temp_workspace / "local_vault"

    cfg = BackupConfig(
        project_id="ganlawuubihxinuwjvez",
        region="eu-west-3",
        media_dir=str(media_dir),
        storage=StorageConfig(
            local_enabled=True,
            local_dir=str(local_vault),
            r2_enabled=True,
            gdrive_enabled=True
        ),
        retention=RetentionConfig(dry_run=True)
    )

    orchestrator = BackupOrchestrator(
        config=cfg,
        encryption_key=master_key,
        mock_mode=True
    )

    res = orchestrator.execute_backup(staging_root=temp_workspace / "stage")
    assert res["status"] == "SUCCESS"
    assert "local" in res["destinations"]
    assert "r2" in res["destinations"]
    assert "gdrive" in res["destinations"]
    assert res["manifest"]["manifest_version"] == "1.0.0"

    # Verify artifacts exist in local vault
    vault_files = list(local_vault.iterdir())
    assert len(vault_files) >= 4  # dump, media, metadata, manifest
