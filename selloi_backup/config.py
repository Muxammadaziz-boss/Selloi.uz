"""Configuration management for Selloi Backup System.

Loads and validates settings from environment variables and configuration files.
Guarantees zero leakage of database passwords, tokens, or encryption keys in logs.
"""

import os
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any, Union, List
from .storage_base import StorageConfigurationConflictError

DEFAULT_LOCAL_BACKUP_DIR = "/var/backups/selloi"
DEFAULT_MEDIA_DIR = "storage/channel_images"


def resolve_storage_env_var(
    canonical_key: str,
    legacy_keys: Union[str, List[str]],
    default: str = ""
) -> str:
    """Resolve environment variable with canonical precedence and conflict detection.

    Precedence:
    1. Canonical variable takes precedence over legacy aliases.
    2. If both canonical and legacy are set:
       - If values are identical, accept the value.
       - If values differ, raise StorageConfigurationConflictError and fail closed.
    3. If multiple legacy keys are set and differ, raise StorageConfigurationConflictError.
    4. If only one key is set, return its value.
    5. If none are set, return default.
    """
    if isinstance(legacy_keys, str):
        legacy_list = [legacy_keys]
    else:
        legacy_list = list(legacy_keys)

    canonical_val = os.getenv(canonical_key)
    if canonical_val is not None:
        canonical_val = canonical_val.strip()

    active_legacy = {}
    for leg_k in legacy_list:
        leg_v = os.getenv(leg_k)
        if leg_v is not None and leg_v.strip():
            active_legacy[leg_k] = leg_v.strip()

    # Check for conflicts among multiple legacy aliases
    distinct_legacy_vals = set(active_legacy.values())
    if len(distinct_legacy_vals) > 1:
        raise StorageConfigurationConflictError(
            f"Configuration conflict detected among legacy aliases {list(active_legacy.keys())}. "
            f"Conflicting values found. System failing closed."
        )

    single_legacy_val = next(iter(distinct_legacy_vals)) if distinct_legacy_vals else None

    # Check for conflict between canonical and legacy
    if canonical_val and single_legacy_val:
        if canonical_val != single_legacy_val:
            first_legacy_key = next(iter(active_legacy.keys()))
            raise StorageConfigurationConflictError(
                f"Configuration conflict detected between canonical '{canonical_key}' "
                f"and legacy '{first_legacy_key}'. Values differ. System failing closed."
            )
        return canonical_val

    if canonical_val:
        return canonical_val

    if single_legacy_val:
        return single_legacy_val

    return default


@dataclass
class DatabaseConfig:
    connection_url: str = ""
    host: str = ""
    port: int = 5432
    user: str = ""
    password: str = ""
    database: str = ""
    ssl_mode: str = "require"
    is_session_pooler: bool = False
    is_transaction_pooler: bool = False

    @classmethod
    def from_url(cls, url: str) -> "DatabaseConfig":
        if not url:
            return cls()
        
        # Parse basic components without external URL parsers to handle special chars safely
        cfg = cls(connection_url=url)
        clean_url = url
        if clean_url.startswith("postgresql+asyncpg://"):
            clean_url = clean_url.replace("postgresql+asyncpg://", "postgres://")
        elif clean_url.startswith("postgresql://"):
            clean_url = clean_url.replace("postgresql://", "postgres://")

        try:
            from urllib.parse import urlparse, unquote
            parsed = urlparse(clean_url)
            cfg.host = parsed.hostname or ""
            cfg.port = parsed.port or 5432
            cfg.user = unquote(parsed.username or "")
            cfg.password = unquote(parsed.password or "")
            cfg.database = parsed.path.lstrip("/") or "postgres"

            # Check pooler characteristics
            if cfg.port == 6543 or "pooler" in cfg.host and "transaction" in cfg.host:
                cfg.is_transaction_pooler = True
            elif cfg.port == 5432 or "session" in cfg.host:
                cfg.is_session_pooler = True
        except Exception:
            pass
        return cfg

    def sanitize(self) -> Dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "user": self.user,
            "database": self.database,
            "ssl_mode": self.ssl_mode,
            "is_session_pooler": self.is_session_pooler,
            "is_transaction_pooler": self.is_transaction_pooler,
            "password": "***REDACTED***" if self.password else ""
        }


@dataclass
class StorageConfig:
    local_enabled: bool = True
    local_dir: str = DEFAULT_LOCAL_BACKUP_DIR
    r2_enabled: bool = False
    r2_endpoint: str = ""
    r2_bucket: str = ""
    r2_access_key: str = ""
    r2_secret_key: str = ""
    gdrive_enabled: bool = False
    gdrive_folder_id: str = ""
    gdrive_service_account_json: str = ""

    def sanitize(self) -> Dict[str, Any]:
        return {
            "local_enabled": self.local_enabled,
            "local_dir": self.local_dir,
            "r2_enabled": self.r2_enabled,
            "r2_endpoint": self.r2_endpoint,
            "r2_bucket": self.r2_bucket,
            "r2_access_key": "***REDACTED***" if self.r2_access_key else "",
            "r2_secret_key": "***REDACTED***" if self.r2_secret_key else "",
            "gdrive_enabled": self.gdrive_enabled,
            "gdrive_folder_id": self.gdrive_folder_id,
            "gdrive_service_account_json": "***CONFIGURED***" if self.gdrive_service_account_json else ""
        }


@dataclass
class RetentionConfig:
    daily_days: int = 30
    weekly_weeks: int = 8
    monthly_months: int = 12
    dry_run: bool = True  # Always dry-run until explicitly authorized


@dataclass
class BackupConfig:
    project_id: str = "ganlawuubihxinuwjvez"
    region: str = "eu-west-3"
    environment: str = "production"
    encryption_key_file: str = "/etc/selloi/selloi_backup.key"
    media_dir: str = DEFAULT_MEDIA_DIR
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    storage: StorageConfig = field(default_factory=StorageConfig)
    retention: RetentionConfig = field(default_factory=RetentionConfig)
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    @classmethod
    def load(cls, config_path: Optional[str] = None) -> "BackupConfig":
        cfg = cls()

        # Load environment variables if .env exists
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        # Database URL
        db_url = os.getenv("BACKUP_DATABASE_URL") or os.getenv("DATABASE_URL") or ""
        cfg.database = DatabaseConfig.from_url(db_url)

        # Storage settings: Reconcile standard and legacy environment variable names
        cfg.storage.local_enabled = os.getenv("BACKUP_LOCAL_ENABLED", "true").lower() == "true"
        cfg.storage.local_dir = os.getenv("BACKUP_LOCAL_DIR", DEFAULT_LOCAL_BACKUP_DIR)

        # Cloudflare R2 resolution with strict canonical precedence and conflict detection
        r2_account_id = resolve_storage_env_var("R2_ACCOUNT_ID", "BACKUP_R2_ACCOUNT_ID", default="")
        derived_endpoint = f"https://{r2_account_id}.r2.cloudflarestorage.com" if r2_account_id else ""
        r2_endpoint = resolve_storage_env_var("R2_ENDPOINT_URL", "BACKUP_R2_ENDPOINT", default=derived_endpoint)
        r2_bucket = resolve_storage_env_var("R2_BUCKET_NAME", "BACKUP_R2_BUCKET", default="selloi-backups")
        r2_access_key = resolve_storage_env_var("R2_ACCESS_KEY_ID", "BACKUP_R2_ACCESS_KEY", default="")
        r2_secret_key = resolve_storage_env_var("R2_SECRET_ACCESS_KEY", "BACKUP_R2_SECRET_KEY", default="")

        cfg.storage.r2_endpoint = r2_endpoint
        cfg.storage.r2_bucket = r2_bucket
        cfg.storage.r2_access_key = r2_access_key
        cfg.storage.r2_secret_key = r2_secret_key
        cfg.storage.r2_enabled = (
            os.getenv("BACKUP_R2_ENABLED", "false").lower() == "true"
            or bool(r2_access_key and r2_secret_key)
        )

        # Google Drive resolution with strict canonical precedence and conflict detection
        gd_folder_id = resolve_storage_env_var("GDRIVE_FOLDER_ID", "BACKUP_GDRIVE_FOLDER_ID", default="")
        gd_sa_json = resolve_storage_env_var(
            "GDRIVE_SERVICE_ACCOUNT_JSON",
            ["BACKUP_GDRIVE_SERVICE_ACCOUNT_JSON", "BACKUP_GDRIVE_CREDENTIALS_FILE"],
            default=""
        )
        cfg.storage.gdrive_folder_id = gd_folder_id
        cfg.storage.gdrive_service_account_json = gd_sa_json
        cfg.storage.gdrive_enabled = (
            os.getenv("BACKUP_GDRIVE_ENABLED", "false").lower() == "true"
            or bool(gd_folder_id and gd_sa_json)
        )

        # Key file
        cfg.encryption_key_file = os.getenv("BACKUP_ENCRYPTION_KEY_FILE", "/etc/selloi/selloi_backup.key")
        cfg.media_dir = os.getenv("BACKUP_MEDIA_DIR", DEFAULT_MEDIA_DIR)

        # Alerts
        cfg.telegram_bot_token = os.getenv("BACKUP_TELEGRAM_BOT_TOKEN", os.getenv("TELEGRAM_BOT_TOKEN", ""))
        cfg.telegram_chat_id = os.getenv("BACKUP_TELEGRAM_CHAT_ID", "")

        # Override from config file if supplied
        if config_path and Path(config_path).exists():
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "project_id" in data:
                    cfg.project_id = data["project_id"]
                if "media_dir" in data:
                    cfg.media_dir = data["media_dir"]
                if "local_dir" in data.get("storage", {}):
                    cfg.storage.local_dir = data["storage"]["local_dir"]

        return cfg

    def sanitize(self) -> Dict[str, Any]:
        return {
            "project_id": self.project_id,
            "region": self.region,
            "environment": self.environment,
            "encryption_key_file": self.encryption_key_file,
            "media_dir": self.media_dir,
            "database": self.database.sanitize(),
            "storage": self.storage.sanitize(),
            "retention": {
                "daily_days": self.retention.daily_days,
                "weekly_weeks": self.retention.weekly_weeks,
                "monthly_months": self.retention.monthly_months,
                "dry_run": self.retention.dry_run
            },
            "telegram_bot_token": "***CONFIGURED***" if self.telegram_bot_token else "",
            "telegram_chat_id": self.telegram_chat_id
        }
