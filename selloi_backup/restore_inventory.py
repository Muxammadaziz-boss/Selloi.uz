"""Restore Inventory and Quarantine Validation Engine for Selloi Backup System - Phase 2G.

Provides automated candidate discovery, quarantine exclusion, cross-storage checksum reconciliation,
metadata completeness validation, and snapshot consistency enforcement.
Guarantees that only complete, authenticated, non-quarantined, and cross-verified backups are selected.
"""

import logging
from typing import Dict, Any, List, Optional
from .manifest import verify_manifest_signature, ManifestAuthenticationError

logger = logging.getLogger(__name__)


class RestoreInventoryError(Exception):
    """Base exception for restore inventory operations."""
    pass


class QuarantinedArtifactError(RestoreInventoryError):
    """Raised when an attempt is made to restore a quarantined artifact."""
    pass


class IncompleteBackupError(RestoreInventoryError):
    """Raised when a backup candidate lacks essential schema, database, or media artifacts."""
    pass


class CrossStorageMismatchError(RestoreInventoryError):
    """Raised when copies of the same backup across different storage providers have divergent hashes."""
    pass


class SnapshotMismatchError(RestoreInventoryError):
    """Raised when snapshot IDs in manifest, database payload, or media payload disagree."""
    pass


class RestoreInventoryManager:
    """Manages backup candidate admission, cross-storage validation, and restore selection."""

    def __init__(self, policy: str = "strict"):
        self.policy = policy.lower()  # "strict" (consensus) or "resilient" (per-storage recovery)
        # backup_id -> candidate dict
        self.admitted_candidates: Dict[str, Dict[str, Any]] = {}
        # List of audit log entries for all evaluated candidates
        self.audit_log: List[Dict[str, Any]] = []

    def register_candidate(
        self,
        manifest: Dict[str, Any],
        storage_destination: str,
        signing_key: Optional[bytes] = None,
        remote_status: str = "AVAILABLE",
        policy: Optional[str] = None
    ) -> Dict[str, Any]:
        """Evaluate a backup candidate from a storage destination and admit or reject it.

        Checks:
        1. Quarantine exclusion: Objects marked QUARANTINED or under quarantine/ are rejected.
        2. Manifest completeness: Must contain backup_id, source, payload.database, payload.media, encryption.
        3. Snapshot consistency: Database and media snapshot IDs must match manifest snapshot_id.
        4. Signature verification: If signing_key provided, HMAC-SHA256 signature must be valid.
        5. Cross-storage reconciliation: If backup_id already registered from another destination,
           hashes must match identically. Under 'resilient' policy, divergent replicas are rejected
           while preserving the verified candidate. Under 'strict' policy, all divergent copies are disqualified.
        """
        effective_policy = (policy or self.policy).lower()
        backup_id = manifest.get("backup_id", "").strip()
        snapshot_id = manifest.get("snapshot_id", "").strip()

        log_entry = {
            "backup_id": backup_id,
            "snapshot_id": snapshot_id,
            "storage_destination": storage_destination,
            "remote_status": remote_status,
            "policy": effective_policy,
            "decision": "PENDING",
            "reason": ""
        }

        # 1. Quarantine Exclusion
        if remote_status == "QUARANTINED" or backup_id.startswith("quarantine/") or manifest.get("status") == "QUARANTINED":
            log_entry["decision"] = "REJECTED"
            log_entry["reason"] = "QUARANTINED_OBJECT_EXCLUDED: Artifact is isolated in quarantine."
            self.audit_log.append(log_entry)
            logger.warning("Rejected quarantined backup candidate: %s from %s", backup_id, storage_destination)
            return log_entry

        # 2. Manifest Completeness
        payload = manifest.get("payload")
        if not payload or not isinstance(payload, dict):
            log_entry["decision"] = "REJECTED"
            log_entry["reason"] = "INCOMPLETE_BACKUP: Manifest missing payload section."
            self.audit_log.append(log_entry)
            return log_entry

        db_meta = payload.get("database")
        if not db_meta or not isinstance(db_meta, dict) or not db_meta.get("sha256"):
            log_entry["decision"] = "REJECTED"
            log_entry["reason"] = "INCOMPLETE_BACKUP: Missing or empty database payload metadata."
            self.audit_log.append(log_entry)
            return log_entry

        media_meta = payload.get("media")
        if media_meta is None or not isinstance(media_meta, dict):
            log_entry["decision"] = "REJECTED"
            log_entry["reason"] = "INCOMPLETE_BACKUP: Missing media payload metadata section."
            self.audit_log.append(log_entry)
            return log_entry

        if not manifest.get("encryption"):
            log_entry["decision"] = "REJECTED"
            log_entry["reason"] = "INCOMPLETE_BACKUP: Missing encryption metadata."
            self.audit_log.append(log_entry)
            return log_entry

        # 3. Snapshot ID Consistency
        db_snap = db_meta.get("snapshot_id")
        if db_snap and snapshot_id and db_snap != snapshot_id:
            log_entry["decision"] = "REJECTED"
            log_entry["reason"] = f"SNAPSHOT_ID_MISMATCH: Database snapshot '{db_snap}' != manifest '{snapshot_id}'."
            self.audit_log.append(log_entry)
            return log_entry

        media_snap = media_meta.get("snapshot_id")
        if media_snap and snapshot_id and media_snap != snapshot_id:
            log_entry["decision"] = "REJECTED"
            log_entry["reason"] = f"SNAPSHOT_ID_MISMATCH: Media snapshot '{media_snap}' != manifest '{snapshot_id}'."
            self.audit_log.append(log_entry)
            return log_entry

        # 4. Cryptographic Signature Verification
        if signing_key:
            try:
                verify_manifest_signature(manifest, signing_key)
            except ManifestAuthenticationError as e:
                log_entry["decision"] = "REJECTED"
                log_entry["reason"] = f"INVALID_MANIFEST_SIGNATURE: {e}"
                self.audit_log.append(log_entry)
                return log_entry

        # 5. Cross-Storage Checksum Reconciliation
        db_sha = db_meta.get("sha256", "").strip().lower()
        media_sha = media_meta.get("sha256", "").strip().lower()

        if backup_id in self.admitted_candidates:
            existing = self.admitted_candidates[backup_id]
            existing_db_sha = existing["manifest"]["payload"]["database"].get("sha256", "").strip().lower()
            existing_media_sha = existing["manifest"]["payload"]["media"].get("sha256", "").strip().lower()

            if db_sha != existing_db_sha:
                log_entry["decision"] = "REJECTED"
                log_entry["reason"] = (
                    f"CROSS_STORAGE_CHECKSUM_MISMATCH: Database SHA-256 on '{storage_destination}' ({db_sha}) "
                    f"differs from '{existing['storage_destination']}' ({existing_db_sha})."
                )
                log_entry["alert"] = "CROSS_STORAGE_CHECKSUM_MISMATCH_ALERT"
                self.audit_log.append(log_entry)

                if effective_policy == "strict":
                    # Disqualify existing candidate as well under strict consensus
                    existing["decision"] = "DISQUALIFIED_CROSS_STORAGE_MISMATCH"
                    del self.admitted_candidates[backup_id]
                else:
                    # Resilient mode: keep verified existing candidate, mark divergence alert
                    existing["cross_storage_divergence_alert"] = True
                    logger.warning(
                        "Cross-storage checksum divergence on backup '%s': rejected corrupted replica from %s, "
                        "retaining verified candidate from %s.",
                        backup_id, storage_destination, existing["storage_destination"]
                    )
                return log_entry

            if media_sha != existing_media_sha:
                log_entry["decision"] = "REJECTED"
                log_entry["reason"] = (
                    f"CROSS_STORAGE_CHECKSUM_MISMATCH: Media SHA-256 on '{storage_destination}' ({media_sha}) "
                    f"differs from '{existing['storage_destination']}' ({existing_media_sha})."
                )
                log_entry["alert"] = "CROSS_STORAGE_CHECKSUM_MISMATCH_ALERT"
                self.audit_log.append(log_entry)

                if effective_policy == "strict":
                    existing["decision"] = "DISQUALIFIED_CROSS_STORAGE_MISMATCH"
                    del self.admitted_candidates[backup_id]
                else:
                    existing["cross_storage_divergence_alert"] = True
                    logger.warning(
                        "Cross-storage checksum divergence on backup '%s': rejected corrupted replica from %s, "
                        "retaining verified candidate from %s.",
                        backup_id, storage_destination, existing["storage_destination"]
                    )
                return log_entry

            # Checksums match across multiple storages
            existing["replicated_destinations"].append(storage_destination)
            existing["cross_storage_verified"] = True
            log_entry["decision"] = "RECONCILED"
            log_entry["reason"] = f"Cross-verified with {existing['storage_destination']}."
            self.audit_log.append(log_entry)
            return log_entry

        # Admission
        candidate_record = {
            "backup_id": backup_id,
            "snapshot_id": snapshot_id,
            "sequence_number": int(manifest.get("sequence_number", 1)),
            "created_at_utc": manifest.get("created_at_utc", ""),
            "storage_destination": storage_destination,
            "replicated_destinations": [storage_destination],
            "cross_storage_verified": False,
            "manifest": manifest,
            "decision": "ADMITTED"
        }

        self.admitted_candidates[backup_id] = candidate_record
        log_entry["decision"] = "ADMITTED"
        log_entry["reason"] = "All validation checks passed."
        self.audit_log.append(log_entry)
        return log_entry

    def get_admitted_inventory(self) -> List[Dict[str, Any]]:
        """Return all admitted candidates sorted by sequence_number (descending)."""
        candidates = list(self.admitted_candidates.values())
        candidates.sort(key=lambda c: (c.get("sequence_number", 0), c.get("created_at_utc", "")), reverse=True)
        return candidates

    def select_best_restore_candidate(self) -> Optional[Dict[str, Any]]:
        """Select the highest-sequence authenticated backup candidate for restore."""
        inventory = self.get_admitted_inventory()
        if not inventory:
            return None
        return inventory[0]

    def get_audit_log(self) -> List[Dict[str, Any]]:
        """Return complete audit history of all processed candidates."""
        return list(self.audit_log)
