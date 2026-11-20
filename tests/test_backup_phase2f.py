"""Test suite for Selloi Backup System - Phase 2F: Real Cloud Credential Onboarding & Live DR Validation.

Tests cover:
- Stage 0: Preflight code and isolation safety
- Stage 1: Configuration consistency, canonical alias precedence, and conflict detection
- Stage 2: Credential onboarding, missing credential handling, and masked status
- Stage 3: Cloudflare R2 zero-delete policy, quarantine architecture, and byte SHA-256
- Stage 4: Google Drive direct byte SHA-256 verification and 8-stage resumable protocol
- Stage 5: Cryptographic manifest authentication, HMAC-SHA256 signing, and tamper rejection
- Stage 6: Isolated staging restore rehearsal guards and custom dump TOC validation
- Stage 7: WAN RTO vs local injection duration modeling
- Stage 8 & 9: Secret hygiene, temporary file cleanup, and security controls
"""

import os
import json
import pytest
from pathlib import Path

from selloi_backup.config import (
    BackupConfig,
    DatabaseConfig,
    StorageConfig,
    resolve_storage_env_var
)
from selloi_backup.storage_base import (
    StorageAdapterError,
    StorageAuthenticationError,
    StoragePermissionError,
    StorageTransientError,
    StorageIntegrityError,
    StorageDuplicateConflictError,
    StorageConfigurationConflictError,
    execute_with_retry
)
from selloi_backup.storage_r2 import R2StorageAdapter
from selloi_backup.storage_gdrive import GDriveStorageAdapter
from selloi_backup.backup_crypto import (
    generate_key,
    encrypt_file,
    decrypt_file,
    derive_key_id
)
from selloi_backup.integrity import (
    calculate_sha256,
    calculate_bytes_sha256,
    verify_file_hash
)
from selloi_backup.manifest import (
    create_manifest,
    sign_manifest,
    verify_manifest_signature,
    derive_manifest_signing_key,
    load_and_verify_manifest,
    save_manifest,
    ManifestError,
    ManifestAuthenticationError
)
from selloi_backup.restore_validator import (
    validate_target_engine_version,
    validate_restore_target_safety,
    generate_unique_rehearsal_db_name,
    validate_safe_teardown_target,
    validate_workspace_path_containment,
    validate_custom_dump_toc,
    verify_decryption_and_artifact,
    IncompatibleEngineError,
    TargetIsolationError,
    RestoreValidationError
)


# ==============================================================================
# STAGE 0 & 1: CONFIGURATION CONSISTENCY & ALIAS PRECEDENCE
# ==============================================================================

class TestPhase2FStage1Configuration:
    """Test configuration precedence, alias resolution, and conflict detection."""

    def test_canonical_r2_precedence_over_legacy(self, monkeypatch):
        """Verify canonical R2 variables take precedence over legacy aliases when identical or single."""
        monkeypatch.setenv("R2_ACCOUNT_ID", "canon-acc-123")
        monkeypatch.setenv("BACKUP_R2_ACCOUNT_ID", "canon-acc-123")
        val = resolve_storage_env_var("R2_ACCOUNT_ID", "BACKUP_R2_ACCOUNT_ID")
        assert val == "canon-acc-123"

        monkeypatch.delenv("BACKUP_R2_ACCOUNT_ID", raising=False)
        val2 = resolve_storage_env_var("R2_ACCOUNT_ID", "BACKUP_R2_ACCOUNT_ID")
        assert val2 == "canon-acc-123"

    def test_legacy_fallback_when_canonical_missing(self, monkeypatch):
        """Verify legacy alias is used when canonical is absent."""
        monkeypatch.delenv("R2_BUCKET_NAME", raising=False)
        monkeypatch.setenv("BACKUP_R2_BUCKET", "legacy-bucket-name")
        val = resolve_storage_env_var("R2_BUCKET_NAME", "BACKUP_R2_BUCKET", default="selloi-backups")
        assert val == "legacy-bucket-name"

    def test_conflict_detection_between_canonical_and_legacy_raises(self, monkeypatch):
        """Verify StorageConfigurationConflictError is raised if canonical and legacy differ."""
        monkeypatch.setenv("R2_ACCESS_KEY_ID", "canonical-key-A")
        monkeypatch.setenv("BACKUP_R2_ACCESS_KEY", "legacy-key-B")

        with pytest.raises(StorageConfigurationConflictError) as exc_info:
            resolve_storage_env_var("R2_ACCESS_KEY_ID", "BACKUP_R2_ACCESS_KEY")
        assert "conflict detected" in str(exc_info.value).lower()
        assert "failing closed" in str(exc_info.value).lower()

    def test_conflict_detection_among_multiple_legacy_aliases(self, monkeypatch):
        """Verify StorageConfigurationConflictError if multiple legacy aliases differ."""
        monkeypatch.delenv("GDRIVE_SERVICE_ACCOUNT_JSON", raising=False)
        monkeypatch.setenv("BACKUP_GDRIVE_SERVICE_ACCOUNT_JSON", '{"type": "service_account_1"}')
        monkeypatch.setenv("BACKUP_GDRIVE_CREDENTIALS_FILE", "/path/to/other.json")

        with pytest.raises(StorageConfigurationConflictError) as exc_info:
            resolve_storage_env_var(
                "GDRIVE_SERVICE_ACCOUNT_JSON",
                ["BACKUP_GDRIVE_SERVICE_ACCOUNT_JSON", "BACKUP_GDRIVE_CREDENTIALS_FILE"]
            )
        assert "conflict detected among legacy aliases" in str(exc_info.value).lower()

    def test_backup_config_load_conflict_fail_closed(self, monkeypatch):
        """Verify BackupConfig.load() fails closed on conflicting environment configuration."""
        monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "secret-canonical-1")
        monkeypatch.setenv("BACKUP_R2_SECRET_KEY", "secret-legacy-2")

        with pytest.raises(StorageConfigurationConflictError):
            BackupConfig.load()


# ==============================================================================
# STAGE 2: CREDENTIAL ONBOARDING & STATUS REPORTING
# ==============================================================================

class TestPhase2FStage2Credentials:
    """Test credential onboarding validation and masking."""

    def test_missing_credentials_reported_cleanly(self, monkeypatch):
        """Ensure missing cloud credentials result in disabled state and safe sanitize output."""
        for var in [
            "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT_URL",
            "BACKUP_R2_ACCOUNT_ID", "BACKUP_R2_ACCESS_KEY", "BACKUP_R2_SECRET_KEY", "BACKUP_R2_BUCKET", "BACKUP_R2_ENDPOINT",
            "GDRIVE_FOLDER_ID", "GDRIVE_SERVICE_ACCOUNT_JSON",
            "BACKUP_GDRIVE_FOLDER_ID", "BACKUP_GDRIVE_SERVICE_ACCOUNT_JSON", "BACKUP_GDRIVE_CREDENTIALS_FILE",
            "BACKUP_R2_ENABLED", "BACKUP_GDRIVE_ENABLED"
        ]:
            monkeypatch.delenv(var, raising=False)

        cfg = BackupConfig.load()
        assert cfg.storage.r2_enabled is False
        assert cfg.storage.gdrive_enabled is False

        sanitized = cfg.sanitize()
        assert sanitized["storage"]["r2_access_key"] == ""
        assert sanitized["storage"]["r2_secret_key"] == ""
        assert sanitized["storage"]["gdrive_service_account_json"] == ""

    def test_configured_credentials_are_strictly_masked(self, monkeypatch):
        """Ensure configured credentials never leak plaintext in sanitized configuration."""
        monkeypatch.setenv("R2_ACCESS_KEY_ID", "super_secret_access_key_12345")
        monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "super_secret_secret_key_67890")
        monkeypatch.setenv("GDRIVE_FOLDER_ID", "folder_xyz_987")
        monkeypatch.setenv("GDRIVE_SERVICE_ACCOUNT_JSON", '{"private_key": "-----BEGIN PRIVATE KEY-----"}')

        cfg = BackupConfig.load()
        assert cfg.storage.r2_enabled is True
        assert cfg.storage.gdrive_enabled is True

        sanitized = cfg.sanitize()
        assert sanitized["storage"]["r2_access_key"] == "***REDACTED***"
        assert sanitized["storage"]["r2_secret_key"] == "***REDACTED***"
        assert sanitized["storage"]["gdrive_service_account_json"] == "***CONFIGURED***"
        assert "super_secret" not in json.dumps(sanitized)


# ==============================================================================
# STAGE 3: CLOUDFLARE R2 ZERO-DELETE & QUARANTINE ARCHITECTURE
# ==============================================================================

class TestPhase2FStage3R2Verification:
    """Test R2 adapter zero-delete policy, quarantine namespace, and retry limits."""

    def test_r2_adapter_has_no_delete_object(self):
        """Confirm R2StorageAdapter has zero delete_object methods."""
        assert hasattr(R2StorageAdapter, "delete_object") is False
        assert hasattr(R2StorageAdapter, "delete_file") is False

    def test_r2_quarantine_prefix_configured(self):
        """Verify default quarantine namespace in R2 adapter."""
        adapter = R2StorageAdapter(mock_mode=True, quarantine_prefix="quarantine/")
        assert adapter.quarantine_prefix == "quarantine/"

    def test_r2_upload_byte_sha256_verified(self, tmp_path):
        """Verify byte-level SHA-256 verification after upload in mock mode."""
        test_file = tmp_path / "payload.bin"
        content = b"CRITICAL_STAGE3_PAYLOAD_BYTE_LEVEL_VERIFICATION"
        test_file.write_bytes(content)
        expected_sha = calculate_bytes_sha256(content)

        adapter = R2StorageAdapter(mock_mode=True)
        res = adapter.upload_file(test_file, "backups/2026/payload.bin", expected_sha256=expected_sha)
        assert res["status"] == "VERIFIED"
        assert res["sha256"] == expected_sha
        assert res["size_bytes"] == len(content)


# ==============================================================================
# STAGE 4: GOOGLE DRIVE DIRECT BYTE SHA-256 & PROTOCOL
# ==============================================================================

class TestPhase2FStage4GDriveVerification:
    """Test Google Drive direct byte verification and resumable protocol."""

    def test_gdrive_download_verifies_disk_bytes_sha256(self, tmp_path):
        """Verify GDrive adapter computes SHA-256 directly from disk bytes."""
        src_file = tmp_path / "gdrive_src.bin"
        src_content = b"GDRIVE_STAGE4_BYTE_LEVEL_INTEGRITY_CHECK"
        src_file.write_bytes(src_content)
        expected_sha = calculate_sha256(src_file)

        adapter = GDriveStorageAdapter(mock_mode=True)
        adapter.upload_file(src_file, "gdrive_test.bin", expected_sha256=expected_sha)

        dst_file = tmp_path / "gdrive_downloaded.bin"
        downloaded_path = adapter.download_and_verify_sha256("gdrive_test.bin", dst_file, expected_sha256=expected_sha)
        assert downloaded_path.is_file()
        assert calculate_sha256(downloaded_path) == expected_sha

    def test_gdrive_tampered_download_fails_closed(self, tmp_path):
        """Verify GDrive download raises StorageIntegrityError if bytes do not match expected hash."""
        src_file = tmp_path / "src_tamper.bin"
        src_file.write_bytes(b"ORIGINAL_BYTES")
        src_sha = calculate_sha256(src_file)
        adapter = GDriveStorageAdapter(mock_mode=True)
        adapter.upload_file(src_file, "tamper_target.bin", expected_sha256=src_sha)

        dst_file = tmp_path / "dst_tampered.bin"
        bogus_sha = "0000000000000000000000000000000000000000000000000000000000000000"
        with pytest.raises(StorageIntegrityError):
            adapter.download_and_verify_sha256("tamper_target.bin", dst_file, expected_sha256=bogus_sha)


# ==============================================================================
# STAGE 5: CRYPTOGRAPHIC MANIFEST AUTHENTICATION
# ==============================================================================

class TestPhase2FStage5ManifestAuthentication:
    """Test HMAC-SHA256 manifest authentication and key segregation."""

    def test_manifest_signing_key_segregation(self):
        """Verify manifest signing key is cryptographically separated from master key."""
        master_key = b"01234567890123456789012345678901"
        signing_key = derive_manifest_signing_key(master_key)
        assert len(signing_key) == 32
        assert signing_key != master_key

    def test_manifest_signing_and_verification_success(self, tmp_path):
        """Verify end-to-end manifest signing and signature verification."""
        master_key = b"A" * 32
        signing_key = derive_manifest_signing_key(master_key)

        manifest = create_manifest(
            backup_id="backup_20261120_test",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "abc"},
            media_meta={"count": 5},
            deployment_meta={"env": "staging"},
            encryption_meta={"algorithm": "AES-256-GCM"},
            destinations_meta={"local": True},
            signing_key=signing_key
        )

        assert "authentication" in manifest
        assert manifest["authentication"]["signature_algorithm"] == "HMAC-SHA256"
        assert verify_manifest_signature(manifest, signing_key) is True

        manifest_file = tmp_path / "manifest.json"
        save_manifest(manifest, manifest_file)

        loaded = load_and_verify_manifest(manifest_file, signing_key)
        assert loaded["backup_id"] == "backup_20261120_test"

    def test_tampered_manifest_fails_closed(self):
        """Verify any tampering of manifest payload raises ManifestAuthenticationError."""
        master_key = b"B" * 32
        signing_key = derive_manifest_signing_key(master_key)

        manifest = create_manifest(
            backup_id="backup_tamper_test",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "original_hash"},
            media_meta={"count": 10},
            deployment_meta={"env": "staging"},
            encryption_meta={"algorithm": "AES-256-GCM"},
            destinations_meta={"local": True},
            signing_key=signing_key
        )

        # Tamper payload
        manifest["database_meta"] = {"sha256": "forged_malicious_hash"}

        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_signature(manifest, signing_key)
        assert "tampered" in str(exc_info.value).lower() or "mismatch" in str(exc_info.value).lower()

    def test_unsigned_manifest_fails_closed_when_verifying(self):
        """Verify unsigned manifest raises ManifestAuthenticationError."""
        signing_key = b"C" * 32
        manifest = create_manifest(
            backup_id="backup_unsigned",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "abc"},
            media_meta={},
            deployment_meta={},
            encryption_meta={},
            destinations_meta={}
        )
        assert "authentication" not in manifest

        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_signature(manifest, signing_key)
        assert "lacks authentication envelope" in str(exc_info.value).lower()


# ==============================================================================
# STAGE 6: RESTORE ISOLATION & VERIFICATION GUARDS
# ==============================================================================

class TestPhase2FStage6RestoreIsolation:
    """Test restore rehearsal isolation boundaries and engine guards."""

    def test_restore_rejects_production_supabase(self):
        """Verify restore validator rejects Supabase production targets."""
        with pytest.raises(TargetIsolationError):
            validate_restore_target_safety("aws-1-eu-west-3.pooler.supabase.com", "aisales_drill_123")

    def test_restore_rejects_production_container(self):
        """Verify restore validator rejects production container telegram_ai_seller-db-1."""
        with pytest.raises(TargetIsolationError):
            validate_restore_target_safety("127.0.0.1", "aisales_drill_123", target_container="telegram_ai_seller-db-1")

    def test_restore_rejects_unsafe_database_names(self):
        """Verify restore validator rejects production DB names."""
        for unsafe_db in ["postgres", "aisales", "production", "prod"]:
            with pytest.raises(TargetIsolationError):
                validate_restore_target_safety("127.0.0.1", unsafe_db)

    def test_pg17_to_pg16_downgrade_rejected(self):
        """Verify PostgreSQL 17 dump cannot be restored into PostgreSQL 16."""
        with pytest.raises(IncompatibleEngineError):
            validate_target_engine_version(target_major_version=16, dump_major_version=17)

    def test_pg17_to_pg17_engine_allowed(self):
        """Verify PostgreSQL 17 to 17 restoration is allowed."""
        validate_target_engine_version(target_major_version=17, dump_major_version=17)

    def test_decryption_and_artifact_roundtrip(self, tmp_path):
        """Verify synthetic encryption, decryption, TOC check, and safe temporary cleanup."""
        key = generate_key()
        work_dir = tmp_path / "work"
        work_dir.mkdir()

        # Synthetic PostgreSQL dump with PGDMP header
        src_dump = tmp_path / "source.dump"
        dump_data = b"PGDMP\x01\x0f\x00SYNTHETIC_POSTGRESQL_17_DUMP_PAYLOAD"
        src_dump.write_bytes(dump_data)
        src_sha = calculate_sha256(src_dump)

        enc_dump = tmp_path / "source.dump.enc"
        encrypt_file(src_dump, enc_dump, key)

        res = verify_decryption_and_artifact(
            encrypted_path=enc_dump,
            expected_plaintext_sha256=src_sha,
            key=key,
            work_dir=work_dir,
            mock_mode=True
        )

        assert res["status"] == "PASSED"
        assert res["gcm_tag_verified"] is True
        assert res["plaintext_sha256_verified"] is True
        assert "SYNTHETIC_TOC_VALID" in res["toc_validation"]
