"""Restore validation module for Selloi Backup System - Hardened Phase 2A.

Enforces strict isolation boundaries during restore rehearsals:
- Production target rejection: Prevents targeting Supabase or production databases.
- Unique staging database generation: Guarantees drills never overwrite existing databases.
- Teardown identity guards: Prevents dropping any database outside aisales_drill_*.
- Staging workspace boundary checks: Prevents cleanup escaping the temporary workspace.
- Engine version enforcement: Rejects restoring PostgreSQL 17 into PostgreSQL 16.
"""

import os
import secrets
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Union, Tuple, Optional
from .backup_crypto import decrypt_file, AuthenticationFailedError, CryptoError
from .integrity import verify_file_hash, calculate_sha256

FORBIDDEN_HOSTS = {
    "supabase.com",
    "aws-1-eu-west-3.pooler.supabase.com",
    "ganlawuubihxinuwjvez.supabase.co"
}

FORBIDDEN_DATABASES = {
    "postgres",
    "aisales",
    "production",
    "prod",
    "public"
}

FORBIDDEN_CONTAINERS = {
    "telegram_ai_seller-db-1",
    "telegram_ai_seller_db_1",
    "production-db",
    "prod-db"
}


class RestoreValidationError(Exception):
    """Raised when backup artifact validation fails."""
    pass


class IncompatibleEngineError(RestoreValidationError):
    """Raised when attempting to restore into an incompatible target engine."""
    pass


class TargetIsolationError(RestoreValidationError):
    """Raised when a restore target violates isolation safety rules."""
    pass


def validate_target_engine_version(target_major_version: int, dump_major_version: int = 17) -> None:
    """Validate that the target PostgreSQL restore engine is compatible.
    
    A PostgreSQL 17 dump CANNOT be restored into a PostgreSQL 16 or earlier engine.
    """
    if target_major_version < dump_major_version:
        raise IncompatibleEngineError(
            f"INCOMPATIBLE TARGET: Target engine version PostgreSQL {target_major_version} "
            f"cannot restore archives from source engine PostgreSQL {dump_major_version}."
        )


def validate_restore_target_safety(
    target_host: str,
    target_database: str,
    target_container: Optional[str] = None
) -> None:
    """Validate that the target restore environment is strictly an isolated drill target."""
    clean_host = (target_host or "").strip().lower()
    clean_db = (target_database or "").strip().lower()

    # 1. Reject production hosts
    for forbidden in FORBIDDEN_HOSTS:
        if forbidden in clean_host:
            raise TargetIsolationError(
                f"SAFETY VIOLATION: Target host '{clean_host}' is a production host! "
                "Restore rehearsals are strictly prohibited from targeting production."
            )

    # 2. Reject production database names
    if clean_db in FORBIDDEN_DATABASES:
        raise TargetIsolationError(
            f"SAFETY VIOLATION: Target database name '{clean_db}' is a protected production database name! "
            "Rehearsals must target dedicated drill databases matching 'aisales_drill_*'."
        )

    # Rehearsal databases must start with aisales_drill_ or aisales_test_
    if not (clean_db.startswith("aisales_drill_") or clean_db.startswith("aisales_test_")):
        raise TargetIsolationError(
            f"SAFETY VIOLATION: Target database '{clean_db}' does not follow the required "
            "safe naming convention 'aisales_drill_*'."
        )

    # 3. Reject production container names if Docker is used
    if target_container:
        clean_container = target_container.strip().lower()
        if clean_container in FORBIDDEN_CONTAINERS:
            raise TargetIsolationError(
                f"SAFETY VIOLATION: Target container '{clean_container}' is the production VPS database container!"
            )


def generate_unique_rehearsal_db_name() -> str:
    """Generate a guaranteed unique, safe staging database name for rehearsal."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    rand_suffix = secrets.token_hex(4)
    return f"aisales_drill_{timestamp}_{rand_suffix}"


def validate_safe_teardown_target(database_name: str) -> None:
    """Ensure that drop database commands only ever execute against safe drill databases."""
    clean_db = (database_name or "").strip().lower()
    if clean_db in FORBIDDEN_DATABASES:
        raise TargetIsolationError(f"CRITICAL: Refusing to drop protected database '{clean_db}'!")
    if not (clean_db.startswith("aisales_drill_") or clean_db.startswith("aisales_test_")):
        raise TargetIsolationError(
            f"CRITICAL: Refusing to drop database '{clean_db}' because it does not match 'aisales_drill_*'!"
        )


def validate_workspace_path_containment(workspace_dir: Union[str, Path], target_path: Union[str, Path]) -> Path:
    """Verify that a path is strictly contained within the intended workspace directory."""
    base = Path(workspace_dir).resolve()
    target = Path(target_path).resolve()
    try:
        target.relative_to(base)
    except ValueError as e:
        raise TargetIsolationError(f"PATH TRAVERSAL DETECTED: {target} is outside workspace {base}") from e
    return target


def validate_custom_dump_toc(dump_path: Path, mock_mode: bool = False) -> Tuple[bool, str]:
    """Inspect Table of Contents of a PostgreSQL custom-format dump using pg_restore -l."""
    if not dump_path.is_file():
        return False, f"Dump file not found: {dump_path}"

    if mock_mode:
        with open(dump_path, "rb") as f:
            header = f.read(5)
            if header == b"PGDMP":
                return True, "SYNTHETIC_TOC_VALID: PGDMP header verified."
            return False, "SYNTHETIC_TOC_INVALID: Missing PGDMP header."

    pg_restore_bin = shutil.which("pg_restore")
    if not pg_restore_bin:
        return False, "pg_restore binary not found on PATH."

    try:
        proc = subprocess.run(
            [pg_restore_bin, "-l", str(dump_path)],
            capture_output=True,
            text=True,
            check=True
        )
        return True, f"TOC valid: {len(proc.stdout.splitlines())} entries found."
    except subprocess.CalledProcessError as e:
        return False, f"pg_restore -l failed with code {e.returncode}: {e.stderr}"
    except Exception as e:
        return False, f"Error validating TOC: {e}"


def verify_decryption_and_artifact(
    encrypted_path: Union[str, Path],
    expected_plaintext_sha256: str,
    key: bytes,
    work_dir: Union[str, Path],
    mock_mode: bool = False,
    key_ring: Optional[Dict[bytes, bytes]] = None
) -> Dict[str, Any]:
    """Perform a complete test decryption and verification round-trip in an isolated workspace."""
    enc_p = Path(encrypted_path)
    work_p = Path(work_dir)
    work_p.mkdir(parents=True, exist_ok=True)

    decrypted_tmp = work_p / f"test_decrypted_{enc_p.name}.tmp"
    validate_workspace_path_containment(work_p, decrypted_tmp)

    try:
        # 1. Decrypt with GCM verification
        decrypt_file(enc_p, decrypted_tmp, key, key_ring=key_ring)

        # 2. Verify SHA-256 matches expected plaintext hash
        actual_sha = calculate_sha256(decrypted_tmp)
        if actual_sha.lower() != expected_plaintext_sha256.lower():
            raise RestoreValidationError(
                f"Decrypted plaintext SHA-256 mismatch: "
                f"expected {expected_plaintext_sha256}, got {actual_sha}"
            )

        # 3. If dump file, inspect TOC
        toc_valid, toc_msg = validate_custom_dump_toc(decrypted_tmp, mock_mode=mock_mode)
        if not toc_valid and not enc_p.name.endswith(".tar.gz.enc"):
            raise RestoreValidationError(f"Archive TOC validation failed: {toc_msg}")

        return {
            "status": "PASSED",
            "gcm_tag_verified": True,
            "plaintext_sha256_verified": True,
            "toc_validation": toc_msg,
            "decrypted_size_bytes": decrypted_tmp.stat().st_size
        }
    finally:
        # Safe cleanup: overwrite and remove temporary file
        if decrypted_tmp.exists():
            try:
                # Overwrite pass before unlinking
                with open(decrypted_tmp, "wb") as f:
                    f.write(b"\x00" * min(decrypted_tmp.stat().st_size, 4096))
            except Exception:
                pass
            decrypted_tmp.unlink(missing_ok=True)
