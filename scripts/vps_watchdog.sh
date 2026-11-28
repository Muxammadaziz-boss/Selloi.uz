#!/usr/bin/env bash
# Selloi VPS Proactive SRE Watchdog
# Verifies API readiness, Next.js frontend, nginx, cloudflared, disk headroom, and latest encrypted backup freshness.
# Dispatches deduplicated Telegram alerts with cooldown and sends a recovery notice once healthy again.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/home/ubuntu/projects/Telegram_Ai_Seller/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/selloi}"
LOG_FILE="${LOG_FILE:-/var/log/selloi_watchdog.log}"
STATE_FILE="${STATE_FILE:-/var/tmp/selloi_watchdog.state}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8000/health/ready}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:3000/api/auth/status}"
MAX_DISK_PCT="${MAX_DISK_PCT:-85}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-36}"
ALERT_COOLDOWN_SEC="${ALERT_COOLDOWN_SEC:-1800}"

touch "${LOG_FILE}" 2>/dev/null || LOG_FILE="/tmp/selloi_watchdog.log"
chmod 640 "${LOG_FILE}" 2>/dev/null || true

log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" >> "${LOG_FILE}"
}

sanitize_msg() {
    printf "%s" "$1" | sed -E 's/[0-9]{8,10}:[a-zA-Z0-9_-]{35}/[REDACTED_BOT_TOKEN]/g' | sed -E 's/password=[^ &]*/password=[REDACTED]/g'
}

send_tg() {
    local text
    text="$(sanitize_msg "$1")"
    if [[ ! -f "${ENV_FILE}" ]]; then
        return 0
    fi
    local bot_token chat_id
    bot_token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '\r\"'\'' ' || true)"
    chat_id="$(grep -E '^(BACKUP_TELEGRAM_CHAT_ID|ADMIN_TELEGRAM_ID)=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '\r\"'\'' ' || true)"
    if [[ -n "${bot_token}" && -n "${chat_id}" ]]; then
        curl -fsS -X POST "https://api.telegram.org/bot${bot_token}/sendMessage" \
            -d "chat_id=${chat_id}" \
            --data-urlencode "text=${text}" >/dev/null 2>&1 || true
    fi
}

FAILURES=()

# 1. Backend /health/ready check
api_code="$(curl -sS -o /tmp/selloi_api_health.json -w '%{http_code}' --max-time 6 "${API_HEALTH_URL}" 2>/dev/null || echo '000')"
if [[ "${api_code}" != "200" ]] || ! grep -q '"status":"ready"' /tmp/selloi_api_health.json 2>/dev/null; then
    FAILURES+=("Backend API /health/ready HTTP=${api_code}")
fi

# 2. Frontend Next.js BFF status check
web_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 6 "${WEB_HEALTH_URL}" 2>/dev/null || echo '000')"
if [[ "${web_code}" != "200" ]]; then
    FAILURES+=("Frontend Next.js HTTP=${web_code}")
fi

# 3. Host proxy & tunnel daemons
for svc in nginx cloudflared docker; do
    if command -v systemctl >/dev/null 2>&1; then
        if ! systemctl is-active --quiet "${svc}"; then
            FAILURES+=("Systemd service '${svc}' is inactive")
        fi
    fi
done

# 4. Root disk headroom
disk_pct="$(df -P / | awk 'NR==2 {gsub("%",""); print $5}')"
if [[ -n "${disk_pct}" && "${disk_pct}" -ge "${MAX_DISK_PCT}" ]]; then
    FAILURES+=("Root disk usage high: ${disk_pct}% (>= ${MAX_DISK_PCT}%)")
fi

# 5. Encrypted backup freshness (if backup dir exists)
if [[ -d "${BACKUP_DIR}" ]]; then
    latest_enc="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'aisales_db_*.sql.gz.enc' -mmin "-$((MAX_BACKUP_AGE_HOURS * 60))" | head -n1 || true)"
    if [[ -z "${latest_enc}" ]]; then
        FAILURES+=("No fresh encrypted DB backup in last ${MAX_BACKUP_AGE_HOURS}h")
    fi
fi

NOW_EPOCH="$(date +%s)"
PREV_STATUS="ok"
LAST_ALERT_EPOCH=0
if [[ -f "${STATE_FILE}" ]]; then
    PREV_STATUS="$(awk -F= '/^STATUS=/{print $2}' "${STATE_FILE}" 2>/dev/null || echo "ok")"
    LAST_ALERT_EPOCH="$(awk -F= '/^LAST_ALERT=/{print $2}' "${STATE_FILE}" 2>/dev/null || echo "0")"
fi

if [[ "${#FAILURES[@]}" -gt 0 ]]; then
    summary="$(printf "%s; " "${FAILURES[@]}")"
    log "ALERT: ${summary}"
    if [[ "${PREV_STATUS}" != "failing" || $((NOW_EPOCH - LAST_ALERT_EPOCH)) -ge "${ALERT_COOLDOWN_SEC}" ]]; then
        send_tg "Selloi VPS Watchdog OGOHLANTIRISH ($(date -u '+%H:%M UTC')): ${summary}"
        {
            echo "STATUS=failing"
            echo "LAST_ALERT=${NOW_EPOCH}"
        } > "${STATE_FILE}"
    fi
    exit 1
fi

if [[ "${PREV_STATUS}" == "failing" ]]; then
    log "RECOVERED: All health checks green."
    send_tg "Selloi VPS Watchdog TIKLANDI ($(date -u '+%H:%M UTC')): Barcha xizmatlar (API, Web, Nginx, Cloudflared, Disk, Backup) normal holatga qaytdi."
fi

{
    echo "STATUS=ok"
    echo "LAST_ALERT=${LAST_ALERT_EPOCH}"
} > "${STATE_FILE}"
