"""Selloi Backup Infrastructure - Phase 2G Hardened Implementation.

Enterprise-grade, multi-destination, authenticated encrypted backup and disaster recovery system for Selloi.uz.
"""

from .config import BackupConfig, DatabaseConfig, StorageConfig, resolve_storage_env_var
from .storage_base import (
    StorageAdapter,
    StorageAdapterError,
    StorageAuthenticationError,
    StoragePermissionError,
    StorageTransientError,
    StorageTimeoutError,
    StorageIntegrityError,
    StorageDuplicateConflictError,
    StorageConfigurationConflictError,
    execute_with_retry
)
from .storage_r2 import R2StorageAdapter
from .storage_gdrive import GDriveStorageAdapter
from .storage_local import LocalStorageAdapter
from .manifest import (
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
    load_and_verify_manifest,
    ManifestError,
    ManifestAuthenticationError,
    DERIVATION_VERSION_V1,
    DERIVATION_VERSION_V2
)
from .replay_protection import (
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
from .restore_inventory import (
    RestoreInventoryManager,
    RestoreInventoryError,
    QuarantinedArtifactError,
    IncompleteBackupError,
    CrossStorageMismatchError,
    SnapshotMismatchError
)
from .restore_validator import (
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

__version__ = "2.1.0"
