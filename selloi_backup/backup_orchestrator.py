"""Master backup orchestrator for Selloi Backup System.

Coordinates end-to-end multi-destination backup operations:
- PostgreSQL dump generation and integrity verification.
- Media directory packaging.
- Sanitized deployment metadata export.
- Authenticated AES-256-GCM encryption with unique nonces.
- Pre-transfer restore validation round-trip.
- Multi-destination distribution (Local, Cloudflare R2, Google Drive).
- Post-transfer size and checksum verification.
- Dry-run retention calculation.
- Telegram alerting.
"""

import os
import shutil
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

from .config import BackupConfig
from .backup_crypto import encrypt_file, load_key, validate_key
from .integrity import calculate_sha256, write_sha256_file
from .postgres_backup import dump_database, inspect_pooler_compatibility
from .media_backup import package_media_directory
from .manifest import create_manifest, save_manifest
from .restore_validator import verify_decryption_and_artifact
from .storage_local import LocalStorageAdapter
from .storage_r2 import R2StorageAdapter
from .storage_gdrive import GDriveStorageAdapter
from .retention import RetentionManager
from .alerting import AlertingManager


class BackupOrchestrator:
    """Coordinates the Selloi backup lifecycle."""

    def __init__(
        self,
        config: BackupConfig,
        encryption_key: Optional[bytes] = None,
        mock_mode: bool = False
    ):
        self.config = config
        self.mock_mode = mock_mode
        self._key = encryption_key
        self.alerter = AlertingManager(
            bot_token=config.telegram_bot_token,
            chat_id=config.telegram_chat_id
        )

    def get_encryption_key(self) -> bytes:
        if self._key:
            validate_key(self._key)
            return self._key
        return load_key(self.config.encryption_key_file)

    def generate_backup_id(self) -> str:
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        return f"selloi_backup_{now_str}"

    def collect_deployment_metadata(self, work_dir: Path) -> Path:
        """Export sanitized environment and deployment metadata (excluding all secrets)."""
        meta_file = work_dir / "deployment_metadata.json"
        
        sanitized_info = {
            "project_id": self.config.project_id,
            "region": self.config.region,
            "environment": self.config.environment,
            "source_of_truth": "Supabase PostgreSQL 17.11 (ganlawuubihxinuwjvez)",
            "database_connection_type": "Session-mode pooler / Direct connection",
            "docker_services": ["bot", "web", "db_staging", "redis"],
            "sanitized_config": self.config.sanitize(),
            "collected_at": datetime.now(timezone.utc).isoformat()
        }

        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(sanitized_info, f, indent=2)
        return meta_file

    def execute_backup(
        self,
        staging_root: Union[str, Path] = "/tmp/selloi_backup_stage"
    ) -> Dict[str, Any]:
        """Execute the full backup workflow."""
        backup_id = self.generate_backup_id()
        key = self.get_encryption_key()

        stage_path = Path(staging_root) / backup_id
        stage_path.mkdir(parents=True, exist_ok=True)

        execution_log = {
            "backup_id": backup_id,
            "status": "RUNNING",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "artifacts": {},
            "destinations": {},
            "retention": {}
        }

        try:
            # 1. Inspect pooler compatibility (if not in mock mode)
            if not self.mock_mode:
                is_compat, compat_msg = inspect_pooler_compatibility(self.config.database)
                if not is_compat:
                    raise RuntimeError(f"Database compatibility check failed: {compat_msg}")

            # 2. Database Export
            raw_db_file = stage_path / f"{backup_id}_postgres.dump"
            dump_database(
                db_config=self.config.database,
                output_path=raw_db_file,
                mock_mode=self.mock_mode,
                extra_metadata={"project_id": self.config.project_id}
            )
            raw_db_sha = calculate_sha256(raw_db_file)
            raw_db_size = raw_db_file.stat().st_size

            # 3. Media Directory Packaging
            raw_media_file = stage_path / f"{backup_id}_media.tar.gz"
            media_info = package_media_directory(
                media_dir_path=self.config.media_dir,
                output_archive_path=raw_media_file
            )
            raw_media_sha = calculate_sha256(raw_media_file)
            raw_media_size = raw_media_file.stat().st_size

            # 4. Deployment Metadata Export
            raw_meta_file = self.collect_deployment_metadata(stage_path)
            raw_meta_sha = calculate_sha256(raw_meta_file)
            raw_meta_size = raw_meta_file.stat().st_size

            # 5. Authenticated AES-256-GCM Encryption with Unique Nonces
            enc_db_file = stage_path / f"{backup_id}_postgres.dump.enc"
            encrypt_file(raw_db_file, enc_db_file, key)
            enc_db_sha = calculate_sha256(enc_db_file)
            write_sha256_file(enc_db_file)

            enc_media_file = stage_path / f"{backup_id}_media.tar.gz.enc"
            encrypt_file(raw_media_file, enc_media_file, key)
            enc_media_sha = calculate_sha256(enc_media_file)
            write_sha256_file(enc_media_file)

            enc_meta_file = stage_path / f"{backup_id}_metadata.json.enc"
            encrypt_file(raw_meta_file, enc_meta_file, key)
            enc_meta_sha = calculate_sha256(enc_meta_file)
            write_sha256_file(enc_meta_file)

            # 6. Pre-transfer Restore Validation Round-Trip
            val_db = verify_decryption_and_artifact(
                encrypted_path=enc_db_file,
                expected_plaintext_sha256=raw_db_sha,
                key=key,
                work_dir=stage_path / "val_db",
                mock_mode=self.mock_mode
            )
            val_media = verify_decryption_and_artifact(
                encrypted_path=enc_media_file,
                expected_plaintext_sha256=raw_media_sha,
                key=key,
                work_dir=stage_path / "val_media",
                mock_mode=self.mock_mode
            )

            # 7. Build Manifest
            database_meta = {
                "archive_name": enc_db_file.name,
                "encrypted_size_bytes": enc_db_file.stat().st_size,
                "encrypted_sha256": enc_db_sha,
                "plaintext_size_bytes": raw_db_size,
                "plaintext_sha256": raw_db_sha,
                "validation": val_db
            }
            media_meta = {
                "archive_name": enc_media_file.name,
                "file_count": media_info["file_count"],
                "encrypted_size_bytes": enc_media_file.stat().st_size,
                "encrypted_sha256": enc_media_sha,
                "plaintext_size_bytes": raw_media_size,
                "plaintext_sha256": raw_media_sha,
                "validation": val_media
            }
            deployment_meta = {
                "archive_name": enc_meta_file.name,
                "encrypted_size_bytes": enc_meta_file.stat().st_size,
                "encrypted_sha256": enc_meta_sha,
                "plaintext_sha256": raw_meta_sha
            }
            encryption_meta = {
                "algorithm": "AES-256-GCM",
                "chunk_size_bytes": 64 * 1024,
                "nonce_size_bytes": 12,
                "tag_size_bytes": 16,
                "key_derivation": "Direct 256-bit random key"
            }

            destinations_status = {}

            # 8. Multi-Destination Distribution
            # Destination 1: Local
            if self.config.storage.local_enabled:
                loc_adapter = LocalStorageAdapter(self.config.storage.local_dir)
                loc_db = loc_adapter.upload_file(enc_db_file, enc_db_file.name, enc_db_sha)
                loc_media = loc_adapter.upload_file(enc_media_file, enc_media_file.name, enc_media_sha)
                loc_meta = loc_adapter.upload_file(enc_meta_file, enc_meta_file.name, enc_meta_sha)
                destinations_status["local"] = {
                    "status": "VERIFIED",
                    "files": [loc_db, loc_media, loc_meta]
                }

            # Destination 2: Cloudflare R2
            if self.config.storage.r2_enabled or self.mock_mode:
                r2_adapter = R2StorageAdapter(
                    endpoint_url=self.config.storage.r2_endpoint,
                    bucket_name=self.config.storage.r2_bucket,
                    access_key=self.config.storage.r2_access_key,
                    secret_key=self.config.storage.r2_secret_key,
                    mock_mode=self.mock_mode
                )
                r2_db = r2_adapter.upload_file(enc_db_file, enc_db_file.name, enc_db_sha)
                r2_media = r2_adapter.upload_file(enc_media_file, enc_media_file.name, enc_media_sha)
                r2_meta = r2_adapter.upload_file(enc_meta_file, enc_meta_file.name, enc_meta_sha)
                destinations_status["r2"] = {
                    "status": "VERIFIED",
                    "files": [r2_db, r2_media, r2_meta]
                }

            # Destination 3: Google Drive
            if self.config.storage.gdrive_enabled or self.mock_mode:
                gdrive_adapter = GDriveStorageAdapter(
                    folder_id=self.config.storage.gdrive_folder_id,
                    service_account_json=self.config.storage.gdrive_service_account_json,
                    mock_mode=self.mock_mode
                )
                gd_db = gdrive_adapter.upload_file(enc_db_file, enc_db_file.name, enc_db_sha)
                gd_media = gdrive_adapter.upload_file(enc_media_file, enc_media_file.name, enc_media_sha)
                gd_meta = gdrive_adapter.upload_file(enc_meta_file, enc_meta_file.name, enc_meta_sha)
                destinations_status["gdrive"] = {
                    "status": "VERIFIED",
                    "files": [gd_db, gd_media, gd_meta]
                }

            # 9. Create and Save Manifest
            manifest_dict = create_manifest(
                backup_id=backup_id,
                project_id=self.config.project_id,
                region=self.config.region,
                database_meta=database_meta,
                media_meta=media_meta,
                deployment_meta=deployment_meta,
                encryption_meta=encryption_meta,
                destinations_meta=destinations_status
            )
            manifest_file = stage_path / "backup_manifest.json"
            save_manifest(manifest_dict, manifest_file)

            # Upload manifest to destinations
            manifest_sha = calculate_sha256(manifest_file)
            if self.config.storage.local_enabled:
                loc_adapter.upload_file(manifest_file, f"{backup_id}_manifest.json", manifest_sha)
            if self.config.storage.r2_enabled or self.mock_mode:
                r2_adapter.upload_file(manifest_file, f"{backup_id}_manifest.json", manifest_sha)
            if self.config.storage.gdrive_enabled or self.mock_mode:
                gdrive_adapter.upload_file(manifest_file, f"{backup_id}_manifest.json", manifest_sha)

            # 10. Dry-Run Retention Evaluation
            retention_mgr = RetentionManager(
                daily_days=self.config.retention.daily_days,
                weekly_weeks=self.config.retention.weekly_weeks,
                monthly_months=self.config.retention.monthly_months,
                dry_run=self.config.retention.dry_run
            )
            retention_report = retention_mgr.evaluate_retention(
                backups=[{"name": backup_id, "timestamp": datetime.now(timezone.utc).isoformat()}]
            )

            # Record success
            execution_log["status"] = "SUCCESS"
            execution_log["completed_at"] = datetime.now(timezone.utc).isoformat()
            execution_log["destinations"] = destinations_status
            execution_log["retention"] = retention_report
            execution_log["manifest"] = manifest_dict

            # 11. Send Success Alert
            self.alerter.send_alert(
                level="INFO",
                backup_id=backup_id,
                title="Backup Completed Successfully",
                details={
                    "Status": "VERIFIED across all destinations",
                    "Database Size": f"{raw_db_size} bytes",
                    "Media Files": media_info["file_count"],
                    "Destinations": list(destinations_status.keys())
                }
            )

            return execution_log
        except Exception as e:
            execution_log["status"] = "FAILED"
            execution_log["error"] = str(e)
            execution_log["failed_at"] = datetime.now(timezone.utc).isoformat()

            # Alert Failure
            self.alerter.send_alert(
                level="CRITICAL",
                backup_id=backup_id,
                title="Backup Failed",
                details={"Error": str(e)}
            )
            raise
        finally:
            # Clean up local staging directory safely
            if stage_path.exists():
                shutil.rmtree(stage_path, ignore_errors=True)
