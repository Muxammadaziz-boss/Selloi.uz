"""Manifest generation and validation module for Selloi Backup System - Hardened Phase 2G.

Creates structured JSON manifests recording backup metadata, cryptographic hashes,
snapshot IDs, sequence numbers for replay protection, and destination replication states.
Features RFC 5869 HKDF-SHA256 key derivation with legacy V1 backward compatibility,
HMAC-SHA256 envelope signing, and hash chaining.
"""

import json
import hmac
import hashlib
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Union, Optional
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

DERIVATION_VERSION_V1 = "SHA256-V1"
DERIVATION_VERSION_V2 = "HKDF-SHA256-V2"
DEFAULT_DERIVATION_VERSION = DERIVATION_VERSION_V2


class ManifestError(Exception):
    """Raised when manifest validation fails."""
    pass


class ManifestAuthenticationError(ManifestError):
    """Raised when manifest cryptographic signature or HMAC authentication fails."""
    pass


def derive_manifest_signing_key_hkdf(
    master_key: bytes,
    salt: Optional[bytes] = None,
    info: bytes = b"selloi-backup-manifest-signing-v2"
) -> bytes:
    """Derive 256-bit manifest signing key using RFC 5869 HKDF-SHA256 with domain separation."""
    if len(master_key) < 16:
        raise ValueError("Master key must be at least 16 bytes to derive signing key.")
    effective_salt = salt or b"SELLOI_MANIFEST_SALT_V2"
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=effective_salt,
        info=info,
    )
    return hkdf.derive(master_key)


def derive_manifest_signing_key_v1(master_key: bytes) -> bytes:
    """Legacy V1 key derivation: SHA-256 with domain prefix."""
    if len(master_key) < 16:
        raise ValueError("Master key must be at least 16 bytes to derive signing key.")
    return hashlib.sha256(b"SELLOI_MANIFEST_SIGNING_KEY_V1:" + master_key).digest()


def derive_manifest_signing_key(
    master_key: bytes,
    version: str = DERIVATION_VERSION_V2,
    purpose: str = "manifest_signing"
) -> bytes:
    """Derive a segregated 256-bit manifest signing key from a master key.

    Defaults to RFC 5869 HKDF-SHA256 V2. Supports legacy SHA256-V1 for backward compatibility.
    """
    if version == DERIVATION_VERSION_V1:
        return derive_manifest_signing_key_v1(master_key)
    info = f"selloi-backup-{purpose}-{version}".encode("ascii")
    return derive_manifest_signing_key_hkdf(master_key, info=info)


def compute_manifest_payload_bytes(manifest: Dict[str, Any]) -> bytes:
    """Serialize manifest payload without authentication envelope in canonical JSON format."""
    payload = {k: v for k, v in manifest.items() if k != "authentication"}
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def compute_manifest_hash(manifest: Dict[str, Any]) -> str:
    """Compute deterministic SHA-256 hash of manifest payload for blockchain-style chaining."""
    payload_bytes = compute_manifest_payload_bytes(manifest)
    return hashlib.sha256(payload_bytes).hexdigest().lower()


def sign_manifest(
    manifest: Dict[str, Any],
    signing_key: bytes,
    derivation_version: str = DERIVATION_VERSION_V2
) -> Dict[str, Any]:
    """Sign manifest using HMAC-SHA256 with key segregation."""
    if len(signing_key) < 16:
        raise ManifestAuthenticationError("Signing key must be at least 16 bytes.")

    payload_bytes = compute_manifest_payload_bytes(manifest)
    signature = hmac.new(signing_key, payload_bytes, hashlib.sha256).hexdigest()
    key_id = hashlib.sha256(signing_key).hexdigest()[:16]

    manifest["authentication"] = {
        "signature_algorithm": "HMAC-SHA256",
        "signature": signature,
        "derivation_algorithm": derivation_version,
        "signed_at_utc": datetime.now(timezone.utc).isoformat(),
        "key_id": key_id
    }
    return manifest


def verify_manifest_signature(
    manifest: Dict[str, Any],
    signing_key: bytes,
    expected_key_id: Optional[str] = None
) -> bool:
    """Verify cryptographic HMAC-SHA256 signature of a manifest."""
    if "authentication" not in manifest or not isinstance(manifest["authentication"], dict):
        raise ManifestAuthenticationError("Manifest lacks authentication envelope.")

    auth_meta = manifest["authentication"]
    if auth_meta.get("signature_algorithm") != "HMAC-SHA256":
        raise ManifestAuthenticationError(
            f"Unsupported manifest signature algorithm: {auth_meta.get('signature_algorithm')}"
        )

    expected_sig = auth_meta.get("signature", "")
    if not expected_sig:
        raise ManifestAuthenticationError("Manifest signature field is empty.")

    # Key ID verification is mandatory for authenticated envelopes
    manifest_key_id = auth_meta.get("key_id", "").strip()
    if not manifest_key_id:
        raise ManifestAuthenticationError("Manifest authentication envelope missing required 'key_id'.")

    derived_key_id = hashlib.sha256(signing_key).hexdigest()[:16]
    if expected_key_id and expected_key_id != derived_key_id:
        raise ManifestAuthenticationError(
            f"Key ID mismatch: expected '{expected_key_id}', got '{derived_key_id}'."
        )
    if manifest_key_id != derived_key_id:
        raise ManifestAuthenticationError(
            f"Key ID mismatch: manifest key_id '{manifest_key_id}' != signing key key_id '{derived_key_id}'."
        )

    payload_bytes = compute_manifest_payload_bytes(manifest)
    computed_sig = hmac.new(signing_key, payload_bytes, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig.lower(), computed_sig.lower()):
        raise ManifestAuthenticationError(
            "Cryptographic signature mismatch: manifest has been tampered with or signing key is invalid."
        )

    return True


def verify_manifest_with_master_key(
    manifest: Dict[str, Any],
    master_key: bytes
) -> bool:
    """Verify manifest signature using master key with strict downgrade protection.

    Rules:
    1. If derivation_algorithm is explicitly HKDF-SHA256-V2:
       - Uses HKDF-SHA256 key exclusively.
       - NEVER falls back to V1. Any failure raises ManifestAuthenticationError.
    2. If derivation_algorithm is explicitly SHA256-V1 (legacy):
       - If manifest has V2 attributes (manifest_version == '2.0.0' or sequence_number > 1),
         reject as a DOWNGRADE ATTACK.
       - Otherwise, uses legacy V1 key derivation.
    3. If derivation_algorithm is unknown / unrecognized:
       - Immediately rejects with ManifestAuthenticationError fail-closed.
    4. If derivation_algorithm is missing:
       - If manifest_version is '1.0.0' and has no V2 markers, try V1 as backward compatibility fallback.
       - If manifest is V2, reject missing derivation algorithm fail-closed.
    """
    if "authentication" not in manifest or not isinstance(manifest["authentication"], dict):
        raise ManifestAuthenticationError("Manifest lacks authentication envelope.")

    auth_meta = manifest["authentication"]
    derivation_alg = auth_meta.get("derivation_algorithm", "").strip()
    manifest_ver = manifest.get("manifest_version", "1.0.0")
    seq_num = int(manifest.get("sequence_number", 0))

    KNOWN_DERIVATIONS = (DERIVATION_VERSION_V2, DERIVATION_VERSION_V1, "SHA256-V1", "HKDF-SHA256-V2")

    # 1. Missing derivation metadata handling
    if not derivation_alg:
        if manifest_ver == "2.0.0" or seq_num > 1 or manifest.get("previous_manifest_hash"):
            raise ManifestAuthenticationError(
                "VERSION DOWNGRADE DETECTED: V2 manifest must declare derivation_algorithm='HKDF-SHA256-V2'."
            )
        v1_key = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V1)
        return verify_manifest_signature(manifest, v1_key)

    # 2. Reject unknown derivation algorithms immediately
    if derivation_alg not in KNOWN_DERIVATIONS:
        raise ManifestAuthenticationError(
            f"Unsupported derivation algorithm: '{derivation_alg}'. Allowed: {KNOWN_DERIVATIONS}"
        )

    # 3. Prevent downgrade of V2 manifest to V1
    if derivation_alg in (DERIVATION_VERSION_V1, "SHA256-V1"):
        if manifest_ver == "2.0.0" or seq_num > 1 or manifest.get("previous_manifest_hash"):
            raise ManifestAuthenticationError(
                "VERSION DOWNGRADE ATTACK DETECTED: V2 manifest cannot use legacy V1 derivation."
            )
        v1_key = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V1)
        return verify_manifest_signature(manifest, v1_key)

    # 4. V2 verification: STRICT, NO FALLBACK
    v2_key = derive_manifest_signing_key(master_key, version=DERIVATION_VERSION_V2)
    return verify_manifest_signature(manifest, v2_key)


def create_manifest(
    backup_id: str,
    project_id: str,
    region: str,
    database_meta: Dict[str, Any],
    media_meta: Dict[str, Any],
    deployment_meta: Dict[str, Any],
    encryption_meta: Dict[str, Any],
    destinations_meta: Dict[str, Any],
    signing_key: Optional[bytes] = None,
    snapshot_id: Optional[str] = None,
    sequence_number: int = 1,
    previous_manifest_hash: Optional[str] = None,
    manifest_version: str = "1.0.0",
    derivation_version: str = DERIVATION_VERSION_V2
) -> Dict[str, Any]:
    """Generate a complete, structured backup manifest."""
    now_utc = datetime.now(timezone.utc).isoformat()
    sid = snapshot_id or f"snap_{backup_id}_{secrets.token_hex(4)}"

    manifest = {
        "manifest_version": manifest_version,
        "backup_id": backup_id,
        "snapshot_id": sid,
        "sequence_number": sequence_number,
        "previous_manifest_hash": previous_manifest_hash or "",
        "created_at_utc": now_utc,
        "source": {
            "platform": "Selloi.uz",
            "database_provider": "Supabase",
            "project_id": project_id,
            "region": region,
            "engine": "PostgreSQL 17.11",
            "source_of_truth": "Supabase Production"
        },
        "payload": {
            "database": database_meta,
            "media": media_meta,
            "deployment": deployment_meta
        },
        "encryption": encryption_meta,
        "destinations": destinations_meta,
        "verification": {
            "authenticated_encryption": "AES-256-GCM",
            "integrity_algorithm": "SHA-256",
            "verified_prior_to_transfer": True
        }
    }

    if signing_key:
        manifest = sign_manifest(manifest, signing_key, derivation_version=derivation_version)

    return manifest


def save_manifest(manifest: Dict[str, Any], output_path: Union[str, Path]) -> Path:
    """Save manifest to a JSON file."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    return path


def load_manifest(manifest_path: Union[str, Path]) -> Dict[str, Any]:
    """Load and validate manifest from disk."""
    path = Path(manifest_path)
    if not path.is_file():
        raise FileNotFoundError(f"Manifest file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Basic schema validation
    required_keys = ["manifest_version", "backup_id", "source", "payload", "encryption", "destinations"]
    for k in required_keys:
        if k not in data:
            raise ManifestError(f"Missing required manifest field: {k}")

    return data


def load_and_verify_manifest(
    manifest_path: Union[str, Path],
    signing_key: bytes
) -> Dict[str, Any]:
    """Load manifest from disk and verify its cryptographic signature fail-closed."""
    manifest = load_manifest(manifest_path)
    verify_manifest_signature(manifest, signing_key)
    return manifest
