#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/selloi}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/projects/Telegram_Ai_Seller/.env}"
DB_CONTAINER="${DB_CONTAINER:-telegram_ai_seller-db-1}"
DB_USER="${DB_USER:-sales}"
DB_NAME="${DB_NAME:-aisales}"
STORAGE_SRC="${STORAGE_SRC:-/home/ubuntu/projects/Telegram_Ai_Seller/storage}"
CRYPTO_SCRIPT="${CRYPTO_SCRIPT:-/home/ubuntu/projects/Telegram_Ai_Seller/scripts/backup_crypto.py}"
KEY_FILE="${KEY_FILE:-/etc/selloi/backup.key}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MIN_RETAINED_BACKUPS="${MIN_RETAINED_BACKUPS:-3}"
DISK_WARN_PCT="${DISK_WARN_PCT:-80}"
MAX_TG_BYTES="${MAX_TG_BYTES:-47185920}"
LOG_FILE="${LOG_FILE:-/var/log/selloi_backup.log}"

TIMESTAMP="$(date -u '+%Y%m%d_%H%M%S')"
DB_BACKUP_FILE="${BACKUP_DIR}/aisales_db_${TIMESTAMP}.sql.gz"
STORAGE_BACKUP_FILE="${BACKUP_DIR}/storage_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
touch "${LOG_FILE}"
chmod 640 "${LOG_FILE}" 2>/dev/null || true

log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "${LOG_FILE}"
}

send_tg_alert() {
    local text="$1"
    if [[ ! -f "${ENV_FILE}" ]]; then
        return 0
    fi
    local bot_token admin_id
    bot_token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '\r\"'\'' ' || true)"
    admin_id="$(grep -E '^(BACKUP_TELEGRAM_CHAT_ID|ADMIN_TELEGRAM_ID)=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '\r\"'\'' ' || true)"
    if [[ -n "${bot_token}" && -n "${admin_id}" ]]; then
        curl -fsS -X POST "https://api.telegram.org/bot${bot_token}/sendMessage" \
            -d "chat_id=${admin_id}" \
            --data-urlencode "text=${text}" >/dev/null 2>&1 || true
    fi
}

upload_tg_backup() {
    local file_path="$1"
    local caption="$2"
    if [[ ! -f "${ENV_FILE}" || ! -f "${file_path}" ]]; then
        return 0
    fi
    local bot_token chat_id file_bytes
    bot_token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '\r\"'\'' ' || true)"
    chat_id="$(grep -E '^BACKUP_TELEGRAM_CHAT_ID=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '\r\"'\'' ' || true)"
    if [[ -z "${chat_id}" ]]; then
        chat_id="$(grep -E '^ADMIN_TELEGRAM_ID=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '\r\"'\'' ' || true)"
    fi
    file_bytes="$(stat -c%s "${file_path}")"
    if [[ -n "${bot_token}" && -n "${chat_id}" && "${file_bytes}" -le "${MAX_TG_BYTES}" ]]; then
        local resp
        resp="$(curl -fsS -X POST "https://api.telegram.org/bot${bot_token}/sendDocument" \
            -F "chat_id=${chat_id}" \
            -F "document=@${file_path}" \
            -F "caption=${caption}" 2>&1 || true)"
        if echo "${resp}" | grep -q '"ok":true'; then
            log "Offsite backup delivered to Telegram (${chat_id}): $(basename "${file_path}")"
        else
            log "WARN: Telegram offsite upload failed for $(basename "${file_path}")"
            send_tg_alert "Selloi VPS ogohlantirish: $(basename "${file_path}") Telegram offsite yuklashda xatolik yuz berdi (lokal nusxa saqlandi)."
        fi
    fi
}

on_error() {
    local line_num="$1"
    log "ERROR: Backup failed at line ${line_num}."
    send_tg_alert "Selloi VPS backup XATOLIK (${TIMESTAMP}): skript ${line_num}-qatorda to'xtadi. Server logini tekshiring: ${LOG_FILE}"
    exit 1
}
trap 'on_error ${LINENO}' ERR

log "Starting Selloi hardened backup..."

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    log "ERROR: PostgreSQL container '${DB_CONTAINER}' is not running."
    exit 1
fi

log "Dumping PostgreSQL '${DB_NAME}'..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${DB_BACKUP_FILE}"
chmod 600 "${DB_BACKUP_FILE}"

if gzip -t "${DB_BACKUP_FILE}" && [[ "$(stat -c%s "${DB_BACKUP_FILE}")" -gt 1024 ]] && ( set +o pipefail; gzip -dc "${DB_BACKUP_FILE}" | head -n 30 | grep -q "PostgreSQL database dump" ); then
    log "Database backup verified: ${DB_BACKUP_FILE} ($(du -h "${DB_BACKUP_FILE}" | cut -f1))"
else
    rm -f "${DB_BACKUP_FILE}"
    log "ERROR: Backup verification failed!"
    exit 1
fi

if [[ -d "${STORAGE_SRC}" ]]; then
    tar -czf "${STORAGE_BACKUP_FILE}" -C "$(dirname "${STORAGE_SRC}")" "$(basename "${STORAGE_SRC}")"
    chmod 600 "${STORAGE_BACKUP_FILE}"
    log "Storage archive saved: ${STORAGE_BACKUP_FILE} ($(du -h "${STORAGE_BACKUP_FILE}" | cut -f1))"
fi

# Encrypt DB & Storage archives with AES-256-GCM and send offsite Telegram copy
if [[ -f "${KEY_FILE}" && -f "${CRYPTO_SCRIPT}" ]]; then
    DB_ENC_FILE="${DB_BACKUP_FILE}.enc"
    python3 "${CRYPTO_SCRIPT}" encrypt --key-file "${KEY_FILE}" --in "${DB_BACKUP_FILE}" --out "${DB_ENC_FILE}"
    chmod 600 "${DB_ENC_FILE}"
    python3 "${CRYPTO_SCRIPT}" verify --key-file "${KEY_FILE}" --in "${DB_ENC_FILE}" >/dev/null
    sha256sum "${DB_ENC_FILE}" > "${DB_ENC_FILE}.sha256"
    chmod 600 "${DB_ENC_FILE}.sha256"

    ENC_SIZE="$(du -h "${DB_ENC_FILE}" | cut -f1)"
    SHA_SHORT="$(cut -c1-12 "${DB_ENC_FILE}.sha256")"
    ORGS_CNT="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM organizations;" 2>/dev/null || echo "?")"
    USERS_CNT="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM users;" 2>/dev/null || echo "?")"

    log "Encrypted DB archive verified: ${DB_ENC_FILE} (${ENC_SIZE})"
    upload_tg_backup "${DB_ENC_FILE}" "Selloi Offsite DB Backup (${TIMESTAMP}) | Hajmi: ${ENC_SIZE} | Orgs: ${ORGS_CNT} | Users: ${USERS_CNT} | SHA256: ${SHA_SHORT}... | AES-256-GCM"

    if [[ -f "${STORAGE_BACKUP_FILE}" ]]; then
        STORAGE_BYTES="$(stat -c%s "${STORAGE_BACKUP_FILE}")"
        if [[ "${STORAGE_BYTES}" -gt 2048 ]]; then
            ST_ENC_FILE="${STORAGE_BACKUP_FILE}.enc"
            python3 "${CRYPTO_SCRIPT}" encrypt --key-file "${KEY_FILE}" --in "${STORAGE_BACKUP_FILE}" --out "${ST_ENC_FILE}"
            chmod 600 "${ST_ENC_FILE}"
            sha256sum "${ST_ENC_FILE}" > "${ST_ENC_FILE}.sha256"
            chmod 600 "${ST_ENC_FILE}.sha256"
            upload_tg_backup "${ST_ENC_FILE}" "Selloi Offsite Media Backup (${TIMESTAMP}) | Hajmi: $(du -h "${ST_ENC_FILE}" | cut -f1) | AES-256-GCM"
        fi
    fi
else
    log "WARN: '${KEY_FILE}' or '${CRYPTO_SCRIPT}' missing; skipping AES-256-GCM offsite copy."
fi

# Retention pruning with minimum retained backup safety guard
DB_COUNT="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'aisales_db_*.sql.gz' | wc -l)"
if [[ "${DB_COUNT}" -gt "${MIN_RETAINED_BACKUPS}" ]]; then
    find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name 'aisales_db_*.sql.gz' -o -name 'aisales_db_*.sql.gz.enc' -o -name 'aisales_db_*.sha256' \) -mtime "+${RETENTION_DAYS}" -delete
    find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name 'storage_*.tar.gz' -o -name 'storage_*.tar.gz.enc' -o -name 'storage_*.sha256' \) -mtime "+${RETENTION_DAYS}" -delete
    log "Retention cleanup checked (window=${RETENTION_DAYS}d, total=${DB_COUNT})."
else
    log "Retention cleanup skipped (count=${DB_COUNT} <= min=${MIN_RETAINED_BACKUPS})."
fi

# Disk space guard
DISK_USED_PCT="$(df -P / | awk 'NR==2 {gsub("%",""); print $5}')"
log "Disk usage check: ${DISK_USED_PCT}% used on /"
if [[ "${DISK_USED_PCT}" -ge "${DISK_WARN_PCT}" ]]; then
    log "WARN: Disk usage >= ${DISK_WARN_PCT}%. Running Docker builder prune..."
    docker builder prune -af --filter "until=48h" >/dev/null 2>&1 || true
    NEW_PCT="$(df -P / | awk 'NR==2 {gsub("%",""); print $5}')"
    send_tg_alert "Selloi VPS ogohlantirish: Disk ${DISK_USED_PCT}% ga yetdi! Auto-tozalashdan keyin: ${NEW_PCT}%."
fi

log "Selloi backup completed successfully."
