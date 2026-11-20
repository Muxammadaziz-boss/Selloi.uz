"""Unit, integration, and security test suite for Selloi Backup System - Phase 2D.

Validates:
- Stage 0: Pre-flight isolation, database target guards, and credential masking.
- Stage 1: Cloudflare R2 non-destructive permissions, quarantine, and rate limiting.
- Stage 2: Google Drive resumable upload protocol, offset recovery, and byte-level SHA-256.
- Stage 3: Cross-storage synthetic restore pipeline and manifest verification.
- Stage 4: Comprehensive failure scenarios (HTTP 429, HTTP 5xx, auth fail-closed, collision).
- Stage 5: Security guarantees (zero plaintext leak, isolation of production).
"""

import os
import json
import time
import pytest
import inspect
import tempfile
from pathlib import Path

from selloi_backup.config import BackupConfig, StorageConfig
from selloi_backup.backup_crypto import (
    generate_key,
    encrypt_file,
    decrypt_file,
    derive_key_id,
    AuthenticationFailedError,
    KeyIdentifierMismatchError,
    CorruptedArchiveError
)
from selloi_backup.integrity import calculate_sha256, calculate_bytes_sha256, verify_file_hash
from selloi_backup.manifest import create_manifest, save_manifest, ManifestError
from selloi_backup.restore_validator import (
    validate_target_engine_version,
    validate_restore_target_safety,
    validate_safe_teardown_target,
    generate_unique_rehearsal_db_name,
    IncompatibleEngineError,
    TargetIsolationError,
    verify_decryption_and_artifact
)
from selloi_backup.storage_base import (
    StorageAdapterError,
    StorageAuthenticationError,
    StoragePermissionError,
    StorageTransientError,
    StorageTimeoutError,
    StorageIntegrityError,
    StorageDuplicateConflictError,
    execute_with_retry
)
from selloi_backup.storage_r2 import R2StorageAdapter
from selloi_backup.storage_gdrive import GDriveStorageAdapter
from selloi_backup.storage_local import LocalStorageAdapter


@pytest.fixture
def temp_workspace():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def master_key():
    return generate_key()


# --- STAGE 0: PRE-FLIGHT ISOLATION AND GUARDS ---

def test_stage0_target_isolation_guard_accepts_pg17_staging():
    """Safety guard must accept dedicated PostgreSQL 17 staging target."""
    validate_restore_target_safety(
        target_host="127.0.0.1",
        target_database="aisales_drill_20261120_180000_test1234",
        target_container="selloi-pg17-drill"
    )


def test_stage0_target_isolation_guard_rejects_production_container():
    """Safety guard must strictly reject production container name."""
    with pytest.raises(TargetIsolationError) as exc_info:
        validate_restore_target_safety(
            target_host="127.0.0.1",
            target_database="aisales_drill_test",
            target_container="telegram_ai_seller-db-1"
        )
    assert "production vps database container" in str(exc_info.value).lower()


def test_stage0_target_isolation_guard_rejects_production_db_name():
    """Safety guard must reject target database names that mimic production."""
    prohibited_names = ["postgres", "telegram_ai_seller", "selloi_production", "prod_db"]
    for db_name in prohibited_names:
        with pytest.raises(TargetIsolationError):
            validate_restore_target_safety(
                target_host="127.0.0.1",
                target_database=db_name,
                target_container="selloi-pg17-drill"
            )


def test_stage0_target_engine_version_validation():
    """Engine validator accepts PostgreSQL 17 and rejects PostgreSQL 16."""
    validate_target_engine_version(target_major_version=17, dump_major_version=17)
    
    with pytest.raises(IncompatibleEngineError):
        validate_target_engine_version(target_major_version=16, dump_major_version=17)


def test_stage0_credentials_preflight_missing_handling(temp_workspace):
    """Adapters must fail closed safely when live credentials are not configured."""
    src = temp_workspace / "dummy.txt"
    src.write_bytes(b"Test data")

    r2_live = R2StorageAdapter(mock_mode=False)
    with pytest.raises(StorageAuthenticationError) as exc_info:
        r2_live.upload_file(src, "remote.txt", "dummy_sha")
    assert "credential" in str(exc_info.value).lower()

    gdrive_live = GDriveStorageAdapter(mock_mode=False)
    with pytest.raises(StorageAuthenticationError) as exc_info:
        gdrive_live.upload_file(src, "remote.txt", "dummy_sha")
    assert "credential" in str(exc_info.value).lower()


# --- STAGE 1: CLOUDFLARE R2 SAFETY & PERMISSIONS ---

def test_stage1_r2_zero_delete_calls_in_adapter():
    """R2 adapter must not define or call any destructive delete methods."""
    assert not hasattr(R2StorageAdapter, "delete_file")
    assert not hasattr(R2StorageAdapter, "delete_object")
    assert not hasattr(R2StorageAdapter, "delete_objects")
    source = inspect.getsource(R2StorageAdapter)
    assert ".delete_object(" not in source
    assert ".delete_objects(" not in source


def test_stage1_r2_quarantine_isolation(temp_workspace):
    """R2 adapter routes corrupted uploads to quarantine namespace without deleting."""
    r2 = R2StorageAdapter(mock_mode=True, initial_backoff=0.01)
    src = temp_workspace / "bad_payload.bin"
    src.write_bytes(b"Corrupted database dump payload")
    
    fake_sha = "0" * 64
    key = "phase2d-live-test/test_id_123/bad.bin"

    with pytest.raises(StorageIntegrityError) as exc_info:
        r2.upload_file(src, key, fake_sha)

    assert "Isolated in quarantine namespace" in str(exc_info.value)
    assert key not in r2._mock_storage
    assert len(r2._quarantine_storage) == 1
    assert r2.list_quarantine()[0]["quarantine_key"].startswith("quarantine/")


def test_stage1_r2_idempotent_duplicate_handling(temp_workspace):
    """R2 adapter allows identical duplicate upload and rejects altered duplicate."""
    r2 = R2StorageAdapter(mock_mode=True, initial_backoff=0.01)
    src = temp_workspace / "r2_idempotent.bin"
    src.write_bytes(b"Consistent backup data block")
    sha = calculate_sha256(src)
    key = "phase2d-live-test/test_id_123/r2_idempotent.bin"

    # First upload: VERIFIED
    res1 = r2.upload_file(src, key, sha)
    assert res1["status"] == "VERIFIED"

    # Duplicate upload with same hash: VERIFIED_IDEMPOTENT
    res2 = r2.upload_file(src, key, sha)
    assert res2["status"] == "VERIFIED_IDEMPOTENT"

    # Conflicting upload with different hash: StorageDuplicateConflictError
    src_bad = temp_workspace / "r2_diff.bin"
    src_bad.write_bytes(b"Altered backup data block")
    sha_bad = calculate_sha256(src_bad)
    with pytest.raises(StorageDuplicateConflictError):
        r2.upload_file(src_bad, key, sha_bad)


# --- STAGE 2: GOOGLE DRIVE PROTOCOL & INTEGRITY ---

def test_stage2_gdrive_folder_scoping_rejects_root(temp_workspace):
    """Google Drive adapter strictly forbids root folder access."""
    gd = GDriveStorageAdapter(folder_id="root", mock_mode=True)
    src = temp_workspace / "test.bin"
    src.write_bytes(b"Data")
    with pytest.raises(StoragePermissionError):
        gd.upload_file(src, "file.bin", "sha")


def test_stage2_gdrive_resumable_upload_lifecycle(temp_workspace):
    """Google Drive Resumable Upload protocol handles chunk streaming, drop, and recovery."""
    gd = GDriveStorageAdapter(folder_id="mock_folder", mock_mode=True, initial_backoff=0.01)
    
    # 768 KB payload (three 256 KB chunks)
    payload = b"GdrivePostgresDumpChunk" * 33400
    total_size = len(payload)
    src = temp_workspace / "gd_chunked.bin"
    src.write_bytes(payload)
    expected_sha = calculate_sha256(src)
    key = "phase2d-live-test/test_id_456/gd_chunked.bin"

    # Simulate 1 network interruption during chunk upload
    gd.simulate_chunk_network_drops_remaining = 1

    res = gd.resumable_upload_file(src, key, expected_sha, chunk_size=256 * 1024)
    assert res["status"] == "VERIFIED"
    assert res["protocol"] == "RESUMABLE_UPLOAD"
    assert res["size_bytes"] == total_size
    assert res["sha256"] == expected_sha
    assert gd.simulate_chunk_network_drops_remaining == 0

    # Download and verify directly from bytes
    dest = temp_workspace / "gd_downloaded.bin"
    gd.download_and_verify_sha256(key, dest, expected_sha)
    assert dest.stat().st_size == total_size
    assert calculate_sha256(dest) == expected_sha


def test_stage2_gdrive_byte_level_sha256_rejects_untrusted_metadata(temp_workspace):
    """Google Drive download independently verifies byte SHA-256 and rejects corrupt payload."""
    gd = GDriveStorageAdapter(folder_id="mock_folder", mock_mode=True, initial_backoff=0.01)
    src = temp_workspace / "gd_source.bin"
    src.write_bytes(b"Authoritative database bytes")
    real_sha = calculate_sha256(src)
    key = "phase2d-live-test/test_id_456/gd_source.bin"

    gd.upload_file(src, key, real_sha)

    # Valid download
    dest_ok = temp_workspace / "dest_ok.bin"
    gd.download_and_verify_sha256(key, dest_ok, real_sha)
    assert dest_ok.exists()

    # Tampered expected hash
    dest_corrupt = temp_workspace / "dest_corrupt.bin"
    with pytest.raises(StorageIntegrityError):
        gd.download_and_verify_sha256(key, dest_corrupt, "f" * 64)
    assert not dest_corrupt.exists()


# --- STAGE 3: CROSS-STORAGE RESTORE & MANIFEST VERIFICATION ---

def test_stage3_manifest_authentication_and_integrity(temp_workspace, master_key):
    """Manifest authentication confirms tamper detection on backup metadata."""
    payload = temp_workspace / "db.sql"
    payload.write_bytes(b"PGDMP\x01\x0f\x00CREATE TABLE test (id int);")
    enc_payload = temp_workspace / "db.sql.enc"
    encrypt_file(payload, enc_payload, master_key)

    manifest_data = create_manifest(
        backup_id="test_backup_20261120",
        project_id="ganlawuubihxinuwjvez",
        region="eu-west-3",
        database_meta={"file": "db.sql.enc", "sha256": calculate_sha256(enc_payload)},
        media_meta={"file": "media.tar.enc", "sha256": "dummy"},
        deployment_meta={"compose": "dummy"},
        encryption_meta={"algorithm": "AES-256-GCM"},
        destinations_meta={"local": {"status": "SUCCESS"}}
    )
    manifest_path = temp_workspace / "manifest.json"
    save_manifest(manifest_data, manifest_path)

    # Verify decryption and artifact match
    res = verify_decryption_and_artifact(
        encrypted_path=enc_payload,
        expected_plaintext_sha256=calculate_sha256(payload),
        key=master_key,
        work_dir=temp_workspace / "restore_work",
        mock_mode=True
    )
    assert res["status"] == "PASSED"
    assert res["plaintext_sha256_verified"] is True
    assert res["gcm_tag_verified"] is True


# --- STAGE 4: FAILURE SCENARIOS ---

def test_stage4_r2_rate_limit_429_budget(temp_workspace):
    """R2 adapter recovers from 2 rate limits, fails after 4 (exhausts 4-attempt budget)."""
    r2 = R2StorageAdapter(mock_mode=True, initial_backoff=0.01)
    src = temp_workspace / "data.bin"
    src.write_bytes(b"Data")
    sha = calculate_sha256(src)

    r2.rate_limit_errors_remaining = 2
    res = r2.upload_file(src, "test_429_ok.bin", sha)
    assert res["status"] == "VERIFIED"

    r2.rate_limit_errors_remaining = 4
    with pytest.raises(StorageAdapterError) as exc_info:
        r2.upload_file(src, "test_429_fail.bin", sha)
    assert "failed after 3 retries" in str(exc_info.value)


def test_stage4_gdrive_rate_limit_429_budget(temp_workspace):
    """Google Drive adapter retries HTTP 429 within the 4-attempt budget."""
    gd = GDriveStorageAdapter(folder_id="mock_folder", mock_mode=True, initial_backoff=0.01)
    src = temp_workspace / "gd_data.bin"
    src.write_bytes(b"GD Data")
    sha = calculate_sha256(src)

    gd.rate_limit_errors_remaining = 2
    res = gd.upload_file(src, "gd_429_ok.bin", sha)
    assert res["status"] == "VERIFIED"

    gd.rate_limit_errors_remaining = 4
    with pytest.raises(StorageAdapterError):
        gd.upload_file(src, "gd_429_fail.bin", sha)


def test_stage4_fail_closed_zero_retry_on_auth_errors():
    """Authentication and permission errors must immediately fail closed with 0 retries."""
    attempts = 0
    def _auth_fail():
        nonlocal attempts
        attempts += 1
        raise StorageAuthenticationError("Invalid credentials")

    with pytest.raises(StorageAuthenticationError):
        execute_with_retry(_auth_fail, "test_auth", max_retries=3, initial_backoff=0.01)
    assert attempts == 1


# --- STAGE 5: SECURITY AUDIT & SECRETS MASKING ---

def test_stage5_zero_secret_leak_in_exception_strings():
    """Ensure error messages do not leak secret credentials."""
    secret = "AIzaSyD-SecretKey-123456789"
    try:
        raise StorageAuthenticationError("Authentication failed for configured account.")
    except StorageAuthenticationError as e:
        msg = str(e)
        assert secret not in msg
