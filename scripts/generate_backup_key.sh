#!/usr/bin/env bash
# Selloi Backup Key Generation Script
# Generates a high-entropy 256-bit AES-GCM encryption key with strict system permissions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
DEFAULT_KEY_PATH="/etc/selloi/backup.key"
KEY_PATH="${DEFAULT_KEY_PATH}"
FORCE=0

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  -o, --output PATH   Path to write the key file (default: ${DEFAULT_KEY_PATH})
  -f, --force         Overwrite existing key file
  -h, --help          Show this help message
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -o|--output)
            KEY_PATH="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=1
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

if [[ -f "${KEY_PATH}" && ${FORCE} -eq 0 ]]; then
    echo "ERROR: Key file already exists at '${KEY_PATH}'." >&2
    echo "Refusing to overwrite without --force flag." >&2
    exit 1
fi

KEY_DIR="$(dirname "${KEY_PATH}")"
if [[ ! -d "${KEY_DIR}" ]]; then
    mkdir -p "${KEY_DIR}"
    chmod 700 "${KEY_DIR}"
fi

export KEY_GEN_TIME="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# Invoke backup_crypto.py to generate key
FORCE_FLAG=""
if [[ ${FORCE} -eq 1 ]]; then
    FORCE_FLAG="--force"
fi

${PYTHON_BIN} "${SCRIPT_DIR}/backup_crypto.py" generate-key --out "${KEY_PATH}" ${FORCE_FLAG}

# Set strict permissions: read-only by owner
chmod 400 "${KEY_PATH}"

# If running as root, enforce root ownership
if [[ $(id -u) -eq 0 ]]; then
    chown root:root "${KEY_PATH}"
fi

echo "=================================================================="
echo "SELLOI BACKUP AES-256-GCM KEY GENERATION COMPLETE"
echo "=================================================================="
echo "Key Location: ${KEY_PATH}"
echo "Permissions : $(stat -c '%a (%U:%G)' "${KEY_PATH}" 2>/dev/null || stat -f '%p (%u:%g)' "${KEY_PATH}" 2>/dev/null || echo '0400')"
echo "SHA-256 ID  : $(sha256sum "${KEY_PATH}" 2>/dev/null | awk '{print $1}' || shasum -a 256 "${KEY_PATH}" 2>/dev/null | awk '{print $1}')"
echo "------------------------------------------------------------------"
echo "IMPORTANT SECURITY NOTICE:"
echo "1. Back up this key immediately to a secure off-host password manager."
echo "2. NEVER commit this key to Git or upload it alongside backups."
echo "3. Without this key, encrypted backups CANNOT be recovered."
echo "=================================================================="
