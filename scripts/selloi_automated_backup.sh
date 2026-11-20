#!/usr/bin/env bash
# Selloi Production Automated Backup Engine
# Generates custom-format PostgreSQL dumps, validates integrity, encrypts with AES-256-GCM,
# computes SHA-256 checksums, replicates offsite to Cloudflare R2 via rclone, and applies
# safe 30-day retention policies with atomic guards.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${CONFIG_FILE:-/etc/selloi/backup.env}"
if [[ -f "${CONFIG_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${CONFIG_FILE}"
fi

# Environment & Default Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/selloi}"
KEY_PATH="${KEY_PATH:-/etc/selloi/backup.key}"
LOG_FILE="${LOG_FILE:-/var/log/selloi_backup.log}"
DB_CONTAINER="${DB_CONTAINER:-telegram_ai_seller-db-1}"
DB_USER="${DB_USER:-sales}"
DB_NAME="${DB_NAME:-aisales}"
STORAGE_SRC="${STORAGE_SRC:-/home/ubuntu/projects/Telegram_Ai_Seller/storage}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2:selloi-backups/daily}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MIN_RETAINED_BACKUPS="${MIN_RETAINED_BACKUPS:-2}"
SKIP_R2_UPLOAD="${SKIP_R2_UPLOAD:-0}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

TIMESTAMP="$(date -u '+%Y%m%d_%H%M%S')"
TMP_DIR="$(mktemp -d /tmp/selloi_backup_XXXXXX)"
CURRENT_STEP="Initialization"

# File naming
DUMP_BASENAME="aisales_prod_${TIMESTAMP}.dump"
TMP_DUMP="${TMP_DIR}/${DUMP_BASENAME}"
ENC_DUMP="${BACKUP_DIR}/${DUMP_BASENAME}.enc"
SHA_DUMP="${ENC_DUMP}.sha256"
META_DUMP="${BACKUP_DIR}/aisales_prod_${TIMESTAMP}.meta.json"

STORAGE_BASENAME="storage_prod_${TIMESTAMP}.tar.gz"
TMP_STORAGE="${TMP_DIR}/${STORAGE_BASENAME}"
ENC_STORAGE="${BACKUP_DIR}/${STORAGE_BASENAME}.enc"
SHA_STORAGE="${ENC_STORAGE}.sha256"

log() {
    local level="$1"
    local msg="$2"
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] [${level}] ${msg}" | tee -a "${LOG_FILE}"
}

cleanup() {
    if [[ -d "${TMP_DIR}" ]]; then
        rm -rf "${TMP_DIR}"
    fi
}
trap cleanup EXIT

on_error() {
    local line_num="$1"
    log "ERROR" "Backup failed at line ${line_num} in step: '${CURRENT_STEP}'"
    if [[ -x "${SCRIPT_DIR}/backup_alert.sh" ]]; then
        "${SCRIPT_DIR}/backup_alert.sh" \
            --level "CRITICAL" \
            --step "${CURRENT_STEP}" \
            --error "Backup pipeline terminated at line ${line_num}. Temporary files cleaned. Historical backups intact." \
            --log-file "${LOG_FILE}" || true
    fi
    exit 1
}
trap 'on_error ${LINENO}' ERR

log "INFO" "=================================================================="
log "INFO" "STARTING SELLOI AUTOMATED BACKUP PIPELINE (${TIMESTAMP})"
log "INFO" "=================================================================="

# Ensure directories & permissions
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
touch "${LOG_FILE}"
chmod 640 "${LOG_FILE}" 2>/dev/null || true

# ------------------------------------------------------------------------------
# STEP 1: Pre-flight Verification
# ------------------------------------------------------------------------------
CURRENT_STEP="Pre-flight Checks"
log "INFO" "[${CURRENT_STEP}] Verifying environment prerequisites..."

if [[ ! -f "${KEY_PATH}" ]]; then
    log "ERROR" "Encryption key not found at '${KEY_PATH}'. Aborting backup."
    exit 1
fi

if ! ${PYTHON_BIN} "${SCRIPT_DIR}/backup_crypto.py" --help >/dev/null 2>&1; then
    log "ERROR" "backup_crypto.py engine is not functional. Check Python & cryptography installation."
    exit 1
fi

# Check Docker container availability (or support staging mock)
if [[ "${MOCK_BACKUP:-0}" -eq 0 ]]; then
    if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        log "ERROR" "PostgreSQL container '${DB_CONTAINER}' is not running."
        exit 1
    fi
fi

# Verify free disk space (minimum 500 MB)
AVAIL_KB=$(df -P "${BACKUP_DIR}" | awk 'NR==2 {print $4}')
if [[ "${AVAIL_KB}" -lt 512000 ]]; then
    log "ERROR" "Insufficient disk space on backup partition (${AVAIL_KB} KB available, required >= 512000 KB)."
    exit 1
fi

log "INFO" "[${CURRENT_STEP}] Prerequisites verified successfully."

# ------------------------------------------------------------------------------
# STEP 2: PostgreSQL Custom-Format Extraction
# ------------------------------------------------------------------------------
CURRENT_STEP="Database Extraction"
log "INFO" "[${CURRENT_STEP}] Generating PostgreSQL custom-format dump for '${DB_NAME}'..."

if [[ "${MOCK_BACKUP:-0}" -eq 1 ]]; then
    # Staging mock generator
    ${PYTHON_BIN} -c "import os; print('MOCK_POSTGRESQL_CUSTOM_DUMP_' + 'X'*2048)" > "${TMP_DUMP}"
else
    docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc -Z 6 > "${TMP_DUMP}"
fi

# ------------------------------------------------------------------------------
# STEP 3: Pre-Encryption Integrity Validation
# ------------------------------------------------------------------------------
CURRENT_STEP="Archive Integrity Validation"
log "INFO" "[${CURRENT_STEP}] Validating custom-format archive structure..."

DUMP_SIZE=$(stat -c%s "${TMP_DUMP}" 2>/dev/null || stat -f%z "${TMP_DUMP}" 2>/dev/null || echo 0)
MIN_DUMP_SIZE="${MIN_DUMP_SIZE:-10000}"
if [[ "${MOCK_BACKUP:-0}" -eq 1 ]]; then
    MIN_DUMP_SIZE=100
fi
if [[ "${DUMP_SIZE}" -lt "${MIN_DUMP_SIZE}" ]]; then
    log "ERROR" "Extracted dump file is too small (${DUMP_SIZE} bytes, minimum: ${MIN_DUMP_SIZE} bytes). Dump may be empty or corrupted."
    exit 1
fi

if [[ "${MOCK_BACKUP:-0}" -eq 0 ]]; then
    if ! docker exec -i "${DB_CONTAINER}" pg_restore -l < "${TMP_DUMP}" >/dev/null 2>&1; then
        log "ERROR" "pg_restore -l validation failed. Table-of-contents or archive header is invalid."
        exit 1
    fi
fi

log "INFO" "[${CURRENT_STEP}] Archive validated successfully (raw size: $(du -h "${TMP_DUMP}" | cut -f1))."

# ------------------------------------------------------------------------------
# STEP 4: Authenticated Encryption (AES-256-GCM)
# ------------------------------------------------------------------------------
CURRENT_STEP="Authenticated Encryption"
log "INFO" "[${CURRENT_STEP}] Encrypting dump with AES-256-GCM..."

${PYTHON_BIN} "${SCRIPT_DIR}/backup_crypto.py" encrypt \
    --key-file "${KEY_PATH}" \
    --in "${TMP_DUMP}" \
    --out "${ENC_DUMP}"

chmod 600 "${ENC_DUMP}"
log "INFO" "[${CURRENT_STEP}] Encryption complete: ${ENC_DUMP} ($(du -h "${ENC_DUMP}" | cut -f1))."

# ------------------------------------------------------------------------------
# STEP 5: SHA-256 Checksum & Metadata Manifest Generation
# ------------------------------------------------------------------------------
CURRENT_STEP="Checksum & Metadata Generation"
log "INFO" "[${CURRENT_STEP}] Computing SHA-256 checksum..."

SHA256_HASH=$(sha256sum "${ENC_DUMP}" 2>/dev/null | awk '{print $1}' || shasum -a 256 "${ENC_DUMP}" 2>/dev/null | awk '{print $1}')
echo "${SHA256_HASH}  $(basename "${ENC_DUMP}")" > "${SHA_DUMP}"
chmod 600 "${SHA_DUMP}"

log "INFO" "[${CURRENT_STEP}] SHA-256: ${SHA256_HASH}"

# Generate structured JSON manifest
cat <<EOF > "${META_DUMP}"
{
  "system": "selloi-production",
  "timestamp": "${TIMESTAMP}",
  "type": "database_custom_dump",
  "database": "${DB_NAME}",
  "container": "${DB_CONTAINER}",
  "raw_size_bytes": ${DUMP_SIZE},
  "encrypted_file": "$(basename "${ENC_DUMP}")",
  "encrypted_size_bytes": $(stat -c%s "${ENC_DUMP}" 2>/dev/null || stat -f%z "${ENC_DUMP}" 2>/dev/null || echo 0),
  "sha256": "${SHA256_HASH}",
  "encryption": "AES-256-GCM",
  "retention_days": ${RETENTION_DAYS}
}
EOF
chmod 600 "${META_DUMP}"

# ------------------------------------------------------------------------------
# STEP 6: Media / Storage Directory Archive
# ------------------------------------------------------------------------------
CURRENT_STEP="Media Storage Archiving"
if [[ -d "${STORAGE_SRC}" ]]; then
    log "INFO" "[${CURRENT_STEP}] Archiving persistent media storage from '${STORAGE_SRC}'..."
    tar -czf "${TMP_STORAGE}" -C "$(dirname "${STORAGE_SRC}")" "$(basename "${STORAGE_SRC}")"
    ${PYTHON_BIN} "${SCRIPT_DIR}/backup_crypto.py" encrypt \
        --key-file "${KEY_PATH}" \
        --in "${TMP_STORAGE}" \
        --out "${ENC_STORAGE}"
    chmod 600 "${ENC_STORAGE}"
    
    STORAGE_SHA=$(sha256sum "${ENC_STORAGE}" 2>/dev/null | awk '{print $1}' || shasum -a 256 "${ENC_STORAGE}" 2>/dev/null | awk '{print $1}')
    echo "${STORAGE_SHA}  $(basename "${ENC_STORAGE}")" > "${SHA_STORAGE}"
    chmod 600 "${SHA_STORAGE}"
    log "INFO" "[${CURRENT_STEP}] Storage archive encrypted: ${ENC_STORAGE} ($(du -h "${ENC_STORAGE}" | cut -f1))."
else
    log "INFO" "[${CURRENT_STEP}] Storage directory '${STORAGE_SRC}' not found or empty. Skipping media archive."
fi

# ------------------------------------------------------------------------------
# STEP 7: Independent Offsite Replication (Cloudflare R2 via rclone)
# ------------------------------------------------------------------------------
CURRENT_STEP="Offsite Cloudflare R2 Upload"
if [[ "${SKIP_R2_UPLOAD}" -eq 1 ]]; then
    log "WARN" "[${CURRENT_STEP}] SKIP_R2_UPLOAD=1 is active. Offsite replication skipped by configuration."
else
    if command -v rclone >/dev/null 2>&1; then
        log "INFO" "[${CURRENT_STEP}] Syncing encrypted archives to Cloudflare R2 (${RCLONE_REMOTE})..."
        rclone copy "${ENC_DUMP}" "${RCLONE_REMOTE}/" --checksum
        rclone copy "${SHA_DUMP}" "${RCLONE_REMOTE}/" --checksum
        rclone copy "${META_DUMP}" "${RCLONE_REMOTE}/" --checksum

        if [[ -f "${ENC_STORAGE}" ]]; then
            rclone copy "${ENC_STORAGE}" "${RCLONE_REMOTE}/" --checksum
            rclone copy "${SHA_STORAGE}" "${RCLONE_REMOTE}/" --checksum
        fi

        # Verify object presence on remote
        REMOTE_CHECK=$(rclone lsf "${RCLONE_REMOTE}/$(basename "${ENC_DUMP}")" 2>/dev/null || echo "")
        if [[ -z "${REMOTE_CHECK}" ]]; then
            log "ERROR" "[${CURRENT_STEP}] Verification failed: '${ENC_DUMP}' not found on remote storage."
            exit 1
        fi

        # Verify remote object size matches local encrypted file
        LOCAL_ENC_SIZE=$(stat -c%s "${ENC_DUMP}" 2>/dev/null || stat -f%z "${ENC_DUMP}" 2>/dev/null || echo 0)
        REMOTE_SIZE=$(rclone size --json "${RCLONE_REMOTE}/$(basename "${ENC_DUMP}")" 2>/dev/null | grep -o '"bytes":[0-9]*' | cut -d: -f2 || echo 0)
        if [[ "${REMOTE_SIZE}" -gt 0 && "${LOCAL_ENC_SIZE}" -gt 0 && "${REMOTE_SIZE}" -ne "${LOCAL_ENC_SIZE}" ]]; then
            log "ERROR" "[${CURRENT_STEP}] Integrity failure: remote object size (${REMOTE_SIZE} bytes) does not match local size (${LOCAL_ENC_SIZE} bytes)!"
            exit 1
        fi
        log "INFO" "[${CURRENT_STEP}] Offsite replication verified successfully on Cloudflare R2 (${REMOTE_CHECK}, ${LOCAL_ENC_SIZE} bytes)."
    else
        log "WARN" "[${CURRENT_STEP}] 'rclone' CLI not found. Offsite replication could not execute."
        # If in staging or testing mode, warn; otherwise trigger alert
        if [[ "${MOCK_BACKUP:-0}" -eq 0 ]]; then
            if [[ -x "${SCRIPT_DIR}/backup_alert.sh" ]]; then
                "${SCRIPT_DIR}/backup_alert.sh" \
                    --level "WARN" \
                    --step "${CURRENT_STEP}" \
                    --error "rclone CLI not installed on host. Offsite replication is inactive." \
                    --log-file "${LOG_FILE}" || true
            fi
        fi
    fi
fi

# ------------------------------------------------------------------------------
# STEP 8: Retention Policy Pruning (30 Days) with Strict Safety Guards
# ------------------------------------------------------------------------------
CURRENT_STEP="Retention Policy Pruning"
log "INFO" "[${CURRENT_STEP}] Evaluating retention policy (target: ${RETENTION_DAYS} days)..."

# Count existing valid local backups
LOCAL_BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "aisales_prod_*.dump.enc" | wc -l)
log "INFO" "[${CURRENT_STEP}] Found ${LOCAL_BACKUP_COUNT} local backup archives."

if [[ "${LOCAL_BACKUP_COUNT}" -le "${MIN_RETAINED_BACKUPS}" ]]; then
    log "INFO" "[${CURRENT_STEP}] Local backups count (${LOCAL_BACKUP_COUNT}) <= minimum safety threshold (${MIN_RETAINED_BACKUPS}). Pruning skipped."
else
    # Find candidates older than RETENTION_DAYS
    OLD_BACKUPS=$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "aisales_prod_*.dump.enc" -mtime "+${RETENTION_DAYS}" || echo "")
    if [[ -n "${OLD_BACKUPS}" ]]; then
        log "INFO" "[${CURRENT_STEP}] Pruning expired local archives older than ${RETENTION_DAYS} days..."
        find "${BACKUP_DIR}" -maxdepth 1 -type f -name "aisales_prod_*.dump.enc*" -mtime "+${RETENTION_DAYS}" -delete
        find "${BACKUP_DIR}" -maxdepth 1 -type f -name "aisales_prod_*.meta.json" -mtime "+${RETENTION_DAYS}" -delete
        find "${BACKUP_DIR}" -maxdepth 1 -type f -name "storage_prod_*.tar.gz.enc*" -mtime "+${RETENTION_DAYS}" -delete
        log "INFO" "[${CURRENT_STEP}] Local pruning complete."
    else
        log "INFO" "[${CURRENT_STEP}] No local archives exceed ${RETENTION_DAYS} days retention window."
    fi

    # Prune remote R2 backups if rclone is available
    if command -v rclone >/dev/null 2>&1 && [[ "${SKIP_R2_UPLOAD}" -eq 0 ]]; then
        log "INFO" "[${CURRENT_STEP}] Pruning remote Cloudflare R2 objects older than ${RETENTION_DAYS} days..."
        rclone delete --min-age "${RETENTION_DAYS}d" "${RCLONE_REMOTE}" 2>/dev/null || true
    fi
fi

# ------------------------------------------------------------------------------
# STEP 9: Final Success Reporting
# ------------------------------------------------------------------------------
CURRENT_STEP="Complete"
log "INFO" "=================================================================="
log "INFO" "SELLOI AUTOMATED BACKUP COMPLETED SUCCESSFULLY"
log "INFO" "Encrypted Archive: ${ENC_DUMP}"
log "INFO" "Checksum File    : ${SHA_DUMP}"
log "INFO" "Manifest File    : ${META_DUMP}"
log "INFO" "=================================================================="

exit 0
