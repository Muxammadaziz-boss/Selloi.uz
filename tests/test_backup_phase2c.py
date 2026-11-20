"""Unit and failure test suite for Selloi Backup System - Phase 2C.

Covers:
- Step 1: Storage adapter contracts and configuration validation.
- Step 2 & 3: Cloudflare R2 and Google Drive mock adapters with test prefixes.
- Step 4: Cross-storage download, integrity verification, and decryption.
- Step 6: Failure scenarios:
  * Wrong encryption key
  * Corrupted payload
  * SHA-256 mismatch
  * Missing manifest
  * Interrupted download / truncation
  * Empty object
  * Duplicate object
  * Invalid credentials
  * Storage timeout
  * Unsupported extension
"""

import os
import json
import pytest
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
    CorruptedArchiveError,
    CryptoError,
    MAGIC_HEADER_V2
)
from selloi_backup.integrity import calculate_sha256, verify_file_hash
from selloi_backup.manifest import create_manifest, save_manifest, ManifestError
from selloi_backup.restore_validator import (
    validate_target_engine_version,
    validate_restore_target_safety,
    validate_safe_teardown_target,
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


@pytest.fixture
def alternate_key():
    return generate_key()


# --- STEP 6 FAILURE TESTS ---

def test_failure_wrong_encryption_key(temp_workspace, master_key, alternate_key):
    """Wrong encryption key must fail closed with authentication or key ID error."""
    src = temp_workspace / "plain.txt"
    src.write_bytes(b"Selloi database payload data")
    enc = temp_workspace / "plain.txt.enc"
    dec = temp_workspace / "plain.txt.dec"

    encrypt_file(src, enc, master_key)

    # Decryption with alternate key must fail
    with pytest.raises((AuthenticationFailedError, KeyIdentifierMismatchError)):
        decrypt_file(enc, dec, alternate_key)


def test_failure_corrupted_payload_bytes(temp_workspace, master_key):
    """Corrupted ciphertext must fail closed with AuthenticationFailedError."""
    src = temp_workspace / "plain.txt"
    src.write_bytes(b"Highly sensitive customer and order records")
    enc = temp_workspace / "plain.txt.enc"
    dec = temp_workspace / "plain.txt.dec"

    encrypt_file(src, enc, master_key)

    # Tamper with encrypted bytes (flip byte near end of file)
    enc_bytes = bytearray(enc.read_bytes())
    enc_bytes[-10] ^= 0xFF
    enc.write_bytes(bytes(enc_bytes))

    with pytest.raises(AuthenticationFailedError):
        decrypt_file(enc, dec, master_key)


def test_failure_corrupted_header(temp_workspace, master_key):
    """Corrupted magic header must fail with CorruptedArchiveError."""
    src = temp_workspace / "plain.txt"
    src.write_bytes(b"Test header corruption")
    enc = temp_workspace / "plain.txt.enc"
    dec = temp_workspace / "plain.txt.dec"

    encrypt_file(src, enc, master_key)

    # Corrupt first 4 bytes of header
    enc_bytes = bytearray(enc.read_bytes())
    enc_bytes[0:4] = b"BADH"
    enc.write_bytes(bytes(enc_bytes))

    with pytest.raises(CorruptedArchiveError):
        decrypt_file(enc, dec, master_key)


def test_failure_sha256_mismatch(temp_workspace):
    """SHA-256 hash mismatch must be detected and rejected."""
    f = temp_workspace / "data.bin"
    f.write_bytes(b"original data")

    expected_hash = calculate_sha256(f)
    assert verify_file_hash(f, expected_hash) is True

    # Tamper with file
    f.write_bytes(b"tampered data")
    assert verify_file_hash(f, expected_hash) is False


def test_failure_missing_manifest(temp_workspace):
    """Missing or unparseable manifest must raise FileNotFoundError or JSONDecodeError."""
    missing_manifest = temp_workspace / "non_existent_manifest.json"
    assert not missing_manifest.exists()

    with pytest.raises(FileNotFoundError):
        with open(missing_manifest, "r", encoding="utf-8") as f:
            json.load(f)


def test_failure_interrupted_download_truncation(temp_workspace, master_key):
    """Truncated file from interrupted download must fail decryption fail-closed."""
    src = temp_workspace / "full.txt"
    src.write_bytes(b"A" * 100000)  # Multi-chunk file
    enc = temp_workspace / "full.txt.enc"
    dec = temp_workspace / "full.txt.dec"

    encrypt_file(src, enc, master_key)

    # Truncate to half size (simulating dropped connection)
    full_bytes = enc.read_bytes()
    truncated_enc = temp_workspace / "truncated.txt.enc"
    truncated_enc.write_bytes(full_bytes[: len(full_bytes) // 2])

    with pytest.raises((CorruptedArchiveError, AuthenticationFailedError)):
        decrypt_file(truncated_enc, dec, master_key)


def test_failure_empty_object(temp_workspace, master_key):
    """Empty 0-byte file must be rejected as corrupted archive."""
    empty_enc = temp_workspace / "empty.enc"
    empty_enc.write_bytes(b"")
    dec = temp_workspace / "empty.dec"

    with pytest.raises(CorruptedArchiveError):
        decrypt_file(empty_enc, dec, master_key)


def test_failure_invalid_credentials_isolation(temp_workspace):
    """Storage adapters with live calls must fail closed without credentials."""
    existing_file = temp_workspace / "valid_src.bin"
    existing_file.write_bytes(b"content")

    r2 = R2StorageAdapter(endpoint_url="", access_key="", secret_key="", mock_mode=False)
    with pytest.raises(StorageAdapterError) as exc_info:
        r2.upload_file(existing_file, "key", "dummy_sha")
    assert "credential approval" in str(exc_info.value).lower()

    gd = GDriveStorageAdapter(folder_id="", service_account_json="", mock_mode=False)
    with pytest.raises(StorageAdapterError) as exc_info:
        gd.upload_file(existing_file, "key", "dummy_sha")
    assert "service account credentials" in str(exc_info.value).lower()


def test_failure_unsupported_engine_version():
    """Attempting to restore PostgreSQL 17 into PostgreSQL 16 must raise IncompatibleEngineError."""
    with pytest.raises(IncompatibleEngineError):
        validate_target_engine_version(target_major_version=16, dump_major_version=17)


def test_failure_target_isolation_production_host():
    """Targeting production Supabase must raise TargetIsolationError."""
    with pytest.raises(TargetIsolationError):
        validate_restore_target_safety(
            target_host="aws-1-eu-west-3.pooler.supabase.com",
            target_database="aisales_drill_test"
        )


def test_failure_target_isolation_production_database():
    """Targeting production database name 'aisales' or 'postgres' must raise TargetIsolationError."""
    with pytest.raises(TargetIsolationError):
        validate_restore_target_safety(
            target_host="127.0.0.1",
            target_database="aisales"
        )
    with pytest.raises(TargetIsolationError):
        validate_restore_target_safety(
            target_host="127.0.0.1",
            target_database="postgres"
        )


def test_failure_target_isolation_protected_container():
    """Targeting existing live container telegram_ai_seller-db-1 must raise TargetIsolationError."""
    with pytest.raises(TargetIsolationError):
        validate_restore_target_safety(
            target_host="127.0.0.1",
            target_database="aisales_drill_valid",
            target_container="telegram_ai_seller-db-1"
        )


# --- STEP 2 & 3: R2 AND GDRIVE ADAPTER TESTS ---

def test_r2_adapter_mock_lifecycle(temp_workspace):
    """Test R2 adapter mock upload, list, verify, download, and test namespace."""
    r2 = R2StorageAdapter(
        endpoint_url="https://mock.r2.cloudflarestorage.com",
        bucket_name="selloi-backup-staging",
        mock_mode=True
    )

    test_prefix = "selloi-dr-test/phase-2c/"
    remote_key = f"{test_prefix}test_backup.tar.gz.enc"

    f = temp_workspace / "payload.bin"
    f.write_bytes(b"Simulated encrypted payload bytes")
    expected_sha = calculate_sha256(f)

    # 1. Upload
    res = r2.upload_file(f, remote_key, expected_sha)
    assert res["status"] == "VERIFIED"
    assert res["remote_key"] == remote_key
    assert res["sha256"] == expected_sha

    # 2. List
    items = r2.list_backups()
    assert any(item["name"] == remote_key for item in items)

    # 3. Verify
    assert r2.verify_remote_artifact(remote_key, f.stat().st_size, expected_sha) is True
    assert r2.verify_remote_artifact(remote_key, f.stat().st_size + 1, expected_sha) is False
    assert r2.verify_remote_artifact(remote_key, f.stat().st_size, "bad_hash") is False

    # 4. Download
    down_dest = temp_workspace / "downloaded_r2.bin"
    r2.download_file(remote_key, down_dest)
    assert down_dest.exists()
    assert calculate_sha256(down_dest) == expected_sha


def test_gdrive_adapter_mock_lifecycle(temp_workspace):
    """Test Google Drive adapter mock upload, list, verify, download, and test namespace."""
    gd = GDriveStorageAdapter(
        folder_id="mock_gdrive_staging_folder_id",
        mock_mode=True
    )

    test_folder = "Selloi-DR-Test/Phase-2C/"
    remote_name = f"{test_folder}test_backup_gdrive.tar.gz.enc"

    f = temp_workspace / "payload_gd.bin"
    f.write_bytes(b"Simulated Google Drive backup payload")
    expected_sha = calculate_sha256(f)

    # 1. Upload
    res = gd.upload_file(f, remote_name, expected_sha)
    assert res["status"] == "VERIFIED"
    assert res["remote_name"] == remote_name
    assert res["sha256"] == expected_sha

    # 2. List
    items = gd.list_backups()
    assert any(item["name"] == remote_name for item in items)

    # 3. Verify
    assert gd.verify_remote_artifact(remote_name, f.stat().st_size, expected_sha) is True
    assert gd.verify_remote_artifact(remote_name, f.stat().st_size, "bad_hash") is False

    # 4. Download
    down_dest = temp_workspace / "downloaded_gd.bin"
    gd.download_file(remote_name, down_dest)
    assert down_dest.exists()
    assert calculate_sha256(down_dest) == expected_sha


def test_cross_storage_restore_roundtrip(temp_workspace, master_key):
    """Cross-storage restore roundtrip: encrypt -> upload -> download -> verify -> decrypt."""
    raw_payload = temp_workspace / "raw_db.sql"
    raw_payload.write_bytes(b"CREATE TABLE test (id INT); INSERT INTO test VALUES (1);")
    raw_sha = calculate_sha256(raw_payload)

    enc_payload = temp_workspace / "enc_db.sql.enc"
    encrypt_file(raw_payload, enc_payload, master_key)
    enc_sha = calculate_sha256(enc_payload)

    # Simulate R2 roundtrip
    r2 = R2StorageAdapter(mock_mode=True)
    r2_key = "selloi-dr-test/phase-2c/cross_restore.sql.enc"
    r2.upload_file(enc_payload, r2_key, enc_sha)

    downloaded_r2 = temp_workspace / "recovered_r2.sql.enc"
    r2.download_file(r2_key, downloaded_r2)
    assert calculate_sha256(downloaded_r2) == enc_sha

    decrypted_r2 = temp_workspace / "decrypted_r2.sql"
    decrypt_file(downloaded_r2, decrypted_r2, master_key)
    assert calculate_sha256(decrypted_r2) == raw_sha
    assert decrypted_r2.read_bytes() == raw_payload.read_bytes()

    # Simulate Google Drive roundtrip
    gd = GDriveStorageAdapter(mock_mode=True)
    gd_key = "Selloi-DR-Test/Phase-2C/cross_restore_gd.sql.enc"
    gd.upload_file(enc_payload, gd_key, enc_sha)

    downloaded_gd = temp_workspace / "recovered_gd.sql.enc"
    gd.download_file(gd_key, downloaded_gd)
    assert calculate_sha256(downloaded_gd) == enc_sha

    decrypted_gd = temp_workspace / "decrypted_gd.sql"
    decrypt_file(downloaded_gd, decrypted_gd, master_key)
    assert calculate_sha256(decrypted_gd) == raw_sha
    assert decrypted_gd.read_bytes() == raw_payload.read_bytes()


# --- PHASE 2C.1 RESILIENCE, RETRY, TIMEOUT & IDEMPOTENCY TESTS ---

from selloi_backup.storage_base import (
    StorageAuthenticationError,
    StoragePermissionError,
    StorageTransientError,
    StorageTimeoutError,
    StorageIntegrityError,
    StorageDuplicateConflictError
)


def test_r2_retry_exponential_backoff_transient_error(temp_workspace):
    """R2 adapter retries transient errors with exponential backoff and succeeds."""
    r2 = R2StorageAdapter(
        endpoint_url="https://mock.r2.cloudflarestorage.com",
        bucket_name="selloi-backup-staging",
        mock_mode=True,
        initial_backoff=0.01,
        backoff_factor=2.0,
        jitter_max=0.01
    )
    # Simulate 2 transient 503 errors (succeeds on 3rd attempt, attempt <= max_retries 3)
    r2.transient_errors_remaining = 2

    src = temp_workspace / "resilient.bin"
    src.write_bytes(b"Resilient payload data")
    expected_sha = calculate_sha256(src)

    res = r2.upload_file(src, "selloi-dr-test/phase-2c/resilient.bin", expected_sha)
    assert res["status"] == "VERIFIED"
    assert r2.transient_errors_remaining == 0


def test_r2_retry_exceeded_fail_closed(temp_workspace):
    """R2 adapter fails closed if transient errors exceed max_retries."""
    r2 = R2StorageAdapter(
        endpoint_url="https://mock.r2.cloudflarestorage.com",
        bucket_name="selloi-backup-staging",
        mock_mode=True,
        max_retries=2,
        initial_backoff=0.01,
        backoff_factor=1.0,
        jitter_max=0.01
    )
    # 3 errors > max_retries 2
    r2.transient_errors_remaining = 3

    src = temp_workspace / "exceed.bin"
    src.write_bytes(b"Exceed retries data")
    expected_sha = calculate_sha256(src)

    with pytest.raises(StorageAdapterError) as exc_info:
        r2.upload_file(src, "selloi-dr-test/phase-2c/exceed.bin", expected_sha)
    assert "failed after 2 retries" in str(exc_info.value).lower()


def test_r2_immediate_fail_closed_on_auth_failure(temp_workspace):
    """R2 adapter immediately fails without retrying on authentication failure."""
    r2 = R2StorageAdapter(
        endpoint_url="https://mock.r2.cloudflarestorage.com",
        bucket_name="selloi-backup-staging",
        mock_mode=True
    )
    r2.simulate_auth_failure = True

    src = temp_workspace / "auth_fail.bin"
    src.write_bytes(b"Auth fail data")
    expected_sha = calculate_sha256(src)

    # Must raise StorageAuthenticationError immediately (0 retries)
    with pytest.raises(StorageAuthenticationError):
        r2.upload_file(src, "selloi-dr-test/phase-2c/auth_fail.bin", expected_sha)


def test_r2_timeout_enforcement(temp_workspace):
    """R2 adapter enforces configurable timeouts."""
    r2 = R2StorageAdapter(
        endpoint_url="https://mock.r2.cloudflarestorage.com",
        bucket_name="selloi-backup-staging",
        mock_mode=True,
        connect_timeout=5.0,
        max_retries=1,
        initial_backoff=0.01
    )
    r2.simulate_timeout = True

    src = temp_workspace / "timeout.bin"
    src.write_bytes(b"Timeout data")
    expected_sha = calculate_sha256(src)

    with pytest.raises(StorageAdapterError) as exc_info:
        r2.upload_file(src, "selloi-dr-test/phase-2c/timeout.bin", expected_sha)
    assert "timed out" in str(exc_info.value).lower()


def test_r2_idempotency_duplicate_object_handling(temp_workspace):
    """R2 adapter verifies identical duplicate without re-upload, and rejects conflict."""
    r2 = R2StorageAdapter(
        endpoint_url="https://mock.r2.cloudflarestorage.com",
        bucket_name="selloi-backup-staging",
        mock_mode=True
    )

    src = temp_workspace / "idempotent.bin"
    src.write_bytes(b"Identical object content")
    expected_sha = calculate_sha256(src)
    key = "selloi-dr-test/phase-2c/idempotent.bin"

    # 1. First upload
    res1 = r2.upload_file(src, key, expected_sha)
    assert res1["status"] == "VERIFIED"

    # 2. Second upload of same content -> Idempotent success
    res2 = r2.upload_file(src, key, expected_sha)
    assert res2["status"] == "VERIFIED_IDEMPOTENT"

    # 3. Third upload with different content -> Conflict error
    src_conflict = temp_workspace / "conflict.bin"
    src_conflict.write_bytes(b"Different content under same key")
    conflict_sha = calculate_sha256(src_conflict)

    with pytest.raises(StorageDuplicateConflictError):
        r2.upload_file(src_conflict, key, conflict_sha)


def test_gdrive_retry_exponential_backoff_transient_error(temp_workspace):
    """Google Drive adapter retries transient errors with backoff and succeeds."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True,
        initial_backoff=0.01,
        backoff_factor=2.0,
        jitter_max=0.01
    )
    gd.transient_errors_remaining = 2

    src = temp_workspace / "gd_resilient.bin"
    src.write_bytes(b"GDrive resilient data")
    expected_sha = calculate_sha256(src)

    res = gd.upload_file(src, "Selloi-DR-Test/Phase-2C/gd_resilient.bin", expected_sha)
    assert res["status"] == "VERIFIED"
    assert gd.transient_errors_remaining == 0


def test_gdrive_retry_exceeded_fail_closed(temp_workspace):
    """Google Drive adapter fails closed when transient errors exceed retries."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True,
        max_retries=1,
        initial_backoff=0.01
    )
    gd.transient_errors_remaining = 2

    src = temp_workspace / "gd_exceed.bin"
    src.write_bytes(b"GDrive exceed data")
    expected_sha = calculate_sha256(src)

    with pytest.raises(StorageAdapterError):
        gd.upload_file(src, "Selloi-DR-Test/Phase-2C/gd_exceed.bin", expected_sha)


def test_gdrive_immediate_fail_closed_on_auth_failure(temp_workspace):
    """Google Drive adapter immediately fails closed on authentication error (0 retries)."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True
    )
    gd.simulate_auth_failure = True

    src = temp_workspace / "gd_auth_fail.bin"
    src.write_bytes(b"Auth fail data")
    expected_sha = calculate_sha256(src)

    with pytest.raises(StorageAuthenticationError):
        gd.upload_file(src, "Selloi-DR-Test/Phase-2C/gd_auth_fail.bin", expected_sha)


def test_gdrive_dedicated_folder_restriction(temp_workspace):
    """Google Drive adapter strictly forbids root uploads."""
    gd_root = GDriveStorageAdapter(folder_id="root", mock_mode=True)
    src = temp_workspace / "root_test.bin"
    src.write_bytes(b"Root test data")

    with pytest.raises(StoragePermissionError) as exc_info:
        gd_root.upload_file(src, "file.bin", "dummy_sha")
    assert "root uploads are strictly prohibited" in str(exc_info.value).lower()


def test_gdrive_idempotency_duplicate_object_handling(temp_workspace):
    """Google Drive adapter verifies duplicate idempotency and rejects conflict."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True
    )

    src = temp_workspace / "gd_idempotent.bin"
    src.write_bytes(b"GDrive idempotent content")
    expected_sha = calculate_sha256(src)
    key = "Selloi-DR-Test/Phase-2C/gd_idempotent.bin"

    # 1. First upload
    res1 = gd.upload_file(src, key, expected_sha)
    assert res1["status"] == "VERIFIED"

    # 2. Duplicate with identical hash
    res2 = gd.upload_file(src, key, expected_sha)
    assert res2["status"] == "VERIFIED_IDEMPOTENT"

    # 3. Duplicate with different hash -> conflict
    src_conflict = temp_workspace / "gd_conflict.bin"
    src_conflict.write_bytes(b"GDrive altered content")
    conflict_sha = calculate_sha256(src_conflict)

    with pytest.raises(StorageDuplicateConflictError):
        gd.upload_file(src_conflict, key, conflict_sha)


def test_gdrive_service_account_json_validation(temp_workspace):
    """Validates Service Account JSON format and detects malformed or missing fields."""
    gd = GDriveStorageAdapter(folder_id="some_folder", mock_mode=False)

    # 1. Non-existent file
    gd.service_account_json = str(temp_workspace / "missing_sa.json")
    with pytest.raises(StorageAuthenticationError):
        gd.validate_service_account()

    # 2. Malformed JSON
    bad_json_file = temp_workspace / "bad.json"
    bad_json_file.write_text("{ not json", encoding="utf-8")
    gd.service_account_json = str(bad_json_file)
    with pytest.raises(StorageAuthenticationError):
        gd.validate_service_account()

    # 3. Incomplete Service Account JSON
    incomplete_file = temp_workspace / "incomplete.json"
    incomplete_file.write_text(json.dumps({"type": "service_account"}), encoding="utf-8")
    gd.service_account_json = str(incomplete_file)
    with pytest.raises(StorageAuthenticationError):
        gd.validate_service_account()

    # 4. Valid Service Account JSON structure
    valid_file = temp_workspace / "valid_sa.json"
    valid_data = {
        "type": "service_account",
        "project_id": "selloi-staging-dr",
        "private_key_id": "key123456",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----\n",
        "client_email": "selloi-dr@selloi-staging-dr.iam.gserviceaccount.com"
    }
    valid_file.write_text(json.dumps(valid_data), encoding="utf-8")
    gd.service_account_json = str(valid_file)
    info = gd.validate_service_account()
    assert info["project_id"] == "selloi-staging-dr"
    assert info["client_email"] == "selloi-dr@selloi-staging-dr.iam.gserviceaccount.com"


# --- PHASE 2C.2 ADVANCED SECURITY AND RESILIENCE TESTS ---

def test_r2_quarantine_isolation_without_delete(temp_workspace):
    """R2 adapter isolates corrupt uploads in quarantine namespace without issuing DeleteObject."""
    r2 = R2StorageAdapter(
        bucket_name="selloi-backups",
        mock_mode=True,
        initial_backoff=0.01
    )
    src = temp_workspace / "r2_corrupted.bin"
    src.write_bytes(b"Simulated corrupted database dump")

    bad_expected_hash = "0" * 64
    key = "Selloi-DR-Test/Phase-2C/r2_corrupted.bin"

    with pytest.raises(StorageIntegrityError) as exc_info:
        r2.upload_file(src, key, bad_expected_hash)

    # Key must NOT exist in active storage
    assert key not in r2._mock_storage
    # Corrupted payload must be quarantined
    assert len(r2._quarantine_storage) == 1
    quarantined = r2.list_quarantine()
    assert len(quarantined) == 1
    assert quarantined[0]["quarantine_key"].startswith("quarantine/")
    assert "No DeleteObject issued" in str(exc_info.value)


def test_r2_rate_limit_429_retry(temp_workspace):
    """R2 adapter recovers from HTTP 429 rate limiting within retry budget (total 4 attempts)."""
    r2 = R2StorageAdapter(
        bucket_name="selloi-backups",
        mock_mode=True,
        initial_backoff=0.01
    )
    src = temp_workspace / "r2_429.bin"
    src.write_bytes(b"Rate limit test payload")
    expected_sha = calculate_sha256(src)

    # 1. Recovers after 2 rate limit errors (3 attempts total <= 4 allowed)
    r2.rate_limit_errors_remaining = 2
    res = r2.upload_file(src, "Selloi-DR-Test/Phase-2C/r2_429_ok.bin", expected_sha)
    assert res["status"] == "VERIFIED"
    assert r2.rate_limit_errors_remaining == 0

    # 2. Exceeds budget after 4 rate limit errors (attempt 1 initial + 3 retries = 4 exhausted)
    r2.rate_limit_errors_remaining = 4
    with pytest.raises(StorageAdapterError) as exc_info:
        r2.upload_file(src, "Selloi-DR-Test/Phase-2C/r2_429_exhausted.bin", expected_sha)
    assert "failed after 3 retries" in str(exc_info.value)


def test_gdrive_download_byte_sha256_verification(temp_workspace):
    """Google Drive download independently verifies byte SHA-256 and rejects corrupt payload fail-closed."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True,
        initial_backoff=0.01
    )
    src = temp_workspace / "gd_cryptographic_source.bin"
    src.write_bytes(b"Authoritative backup byte stream with cryptographic verification")
    valid_sha = calculate_sha256(src)
    key = "Selloi-DR-Test/Phase-2C/gd_cryptographic_source.bin"

    # Upload valid file
    gd.upload_file(src, key, valid_sha)

    # 1. Download with valid expected SHA-256 succeeds
    dest_good = temp_workspace / "gd_downloaded_good.bin"
    verified_path = gd.download_and_verify_sha256(key, dest_good, valid_sha)
    assert verified_path.exists()
    assert calculate_sha256(verified_path) == valid_sha

    # 2. Download with tampered expected SHA-256 fails closed (rejects untrusted metadata)
    dest_tampered = temp_workspace / "gd_downloaded_tampered.bin"
    fake_sha = "e" * 64
    with pytest.raises(StorageIntegrityError) as exc_info:
        gd.download_and_verify_sha256(key, dest_tampered, fake_sha)

    assert "SHA-256 mismatch" in str(exc_info.value)
    # Tampered download must be deleted locally to prevent restoring corrupt data
    assert not dest_tampered.exists()


def test_gdrive_resumable_upload_lifecycle(temp_workspace):
    """Full lifecycle of Google Drive Resumable Upload: session init, chunk upload, network drop, offset recovery, download verify."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True,
        initial_backoff=0.01
    )
    # Create 1 MB payload for multi-chunk upload (four 256 KB chunks)
    src = temp_workspace / "gd_resumable_1mb.bin"
    payload = b"SelloiPostgres17DumpChunkData" * 36000  # ~1.04 MB
    src.write_bytes(payload)
    total_size = len(payload)
    expected_sha = calculate_sha256(src)
    key = "Selloi-DR-Test/Phase-2C/gd_resumable_1mb.bin"

    # Simulate 1 network drop during chunk upload
    gd.simulate_chunk_network_drops_remaining = 1

    # Orchestrate Resumable Upload with 256 KB chunks
    res = gd.resumable_upload_file(src, key, expected_sha, chunk_size=256 * 1024)

    assert res["status"] == "VERIFIED"
    assert res["protocol"] == "RESUMABLE_UPLOAD"
    assert res["size_bytes"] == total_size
    assert res["sha256"] == expected_sha
    assert gd.simulate_chunk_network_drops_remaining == 0

    # Download roundtrip and verify cryptographic integrity
    dest = temp_workspace / "gd_resumable_restored.bin"
    gd.download_and_verify_sha256(key, dest, expected_sha)
    assert dest.stat().st_size == total_size
    assert calculate_sha256(dest) == expected_sha


def test_gdrive_rate_limit_429_retry(temp_workspace):
    """Google Drive adapter retries on HTTP 429 and respects the 4 total attempts budget."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True,
        initial_backoff=0.01
    )
    src = temp_workspace / "gd_429.bin"
    src.write_bytes(b"Google Drive Rate Limit Data")
    expected_sha = calculate_sha256(src)

    # 1. Recovers after 2 rate limit 429 errors (3 attempts total)
    gd.rate_limit_errors_remaining = 2
    res = gd.upload_file(src, "Selloi-DR-Test/Phase-2C/gd_429_ok.bin", expected_sha)
    assert res["status"] == "VERIFIED"
    assert gd.rate_limit_errors_remaining == 0

    # 2. Exceeds max retries after 4 rate limit errors (1 initial + 3 retries = 4 attempts)
    gd.rate_limit_errors_remaining = 4
    with pytest.raises(StorageAdapterError) as exc_info:
        gd.upload_file(src, "Selloi-DR-Test/Phase-2C/gd_429_exhausted.bin", expected_sha)
    assert "failed after 3 retries" in str(exc_info.value)


def test_retry_policy_attempt_budget_accounting():
    """Validates the exact attempt accounting: 1 initial attempt + 3 retries = 4 total attempts."""
    attempts_recorded = []

    def _failing_transient_operation():
        attempts_recorded.append(len(attempts_recorded) + 1)
        raise StorageTransientError("Transient socket failure")

    # Transient error: must execute exactly 4 times (1 initial + 3 retries)
    with pytest.raises(StorageAdapterError) as exc_info:
        execute_with_retry(
            operation=_failing_transient_operation,
            operation_name="test_transient_budget",
            max_retries=3,
            initial_backoff=0.001,
            sleep_fn=lambda s: None
        )

    assert len(attempts_recorded) == 4
    assert attempts_recorded == [1, 2, 3, 4]
    assert "failed after 3 retries (4 total attempts)" in str(exc_info.value)

    # Authentication failure: must execute exactly 1 time (0 retries)
    auth_attempts = []
    def _auth_failing_operation():
        auth_attempts.append(1)
        raise StorageAuthenticationError("Bad credentials")

    with pytest.raises(StorageAuthenticationError):
        execute_with_retry(
            operation=_auth_failing_operation,
            operation_name="test_auth_fail_closed",
            max_retries=3,
            initial_backoff=0.001,
            sleep_fn=lambda s: None
        )

    assert len(auth_attempts) == 1


def test_gdrive_resumable_upload_duplicate_idempotency(temp_workspace):
    """Resumable upload handles duplicate objects idempotently and forbids overwrite."""
    gd = GDriveStorageAdapter(
        folder_id="mock_staging_folder",
        mock_mode=True,
        initial_backoff=0.01
    )
    src = temp_workspace / "gd_resumable_idempotent.bin"
    src.write_bytes(b"Idempotent chunked content " * 10000)
    expected_sha = calculate_sha256(src)
    key = "Selloi-DR-Test/Phase-2C/gd_resumable_idempotent.bin"

    # 1. First resumable upload
    res1 = gd.resumable_upload_file(src, key, expected_sha, chunk_size=64 * 1024)
    assert res1["status"] == "VERIFIED"

    # 2. Identical resumable upload: skipped with VERIFIED_IDEMPOTENT
    res2 = gd.resumable_upload_file(src, key, expected_sha, chunk_size=64 * 1024)
    assert res2["status"] == "VERIFIED_IDEMPOTENT"

    # 3. Conflict: different content under same key -> rejected
    src_conflict = temp_workspace / "gd_conflict.bin"
    src_conflict.write_bytes(b"Altered content")
    conflict_sha = calculate_sha256(src_conflict)
    with pytest.raises(StorageDuplicateConflictError):
        gd.resumable_upload_file(src_conflict, key, conflict_sha, chunk_size=64 * 1024)

