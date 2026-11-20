"""Test suite for Selloi Backup System - Phase 2G: Pre-Live Security Remediation & Final Validation.

Tests cover:
- Task A: Google Drive zero-delete policy, quarantine isolation, and inventory exclusion
- Task B: Cryptographic key derivation (RFC 5869 HKDF-SHA256, legacy V1 compatibility, Key ID check)
- Task C: Manifest replay and rollback protection (Monotonic sequence ledger, duplicate rejection, hash chaining)
- Task D: Restore inventory and quarantine validation (Completeness, snapshot matching, cross-storage reconciliation)
- Task E: Regression and security verification
"""

import os
import json
import pytest
from pathlib import Path

from selloi_backup.storage_base import (
    StorageAdapterError,
    StorageAuthenticationError,
    StorageIntegrityError,
    StorageDuplicateConflictError
)
from selloi_backup.storage_gdrive import GDriveStorageAdapter
from selloi_backup.manifest import (
    create_manifest,
    sign_manifest,
    verify_manifest_signature,
    verify_manifest_with_master_key,
    derive_manifest_signing_key,
    derive_manifest_signing_key_hkdf,
    derive_manifest_signing_key_v1,
    compute_manifest_hash,
    save_manifest,
    load_manifest,
    ManifestError,
    ManifestAuthenticationError,
    DERIVATION_VERSION_V1,
    DERIVATION_VERSION_V2
)
from selloi_backup.replay_protection import (
    BackupStateLedger,
    ReplayProtectionError,
    ManifestReplayError,
    ManifestSequenceRollbackError,
    ManifestDuplicateBackupIdError,
    ManifestChainBrokenError
)
from selloi_backup.restore_inventory import (
    RestoreInventoryManager,
    RestoreInventoryError,
    QuarantinedArtifactError,
    IncompleteBackupError,
    CrossStorageMismatchError,
    SnapshotMismatchError
)
from selloi_backup.integrity import calculate_sha256, calculate_bytes_sha256


# ==============================================================================
# TASK A: GOOGLE DRIVE REMOTE DELETION & QUARANTINE AUDIT
# ==============================================================================

class TestPhase2GTaskAGDriveAudit:
    """Test Google Drive non-destructive operations and quarantine isolation."""

    def test_gdrive_adapter_has_no_remote_delete_methods(self):
        """Confirm GDriveStorageAdapter strictly has no delete_object or delete_file methods."""
        assert hasattr(GDriveStorageAdapter, "delete_object") is False
        assert hasattr(GDriveStorageAdapter, "delete_file") is False

    def test_checksum_mismatch_triggers_quarantine_without_remote_delete(self, tmp_path):
        """Verify checksum mismatch isolates file in quarantine and does not delete remotely."""
        adapter = GDriveStorageAdapter(mock_mode=True)
        src_file = tmp_path / "test_artifact.bin"
        content = b"VALID_INITIAL_BYTES"
        src_file.write_bytes(content)
        real_sha = calculate_sha256(src_file)

        # Upload initial valid file
        adapter.upload_file(src_file, "backups/artifact_01.bin", expected_sha256=real_sha)
        assert len(adapter.list_backups()) == 1

        # Attempt download with mismatched expected hash
        dst_file = tmp_path / "downloaded_target.bin"
        bogus_sha = "f" * 64
        with pytest.raises(StorageIntegrityError):
            adapter.download_and_verify_sha256("backups/artifact_01.bin", dst_file, expected_sha256=bogus_sha)

        # Confirm file was moved to quarantine
        quarantine_items = adapter.list_quarantine()
        assert len(quarantine_items) == 1
        assert quarantine_items[0]["original_remote_name"] == "backups/artifact_01.bin"
        assert quarantine_items[0]["status"] == "QUARANTINED"
        assert "mismatch" in quarantine_items[0]["reason"].lower()

        # Confirm quarantined file is excluded from active restore inventory
        active_backups = adapter.list_backups()
        assert len(active_backups) == 0

    def test_no_overwrite_of_existing_file_with_different_checksum(self, tmp_path):
        """Verify attempting to upload an existing file with differing checksum raises StorageDuplicateConflictError."""
        adapter = GDriveStorageAdapter(mock_mode=True)
        file_a = tmp_path / "file_a.bin"
        file_a.write_bytes(b"DATA_VERSION_A")
        sha_a = calculate_sha256(file_a)

        adapter.upload_file(file_a, "backups/immutable.bin", expected_sha256=sha_a)

        file_b = tmp_path / "file_b.bin"
        file_b.write_bytes(b"DATA_VERSION_B_DIFFERENT")
        sha_b = calculate_sha256(file_b)

        with pytest.raises(StorageDuplicateConflictError) as exc_info:
            adapter.upload_file(file_b, "backups/immutable.bin", expected_sha256=sha_b)
        assert "already exists with different checksum" in str(exc_info.value).lower()
        assert "prohibited" in str(exc_info.value).lower()

    def test_quarantine_status_preserved_across_retries(self):
        """Verify that quarantine storage retains isolated objects without loss or overwrite during retries."""
        adapter = GDriveStorageAdapter(mock_mode=True)
        q1 = adapter._quarantine_object("corrupt_chunk_1.bin", b"BAD_DATA_1", "checksum_error_1", file_id="fid_001")
        q2 = adapter._quarantine_object("corrupt_chunk_2.bin", b"BAD_DATA_2", "checksum_error_2", file_id="fid_002")

        items = adapter.list_quarantine()
        assert len(items) == 2
        keys = [it["quarantine_key"] for it in items]
        assert q1 in keys
        assert q2 in keys


# ==============================================================================
# TASK B: CRYPTOGRAPHIC KEY DERIVATION AUDIT (HKDF-SHA256 & V1 COMPATIBILITY)
# ==============================================================================

class TestPhase2GTaskBKeyDerivation:
    """Test HKDF-SHA256 derivation, domain separation, and backward compatibility."""

    def test_deterministic_hkdf_derivation_for_same_master_key(self):
        """Verify HKDF-SHA256 derivation produces identical results for the same master key."""
        master_key = b"0123456789abcdef0123456789abcdef"
        key_1 = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V2)
        key_2 = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V2)
        assert len(key_1) == 32
        assert key_1 == key_2
        assert key_1 != master_key

    def test_domain_separation_different_purpose_yields_different_keys(self):
        """Verify different domain purposes yield completely different keys from same master key."""
        master_key = b"0123456789abcdef0123456789abcdef"
        signing_key = derive_manifest_signing_key(master_key, purpose="manifest_signing")
        backup_key = derive_manifest_signing_key(master_key, purpose="data_encryption")
        audit_key = derive_manifest_signing_key(master_key, purpose="audit_verification")

        assert signing_key != backup_key
        assert signing_key != audit_key
        assert backup_key != audit_key

    def test_different_master_keys_yield_different_derived_keys(self):
        """Verify different master keys yield unique derived keys."""
        master_1 = b"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        master_2 = b"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        key_1 = derive_manifest_signing_key(master_1)
        key_2 = derive_manifest_signing_key(master_2)
        assert key_1 != key_2

    def test_legacy_v1_compatibility_and_verification(self):
        """Verify manifests signed with legacy V1 SHA256 derivation verify correctly."""
        master_key = b"MASTER_KEY_LEGACY_COMPAT_32BYTES"
        v1_signing_key = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V1)

        manifest = create_manifest(
            backup_id="backup_legacy_v1",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "abc"},
            media_meta={},
            deployment_meta={},
            encryption_meta={"algorithm": "AES-256-GCM"},
            destinations_meta={"local": True},
            signing_key=v1_signing_key,
            derivation_version=DERIVATION_VERSION_V1
        )

        assert manifest["authentication"]["derivation_algorithm"] == DERIVATION_VERSION_V1
        # Direct verification with V1 key
        assert verify_manifest_signature(manifest, v1_signing_key) is True
        # Verification via master key with automatic derivation selection
        assert verify_manifest_with_master_key(manifest, master_key) is True

    def test_key_id_mismatch_rejected_fail_closed(self):
        """Verify verify_manifest_signature rejects when signing key produces conflicting key_id."""
        key_a = b"KEY_A_0123456789012345678901234"
        key_b = b"KEY_B_0123456789012345678901234"

        manifest = create_manifest(
            backup_id="backup_key_id_test",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "abc"},
            media_meta={},
            deployment_meta={},
            encryption_meta={},
            destinations_meta={},
            signing_key=key_a
        )

        # Attempt verification with wrong key_b (different key_id)
        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_signature(manifest, key_b)
        assert "key id mismatch" in str(exc_info.value).lower()


# ==============================================================================
# TASK C: MANIFEST REPLAY & ROLLBACK PROTECTION
# ==============================================================================

class TestPhase2GTaskCReplayProtection:
    """Test monotonic state ledger, replay rejection, rollback detection, and hash chaining."""

    def test_new_manifest_accepted_and_recorded(self, tmp_path):
        """Verify new manifest with incrementing sequence number is admitted."""
        ledger_file = tmp_path / "ledger.json"
        ledger = BackupStateLedger(ledger_file)

        manifest_1 = {
            "backup_id": "backup_20261120_001",
            "snapshot_id": "snap_001",
            "sequence_number": 1,
            "manifest_version": "2.0.0"
        }

        ledger.validate_manifest_for_restore(manifest_1)
        ledger.record_manifest(manifest_1)

        summary = ledger.get_summary()
        assert summary["latest_sequence_number"] == 1
        assert summary["latest_backup_id"] == "backup_20261120_001"
        assert summary["total_tracked_backups"] == 1

    def test_sequence_rollback_rejected(self, tmp_path):
        """Verify submitting a manifest with an older sequence number raises ManifestSequenceRollbackError."""
        ledger = BackupStateLedger()
        manifest_10 = {"backup_id": "backup_seq_10", "sequence_number": 10, "snapshot_id": "s10"}
        ledger.record_manifest(manifest_10)

        # Attempt to validate an older manifest with sequence 5
        manifest_5 = {"backup_id": "backup_seq_5", "sequence_number": 5, "snapshot_id": "s5"}
        with pytest.raises(ManifestSequenceRollbackError) as exc_info:
            ledger.validate_manifest_for_restore(manifest_5)
        assert "rollback attack detected" in str(exc_info.value).lower()

    def test_duplicate_backup_id_rejected(self):
        """Verify registering a duplicate backup ID raises ManifestDuplicateBackupIdError."""
        ledger = BackupStateLedger()
        manifest = {"backup_id": "backup_unique_123", "sequence_number": 1, "snapshot_id": "s1"}
        ledger.record_manifest(manifest)

        # Second attempt to record same backup_id
        manifest_dup = {"backup_id": "backup_unique_123", "sequence_number": 2, "snapshot_id": "s2"}
        with pytest.raises(ManifestDuplicateBackupIdError) as exc_info:
            ledger.record_manifest(manifest_dup)
        assert "already exists in state ledger" in str(exc_info.value).lower()

    def test_replay_of_processed_backup_rejected_on_restore(self):
        """Verify an adversary replaying an older processed manifest is rejected."""
        ledger = BackupStateLedger()
        m1 = {"backup_id": "backup_01", "sequence_number": 1, "snapshot_id": "s1"}
        m2 = {"backup_id": "backup_02", "sequence_number": 2, "snapshot_id": "s2"}
        ledger.record_manifest(m1)
        ledger.record_manifest(m2)

        # Attempt to replay m1 when current state is at sequence 2
        with pytest.raises(ManifestSequenceRollbackError):
            ledger.validate_manifest_for_restore(m1)

    def test_hash_chain_verification_and_broken_chain_detection(self):
        """Verify hash chaining links manifests cryptographically and detects broken chains."""
        ledger = BackupStateLedger()
        m1 = {
            "backup_id": "backup_chain_01",
            "snapshot_id": "snap_c01",
            "sequence_number": 1,
            "manifest_version": "2.0.0"
        }
        ledger.record_manifest(m1)
        hash_1 = ledger.latest_manifest_hash

        # Valid sequential child manifest referencing hash_1
        m2_valid = {
            "backup_id": "backup_chain_02",
            "snapshot_id": "snap_c02",
            "sequence_number": 2,
            "previous_manifest_hash": hash_1,
            "manifest_version": "2.0.0"
        }
        ledger.validate_manifest_for_restore(m2_valid)
        ledger.record_manifest(m2_valid)

        # Child with broken/tampered previous_manifest_hash
        m3_corrupt = {
            "backup_id": "backup_chain_03",
            "snapshot_id": "snap_c03",
            "sequence_number": 3,
            "previous_manifest_hash": "bad_bogus_previous_hash_0000000",
            "manifest_version": "2.0.0"
        }
        with pytest.raises(ManifestChainBrokenError) as exc_info:
            ledger.validate_manifest_for_restore(m3_corrupt)
        assert "hash chain broken" in str(exc_info.value).lower()


# ==============================================================================
# TASK D: RESTORE INVENTORY & QUARANTINE VALIDATION
# ==============================================================================

class TestPhase2GTaskDRestoreInventory:
    """Test restore inventory admission, quarantine exclusion, and cross-storage reconciliation."""

    def test_quarantined_object_excluded_from_inventory(self):
        """Verify objects with QUARANTINED status are rejected from restore inventory."""
        inventory = RestoreInventoryManager()
        manifest = {
            "backup_id": "backup_quarantined_01",
            "snapshot_id": "snap_01",
            "payload": {"database": {"sha256": "abc"}, "media": {}},
            "encryption": {"key_id": "k1"}
        }

        res = inventory.register_candidate(
            manifest=manifest,
            storage_destination="Cloudflare R2",
            remote_status="QUARANTINED"
        )
        assert res["decision"] == "REJECTED"
        assert "QUARANTINED_OBJECT_EXCLUDED" in res["reason"]
        assert len(inventory.get_admitted_inventory()) == 0

    def test_incomplete_manifest_missing_database_rejected(self):
        """Verify manifest missing database payload is rejected as incomplete."""
        inventory = RestoreInventoryManager()
        manifest = {
            "backup_id": "backup_incomplete_01",
            "snapshot_id": "snap_01",
            "payload": {"media": {}},  # Missing database
            "encryption": {"key_id": "k1"}
        }

        res = inventory.register_candidate(manifest, "Local Vault")
        assert res["decision"] == "REJECTED"
        assert "INCOMPLETE_BACKUP" in res["reason"]
        assert len(inventory.get_admitted_inventory()) == 0

    def test_snapshot_id_mismatch_rejected(self):
        """Verify disagreement between manifest snapshot_id and database snapshot_id is rejected."""
        inventory = RestoreInventoryManager()
        manifest = {
            "backup_id": "backup_mismatch_01",
            "snapshot_id": "manifest_snapshot_A",
            "payload": {
                "database": {"sha256": "abc", "snapshot_id": "database_snapshot_B"},
                "media": {"snapshot_id": "manifest_snapshot_A"}
            },
            "encryption": {"key_id": "k1"}
        }

        res = inventory.register_candidate(manifest, "Google Drive")
        assert res["decision"] == "REJECTED"
        assert "SNAPSHOT_ID_MISMATCH" in res["reason"]

    def test_cross_storage_checksum_reconciliation_success(self):
        """Verify identical backup across R2 and GDrive is admitted and cross-verified."""
        inventory = RestoreInventoryManager()
        manifest_r2 = {
            "backup_id": "backup_reconciled_01",
            "snapshot_id": "snap_01",
            "sequence_number": 5,
            "created_at_utc": "2026-11-20T12:00:00Z",
            "payload": {
                "database": {"sha256": "db_hash_12345", "snapshot_id": "snap_01"},
                "media": {"sha256": "media_hash_67890", "snapshot_id": "snap_01"}
            },
            "encryption": {"key_id": "k1"}
        }

        manifest_gdrive = dict(manifest_r2)

        res1 = inventory.register_candidate(manifest_r2, "Cloudflare R2")
        assert res1["decision"] == "ADMITTED"

        res2 = inventory.register_candidate(manifest_gdrive, "Google Drive")
        assert res2["decision"] == "RECONCILED"

        admitted = inventory.get_admitted_inventory()
        assert len(admitted) == 1
        assert admitted[0]["cross_storage_verified"] is True
        assert "Cloudflare R2" in admitted[0]["replicated_destinations"]
        assert "Google Drive" in admitted[0]["replicated_destinations"]

    def test_cross_storage_checksum_mismatch_disqualifies_candidate(self):
        """Verify differing checksums across R2 and GDrive for the same backup_id disqualifies the candidate."""
        inventory = RestoreInventoryManager()
        manifest_r2 = {
            "backup_id": "backup_divergent_01",
            "snapshot_id": "snap_01",
            "sequence_number": 5,
            "payload": {
                "database": {"sha256": "legitimate_db_hash", "snapshot_id": "snap_01"},
                "media": {"sha256": "media_hash", "snapshot_id": "snap_01"}
            },
            "encryption": {"key_id": "k1"}
        }

        manifest_gdrive_corrupt = {
            "backup_id": "backup_divergent_01",
            "snapshot_id": "snap_01",
            "sequence_number": 5,
            "payload": {
                "database": {"sha256": "corrupted_divergent_db_hash", "snapshot_id": "snap_01"},
                "media": {"sha256": "media_hash", "snapshot_id": "snap_01"}
            },
            "encryption": {"key_id": "k1"}
        }

        inventory.register_candidate(manifest_r2, "Cloudflare R2")
        res_conflict = inventory.register_candidate(manifest_gdrive_corrupt, "Google Drive")

        assert res_conflict["decision"] == "REJECTED"
        assert "CROSS_STORAGE_CHECKSUM_MISMATCH" in res_conflict["reason"]
        # Candidate must be completely disqualified from admitted inventory
        assert len(inventory.get_admitted_inventory()) == 0

    def test_select_best_restore_candidate_picks_highest_sequence(self):
        """Verify select_best_restore_candidate chooses the newest authenticated candidate."""
        inventory = RestoreInventoryManager()
        for seq in [1, 3, 2]:
            m = {
                "backup_id": f"backup_seq_{seq}",
                "snapshot_id": f"snap_{seq}",
                "sequence_number": seq,
                "created_at_utc": f"2026-11-20T1{seq}:00:00Z",
                "payload": {"database": {"sha256": f"db_{seq}"}, "media": {}},
                "encryption": {"key_id": "k1"}
            }
            inventory.register_candidate(m, "Cloudflare R2")

        best = inventory.select_best_restore_candidate()
        assert best is not None
        assert best["backup_id"] == "backup_seq_3"
        assert best["sequence_number"] == 3
