#!/usr/bin/env bash
# Selloi Isolated PostgreSQL Backup Decrypt & Restore Verification Drill
# Restores ONLY into ephemeral database 'aisales_restore_drill' and drops it afterward.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/selloi}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/projects/Telegram_Ai_Seller/.env}"
CRYPTO_SCRIPT="${CRYPTO_SCRIPT:-/home/ubuntu/projects/Telegram_Ai_Seller/scripts/backup_crypto.py}"
KEY_FILE="${KEY_FILE:-/etc/selloi/backup.key}"
DB_CONTAINER="${DB_CONTAINER:-telegram_ai_seller-db-1}"
DB_USER="${DB_USER:-sales}"
ALLOWED_TEST_DB="aisales_restore_drill"
TARGET_TEST_DB="${ALLOWED_TEST_DB}"
LOG_FILE="${LOG_FILE:-/var/log/selloi_backup.log}"
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup-file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --test-db)
            TARGET_TEST_DB="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] [RESTORE-DRILL] $1" | tee -a "${LOG_FILE}"
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

# Strict guard: never restore onto production or arbitrary databases
if [[ "${TARGET_TEST_DB}" == "aisales" || "${TARGET_TEST_DB}" =~ ^(production|prod|live|main)$ || "${TARGET_TEST_DB}" != "${ALLOWED_TEST_DB}" ]]; then
    echo "CRITICAL: Target database '${TARGET_TEST_DB}' is forbidden. Only '${ALLOWED_TEST_DB}' is permitted." >&2
    exit 1
fi

TMP_DIR="$(mktemp -d /tmp/selloi_restore_drill_XXXXXX)"
cleanup() {
    rm -rf "${TMP_DIR}"
    if command -v docker >/dev/null 2>&1; then
        docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${ALLOWED_TEST_DB};" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

on_error() {
    local line_num="$1"
    log "ERROR: Restore drill failed at line ${line_num}."
    send_tg_alert "Selloi Restore Drill XATOLIK: ${line_num}-qatorda to'xtadi! Ishlab turgan bazaga tegilmadi."
    exit 1
}
trap 'on_error ${LINENO}' ERR

if [[ -z "${BACKUP_FILE}" ]]; then
    BACKUP_FILE="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'aisales_db_*.sql.gz.enc' | sort -r | head -n 1 || true)"
    if [[ -z "${BACKUP_FILE}" ]]; then
        BACKUP_FILE="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'aisales_db_*.sql.gz' | sort -r | head -n 1 || true)"
    fi
fi

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
    log "ERROR: No backup archive found in '${BACKUP_DIR}'."
    exit 1
fi

log "Selected archive for restore drill: ${BACKUP_FILE}"

DECRYPTED_GZ="${TMP_DIR}/restore.sql.gz"
if [[ "${BACKUP_FILE}" == *.enc ]]; then
    if [[ -f "${BACKUP_FILE}.sha256" ]]; then
        EXPECTED_SHA="$(awk '{print $1}' "${BACKUP_FILE}.sha256")"
        ACTUAL_SHA="$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')"
        if [[ "${EXPECTED_SHA}" != "${ACTUAL_SHA}" ]]; then
            log "CRITICAL: SHA-256 mismatch on encrypted archive!"
            exit 1
        fi
        log "SHA-256 checksum verified."
    fi
    python3 "${CRYPTO_SCRIPT}" decrypt --key-file "${KEY_FILE}" --in "${BACKUP_FILE}" --out "${DECRYPTED_GZ}"
else
    cp "${BACKUP_FILE}" "${DECRYPTED_GZ}"
fi

gzip -t "${DECRYPTED_GZ}"

docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${ALLOWED_TEST_DB};" >/dev/null
docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${ALLOWED_TEST_DB};" >/dev/null

gzip -dc "${DECRYPTED_GZ}" | docker exec -i "${DB_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${ALLOWED_TEST_DB}" >/dev/null

TABLE_COUNT="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${ALLOWED_TEST_DB}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")"
if [[ "${TABLE_COUNT}" -lt 20 ]]; then
    log "CRITICAL: Expected >= 20 tables in restored drill DB, found ${TABLE_COUNT}."
    exit 1
fi

for tbl in organizations users plans subscriptions conversations orders alembic_version; do
    EXISTS="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${ALLOWED_TEST_DB}" -t -A -c "SELECT to_regclass('public.${tbl}') IS NOT NULL;")"
    if [[ "${EXISTS}" != "t" ]]; then
        log "CRITICAL: Missing table '${tbl}' in restored database!"
        exit 1
    fi
done

ORGS_CNT="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${ALLOWED_TEST_DB}" -t -A -c "SELECT count(*) FROM organizations;")"
USERS_CNT="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${ALLOWED_TEST_DB}" -t -A -c "SELECT count(*) FROM users;")"
PLANS_CNT="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${ALLOWED_TEST_DB}" -t -A -c "SELECT count(*) FROM plans;")"
ALEMBIC_VER="$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${ALLOWED_TEST_DB}" -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;")"

if [[ "${ORGS_CNT}" -lt 1 || "${PLANS_CNT}" -lt 3 || -z "${ALEMBIC_VER}" ]]; then
    log "CRITICAL: Restored data check failed (orgs=${ORGS_CNT}, plans=${PLANS_CNT}, alembic=${ALEMBIC_VER})."
    exit 1
fi

log "PASSED: tables=${TABLE_COUNT}, orgs=${ORGS_CNT}, users=${USERS_CNT}, plans=${PLANS_CNT}, alembic=${ALEMBIC_VER}"
send_tg_alert "Selloi Restore Drill MUVAFFAQIYATLI ($(basename "${BACKUP_FILE}")): ${TABLE_COUNT} ta jadval, ${ORGS_CNT} ta do'kon, ${USERS_CNT} ta foydalanuvchi, Alembic=${ALEMBIC_VER} to'liq tiklandi va tekshirildi."
