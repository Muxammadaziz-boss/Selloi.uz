"""PostgreSQL backup module for Selloi Backup System - Hardened Phase 2A.

Coordinates PostgreSQL custom-format (pg_dump -Fc) database exports.
Separates application database dumps from cluster-wide global objects.
Validates client version compatibility (PostgreSQL 17) and detects pooler modes.
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from .config import DatabaseConfig

# Documentation of required privileges for minimal backup role:
# Standard PostgreSQL 14+ best practice is to grant pg_read_all_data to backup role.
MINIMAL_BACKUP_ROLE_SQL = """
-- Selloi Dedicated Least-Privilege Read-Only Backup Role
-- (To be reviewed for future deployment; NOT executed in Phase 2A)
CREATE ROLE selloi_backup_worker WITH LOGIN NOINHERIT PASSWORD 'REDACTED';
GRANT CONNECT ON DATABASE postgres TO selloi_backup_worker;
GRANT pg_read_all_data TO selloi_backup_worker;
-- Or schema-specific grants:
-- GRANT USAGE ON SCHEMA public, auth, storage, vault TO selloi_backup_worker;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public, auth, storage TO selloi_backup_worker;
"""


class PostgresBackupError(Exception):
    """Raised when database dump generation fails."""
    pass


def inspect_pooler_compatibility(db_config: DatabaseConfig) -> Tuple[bool, str]:
    """Inspect whether the database target is compatible with pg_dump.
    
    pg_dump requires a single persistent session with advisory locks and
    snapshot export capability. Transaction-mode poolers (PgBouncer port 6543)
    are fundamentally incompatible and will abort with transaction errors.
    """
    if db_config.port == 6543 or db_config.is_transaction_pooler:
        return (
            False,
            "INCOMPATIBLE: Target is connected via Transaction-Mode Pooler (port 6543). "
            "pg_dump requires a Direct Connection or Session-Mode Pooler (port 5432) "
            "to maintain snapshot consistency."
        )
    return True, "COMPATIBLE: Direct or session-mode connection detected."


def get_pg_dump_version() -> Optional[int]:
    """Get the major version of the installed pg_dump binary."""
    pg_dump_bin = shutil.which("pg_dump")
    if not pg_dump_bin:
        return None

    try:
        proc = subprocess.run(
            [pg_dump_bin, "--version"],
            capture_output=True,
            text=True,
            check=True
        )
        output = proc.stdout.strip()
        parts = output.split()
        for part in parts:
            if part.replace(".", "").isdigit():
                major = int(part.split(".")[0])
                return major
    except Exception:
        pass
    return None


def validate_client_version(required_major: int = 17) -> Tuple[bool, str]:
    """Validate that local pg_dump matches or exceeds production PostgreSQL major version."""
    version = get_pg_dump_version()
    if version is None:
        return False, "pg_dump binary not found on system PATH."
    if version < required_major:
        return False, f"pg_dump version {version} is older than required production major version {required_major}."
    return True, f"pg_dump version {version} is compatible."


def create_synthetic_dump(output_path: Path, metadata: Dict[str, Any]) -> Path:
    """Create a verified synthetic custom-format dump for testing and validation."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Custom synthetic header matching PostgreSQL custom format magic
    synthetic_payload = b"PGDMP\x01\x11\x00"  # PostgreSQL 17 synthetic header
    body = (
        f"-- Selloi Synthetic Database Dump\n"
        f"-- Project: {metadata.get('project_id', 'synthetic')}\n"
        f"-- Tables: 22 public tables\n"
        f"-- Roles & Globals: Excluded (Application database dump only)\n"
        f"-- Status: SYNTHETIC_VERIFIED\n"
    ).encode("utf-8")
    
    with open(output_path, "wb") as f:
        f.write(synthetic_payload + body)
    return output_path


def dump_database(
    db_config: DatabaseConfig,
    output_path: Path,
    mock_mode: bool = False,
    extra_metadata: Optional[Dict[str, Any]] = None
) -> Path:
    """Execute pg_dump -Fc to generate a custom-format PostgreSQL dump.
    
    In mock_mode, creates a safe synthetic archive without touching production.
    Notice: Uses --no-owner and --no-privileges to ensure clean restore portability.
    """
    if mock_mode:
        meta = extra_metadata or {}
        return create_synthetic_dump(output_path, meta)

    # In real mode, check pooler compatibility first
    is_compatible, msg = inspect_pooler_compatibility(db_config)
    if not is_compatible:
        raise PostgresBackupError(msg)

    is_valid_ver, ver_msg = validate_client_version(17)
    if not is_valid_ver:
        raise PostgresBackupError(ver_msg)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_output = output_path.with_name(f"{output_path.name}.tmp")

    env = os.environ.copy()
    if db_config.password:
        env["PGPASSWORD"] = db_config.password

    cmd = [
        "pg_dump",
        "-h", db_config.host,
        "-p", str(db_config.port),
        "-U", db_config.user,
        "-d", db_config.database,
        "-Fc",  # Custom format
        "--no-owner",
        "--no-privileges",
        "-f", str(temp_output)
    ]

    try:
        proc = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            check=True
        )
        if temp_output.exists():
            temp_output.rename(output_path)
            return output_path
        raise PostgresBackupError("pg_dump finished but output file was not created.")
    except subprocess.CalledProcessError as e:
        if temp_output.exists():
            temp_output.unlink()
        err_msg = e.stderr.replace(db_config.password, "***REDACTED***") if db_config.password else e.stderr
        raise PostgresBackupError(f"pg_dump failed with exit code {e.returncode}: {err_msg}") from e
    except Exception as e:
        if temp_output.exists():
            temp_output.unlink()
        raise PostgresBackupError(f"Database dump error: {e}") from e
