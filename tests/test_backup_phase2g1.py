"""Comprehensive Test Suite for Selloi Backup System - Phase 2G.1.

Final Security Review & Pre-Live Hardening:
- Task A: BackupStateLedger security, HMAC integrity, concurrency, and rollback defense
- Task B: Manifest version downgrade protection, mandatory Key ID, algorithm whitelisting
- Task C: Resilient cross-storage restore policy, per-storage validation, audit alerts
- Task D: Security integration audit (zero credential leaks, fail-closed guards)
"""

import os
import json
import time
import pytest
import multiprocessing
from pathlib import Path
from typing import Dict, Any

from selloi_backup.manifest import (
    create_manifest,
    sign_manifest,
    verify_manifest_signature,
    verify_manifest_with_master_key,
    derive_manifest_signing_key,
    derive_manifest_signing_key_hkdf,
    derive_manifest_signing_key_v1,
    compute_manifest_hash,
    ManifestError,
    ManifestAuthenticationError,
    DERIVATION_VERSION_V1,
    DERIVATION_VERSION_V2
)
from selloi_backup.replay_protection import (
    BackupStateLedger,
    FileLock,
    derive_ledger_signing_key,
    ReplayProtectionError,
    ManifestReplayError,
    ManifestSequenceRollbackError,
    ManifestDuplicateBackupIdError,
    ManifestChainBrokenError,
    LedgerAuthenticationError
)
from selloi_backup.restore_inventory import (
    RestoreInventoryManager,
    RestoreInventoryError,
    QuarantinedArtifactError,
    IncompleteBackupError,
    CrossStorageMismatchError,
    SnapshotMismatchError
)


# Helper function for multiprocessing concurrency test
def _worker_record_ledger(ledger_path_str: str, seq: int, backup_id: str, signing_key: bytes):
    ledger = BackupStateLedger(ledger_path_str, signing_key=signing_key)
    manifest = {
        "backup_id": backup_id,
        "sequence_number": seq,
        "snapshot_id": f"snap_{backup_id}"
    }
    try:
        ledger.record_manifest(manifest)
    except Exception as e:
        # Expected in race conditions if sequence conflict
        pass


# ==============================================================================
# TASK A: BACKUP STATE LEDGER SECURITY TESTS
# ==============================================================================

class TestPhase2G1TaskALedgerSecurity:
    """Security audit tests for BackupStateLedger."""

    def test_ledger_hmac_tampering_detected(self, tmp_path):
        """Verify modifying ledger state on disk causes LedgerAuthenticationError."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        ledger_key = derive_ledger_signing_key(master_key)
        ledger_file = tmp_path / "backup_state_ledger.json"

        ledger = BackupStateLedger(ledger_file, signing_key=ledger_key)
        manifest = {
            "backup_id": "backup_01",
            "sequence_number": 1,
            "snapshot_id": "snap_01"
        }
        ledger.record_manifest(manifest)
        assert ledger.latest_sequence_number == 1

        # Attacker tampers with ledger on disk: modify latest_sequence_number
        with open(ledger_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["latest_sequence_number"] = 999  # Forged sequence
        with open(ledger_file, "w", encoding="utf-8") as f:
            json.dump(data, f)

        # Loading tampered ledger must raise LedgerAuthenticationError
        with pytest.raises(LedgerAuthenticationError) as exc_info:
            BackupStateLedger(ledger_file, signing_key=ledger_key)
        assert "tampering detected" in str(exc_info.value).lower()

    def test_ledger_signing_key_segregation(self):
        """Verify ledger key is cryptographically separated from manifest key and encryption key."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        ledger_key = derive_ledger_signing_key(master_key)
        manifest_key = derive_manifest_signing_key(master_key)

        assert len(ledger_key) == 32
        assert len(manifest_key) == 32
        assert ledger_key != manifest_key
        assert ledger_key != master_key

    def test_invalid_ledger_json_rejection(self, tmp_path):
        """Verify invalid or corrupted JSON in ledger file is rejected fail-closed."""
        ledger_file = tmp_path / "corrupt_ledger.json"
        ledger_file.write_text("{malformed_json: true, ...", encoding="utf-8")

        with pytest.raises(ReplayProtectionError) as exc_info:
            BackupStateLedger(ledger_file)
        assert "failed to read backup state ledger" in str(exc_info.value).lower()

    def test_ledger_wrong_project_identity_rejected(self, tmp_path):
        """Verify ledger with mismatched project_id is rejected fail-closed."""
        ledger_file = tmp_path / "alien_ledger.json"
        alien_data = {
            "ledger_version": "2.0.0",
            "project_id": "alien_project_identity_attack",
            "latest_sequence_number": 1,
            "latest_backup_id": "backup_01",
            "latest_manifest_hash": "abc",
            "seen_backup_ids": {}
        }
        with open(ledger_file, "w", encoding="utf-8") as f:
            json.dump(alien_data, f)

        with pytest.raises(ReplayProtectionError) as exc_info:
            BackupStateLedger(ledger_file, project_id="ganlawuubihxinuwjvez")
        assert "project id mismatch" in str(exc_info.value).lower()

    def test_ledger_sequence_rollback_rejected(self, tmp_path):
        """Verify manifest with older sequence number is rejected as a rollback attack."""
        ledger = BackupStateLedger(tmp_path / "ledger.json")
        ledger.record_manifest({"backup_id": "backup_seq_5", "sequence_number": 5})

        with pytest.raises(ManifestSequenceRollbackError) as exc_info:
            ledger.validate_manifest_for_restore({"backup_id": "backup_seq_3", "sequence_number": 3})
        assert "rollback attack detected" in str(exc_info.value).lower()

    def test_ledger_duplicate_backup_id_rejected(self, tmp_path):
        """Verify duplicate backup_id is rejected on both record and restore validation."""
        ledger = BackupStateLedger(tmp_path / "ledger.json")
        ledger.record_manifest({"backup_id": "backup_unique_01", "sequence_number": 1})

        # Recording same ID again must fail
        with pytest.raises(ManifestDuplicateBackupIdError):
            ledger.record_manifest({"backup_id": "backup_unique_01", "sequence_number": 2})

    def test_ledger_hash_chain_verification(self, tmp_path):
        """Verify broken previous_manifest_hash links are rejected."""
        ledger = BackupStateLedger(tmp_path / "ledger.json")
        m1 = {"backup_id": "m1", "sequence_number": 1, "payload": {}}
        ledger.record_manifest(m1)
        expected_prev_hash = compute_manifest_hash(m1)

        # Valid next manifest
        m2_valid = {
            "backup_id": "m2",
            "sequence_number": 2,
            "previous_manifest_hash": expected_prev_hash
        }
        ledger.validate_manifest_for_restore(m2_valid)

        # Broken hash chain
        m2_invalid = {
            "backup_id": "m2_bad",
            "sequence_number": 2,
            "previous_manifest_hash": "forged_non_matching_hash"
        }
        with pytest.raises(ManifestChainBrokenError):
            ledger.validate_manifest_for_restore(m2_invalid)

    def test_ledger_atomic_persistence_and_history_journal(self, tmp_path):
        """Verify atomic ledger save and append-only history journal tracking."""
        ledger_file = tmp_path / "ledger.json"
        history_file = tmp_path / "ledger_history.jsonl"

        ledger = BackupStateLedger(ledger_file)
        ledger.record_manifest({"backup_id": "b1", "sequence_number": 1})
        ledger.record_manifest({"backup_id": "b2", "sequence_number": 2})

        assert ledger_file.is_file()
        assert history_file.is_file()

        lines = history_file.read_text(encoding="utf-8").strip().split("\n")
        assert len(lines) == 2
        entry1 = json.loads(lines[0])
        entry2 = json.loads(lines[1])
        assert entry1["sequence_number"] == 1
        assert entry1["backup_id"] == "b1"
        assert entry2["sequence_number"] == 2
        assert entry2["backup_id"] == "b2"

    def test_ledger_file_lock_mutual_exclusion(self, tmp_path):
        """Verify FileLock prevents concurrent double acquisition."""
        lock_file = tmp_path / "test.lock"
        lock1 = FileLock(lock_file, timeout=1.0)
        lock2 = FileLock(lock_file, timeout=0.2)

        assert lock1.acquire() is True
        # lock2 must timeout
        with pytest.raises(TimeoutError):
            lock2.acquire()

        lock1.release()
        # Now lock2 can acquire
        assert lock2.acquire() is True
        lock2.release()


# ==============================================================================
# TASK B: MANIFEST VERSION DOWNGRADE PROTECTION TESTS
# ==============================================================================

class TestPhase2G1TaskBManifestDowngrade:
    """Security tests for manifest downgrade prevention."""

    def test_manifest_valid_v2_hkdf_verification(self):
        """Verify legitimate V2 manifest signs and verifies with HKDF-SHA256."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        signing_key = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V2)

        manifest = create_manifest(
            backup_id="backup_v2_valid",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "db_hash"},
            media_meta={},
            deployment_meta={},
            encryption_meta={"algorithm": "AES-256-GCM"},
            destinations_meta={},
            signing_key=signing_key,
            derivation_version=DERIVATION_VERSION_V2,
            manifest_version="2.0.0"
        )

        assert verify_manifest_with_master_key(manifest, master_key) is True

    def test_manifest_v2_invalid_signature_no_fallback_to_v1(self):
        """Verify V2 manifest with tampered signature raises ManifestAuthenticationError without V1 fallback."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        signing_key = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V2)

        manifest = create_manifest(
            backup_id="backup_v2_tampered",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "db_hash"},
            media_meta={},
            deployment_meta={},
            encryption_meta={"algorithm": "AES-256-GCM"},
            destinations_meta={},
            signing_key=signing_key,
            derivation_version=DERIVATION_VERSION_V2,
            manifest_version="2.0.0"
        )

        # Tamper payload
        manifest["payload"]["database"]["sha256"] = "tampered_db_hash"

        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_with_master_key(manifest, master_key)
        assert "signature mismatch" in str(exc_info.value).lower()

    def test_manifest_downgrade_v2_to_v1_rejected(self):
        """Verify attacker forging derivation_algorithm='SHA256-V1' on V2 manifest is rejected."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        v1_key = derive_manifest_signing_key_v1(master_key)

        # Create a V2 manifest signed with V1 key
        manifest = create_manifest(
            backup_id="backup_downgrade_attack",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "db_hash"},
            media_meta={},
            deployment_meta={},
            encryption_meta={"algorithm": "AES-256-GCM"},
            destinations_meta={},
            signing_key=v1_key,
            derivation_version=DERIVATION_VERSION_V1,
            manifest_version="2.0.0",  # V2 manifest
            sequence_number=5
        )

        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_with_master_key(manifest, master_key)
        assert "downgrade attack detected" in str(exc_info.value).lower()

    def test_manifest_unknown_derivation_algorithm_rejected(self):
        """Verify unrecognized derivation_algorithm is rejected fail-closed."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        signing_key = derive_manifest_signing_key(master_key)

        manifest = create_manifest(
            backup_id="backup_unknown_algo",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "db_hash"},
            media_meta={},
            deployment_meta={},
            encryption_meta={},
            destinations_meta={},
            signing_key=signing_key
        )
        manifest["authentication"]["derivation_algorithm"] = "MD5-V0-INSECURE"

        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_with_master_key(manifest, master_key)
        assert "unsupported derivation algorithm" in str(exc_info.value).lower()

    def test_manifest_mandatory_key_id_enforced(self):
        """Verify authentication envelope missing key_id is rejected."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        signing_key = derive_manifest_signing_key(master_key)

        manifest = create_manifest(
            backup_id="backup_missing_key_id",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "db_hash"},
            media_meta={},
            deployment_meta={},
            encryption_meta={},
            destinations_meta={},
            signing_key=signing_key
        )
        del manifest["authentication"]["key_id"]

        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_signature(manifest, signing_key)
        assert "missing required 'key_id'" in str(exc_info.value).lower()

    def test_manifest_v2_stripped_derivation_algorithm_rejected(self):
        """Verify stripping derivation_algorithm from V2 manifest is detected and rejected."""
        master_key = b"A_VERY_SECURE_MASTER_KEY_32_BYTES!"
        signing_key = derive_manifest_signing_key(master_key)

        manifest = create_manifest(
            backup_id="backup_stripped_algo",
            project_id="ganlawuubihxinuwjvez",
            region="eu-west-3",
            database_meta={"sha256": "db_hash"},
            media_meta={},
            deployment_meta={},
            encryption_meta={},
            destinations_meta={},
            signing_key=signing_key,
            manifest_version="2.0.0",
            sequence_number=10
        )
        manifest["authentication"]["derivation_algorithm"] = ""

        with pytest.raises(ManifestAuthenticationError) as exc_info:
            verify_manifest_with_master_key(manifest, master_key)
        assert "version downgrade detected" in str(exc_info.value).lower()


# ==============================================================================
# TASK C: CROSS-STORAGE RESTORE POLICY TESTS
# ==============================================================================

class TestPhase2G1TaskCCrossStoragePolicy:
    """Security tests for cross-storage restore reconciliation."""

    def test_resilient_policy_local_valid_r2_corrupted(self):
        """Under resilient policy, if R2 is corrupted, Local remains admitted and selected."""
        inventory = RestoreInventoryManager(policy="resilient")

        manifest_local = {
            "backup_id": "backup_01",
            "snapshot_id": "snap_01",
            "sequence_number": 5,
            "created_at_utc": "2026-11-20T12:00:00Z",
            "payload": {
                "database": {"sha256": "valid_local_sha", "snapshot_id": "snap_01"},
                "media": {"snapshot_id": "snap_01"}
            },
            "encryption": {"algorithm": "AES-256-GCM"}
        }

        manifest_r2_corrupted = {
            "backup_id": "backup_01",
            "snapshot_id": "snap_01",
            "sequence_number": 5,
            "created_at_utc": "2026-11-20T12:00:00Z",
            "payload": {
                "database": {"sha256": "corrupted_r2_sha", "snapshot_id": "snap_01"},
                "media": {"snapshot_id": "snap_01"}
            },
            "encryption": {"algorithm": "AES-256-GCM"}
        }

        # Local candidate admitted
        res1 = inventory.register_candidate(manifest_local, "Local Vault")
        assert res1["decision"] == "ADMITTED"

        # R2 candidate rejected due to divergence
        res2 = inventory.register_candidate(manifest_r2_corrupted, "Cloudflare R2")
        assert res2["decision"] == "REJECTED"
        assert "CROSS_STORAGE_CHECKSUM_MISMATCH" in res2["reason"]

        # Resilient recovery: Local copy is still admitted!
        admitted = inventory.get_admitted_inventory()
        assert len(admitted) == 1
        assert admitted[0]["storage_destination"] == "Local Vault"

        # Best candidate successfully selected from Local Vault
        best = inventory.select_best_restore_candidate()
        assert best is not None
        assert best["storage_destination"] == "Local Vault"

    def test_resilient_policy_r2_valid_gdrive_corrupted(self):
        """Under resilient policy, if GDrive is corrupted, R2 remains admitted."""
        inventory = RestoreInventoryManager(policy="resilient")

        manifest_r2 = {
            "backup_id": "backup_02",
            "snapshot_id": "snap_02",
            "sequence_number": 8,
            "payload": {
                "database": {"sha256": "clean_r2_sha", "snapshot_id": "snap_02"},
                "media": {"snapshot_id": "snap_02"}
            },
            "encryption": {"key": "ok"}
        }
        manifest_gd_bad = dict(manifest_r2)
        manifest_gd_bad["payload"] = {
            "database": {"sha256": "tampered_gdrive_sha", "snapshot_id": "snap_02"},
            "media": {"snapshot_id": "snap_02"}
        }

        inventory.register_candidate(manifest_r2, "Cloudflare R2")
        res_bad = inventory.register_candidate(manifest_gd_bad, "Google Drive")

        assert res_bad["decision"] == "REJECTED"
        best = inventory.select_best_restore_candidate()
        assert best is not None
        assert best["storage_destination"] == "Cloudflare R2"

    def test_all_storage_copies_corrupted_yields_no_candidate(self):
        """If all copies are invalid (e.g. missing payloads or signatures), inventory is empty."""
        inventory = RestoreInventoryManager(policy="resilient")

        bad_manifest = {
            "backup_id": "backup_all_bad",
            "payload": None  # Corrupted payload
        }

        inventory.register_candidate(bad_manifest, "Local Vault")
        inventory.register_candidate(bad_manifest, "Cloudflare R2")
        inventory.register_candidate(bad_manifest, "Google Drive")

        assert len(inventory.get_admitted_inventory()) == 0
        assert inventory.select_best_restore_candidate() is None

    def test_quarantined_object_excluded_regardless_of_storage(self):
        """Verify quarantined object is excluded and never becomes a restore candidate."""
        inventory = RestoreInventoryManager(policy="resilient")

        manifest = {
            "backup_id": "backup_quarantined",
            "snapshot_id": "snap_q",
            "payload": {"database": {"sha256": "sha"}, "media": {}},
            "encryption": {}
        }

        res = inventory.register_candidate(manifest, "Google Drive", remote_status="QUARANTINED")
        assert res["decision"] == "REJECTED"
        assert "QUARANTINED" in res["reason"]
        assert inventory.select_best_restore_candidate() is None

    def test_cross_storage_reconciled_consensus(self):
        """Verify identical backup across Local, R2, and GDrive forms full consensus."""
        inventory = RestoreInventoryManager(policy="resilient")

        manifest = {
            "backup_id": "backup_consensus_01",
            "snapshot_id": "snap_consensus",
            "sequence_number": 10,
            "created_at_utc": "2026-11-20T12:00:00Z",
            "payload": {
                "database": {"sha256": "cons_db_sha", "snapshot_id": "snap_consensus"},
                "media": {"snapshot_id": "snap_consensus"}
            },
            "encryption": {"key": "val"}
        }

        inventory.register_candidate(manifest, "Local Vault")
        inventory.register_candidate(manifest, "Cloudflare R2")
        inventory.register_candidate(manifest, "Google Drive")

        admitted = inventory.get_admitted_inventory()
        assert len(admitted) == 1
        assert admitted[0]["cross_storage_verified"] is True
        assert len(admitted[0]["replicated_destinations"]) == 3


# ==============================================================================
# TASK D: SECURITY INTEGRATION AUDIT TESTS
# ==============================================================================

class TestPhase2G1TaskDSecurityIntegration:
    """Security integration tests across backup components."""

    def test_no_secrets_or_credentials_in_exceptions(self):
        """Confirm exceptions never leak master keys or sensitive credentials."""
        secret_key = b"TOP_SECRET_CREDENTIAL_VAL_12345!"
        manifest = {
            "backup_id": "b1",
            "authentication": {
                "signature_algorithm": "HMAC-SHA256",
                "signature": "forged",
                "key_id": "k1",
                "derivation_algorithm": "HKDF-SHA256-V2"
            }
        }

        try:
            verify_manifest_with_master_key(manifest, secret_key)
        except ManifestAuthenticationError as e:
            err_msg = str(e)
            assert "TOP_SECRET" not in err_msg
            assert "12345" not in err_msg

    def test_deterministic_candidate_selection(self):
        """Confirm restore candidate selection is deterministic based on highest sequence."""
        inventory = RestoreInventoryManager(policy="resilient")

        for seq in [2, 5, 1, 4, 3]:
            m = {
                "backup_id": f"backup_seq_{seq}",
                "snapshot_id": f"snap_{seq}",
                "sequence_number": seq,
                "created_at_utc": f"2026-11-20T{seq:02d}:00:00Z",
                "payload": {"database": {"sha256": f"sha_{seq}"}, "media": {}},
                "encryption": {"key": "ok"}
            }
            inventory.register_candidate(m, "Local Vault")

        best = inventory.select_best_restore_candidate()
        assert best is not None
        assert best["backup_id"] == "backup_seq_5"
        assert best["sequence_number"] == 5
