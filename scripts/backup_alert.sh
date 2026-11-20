#!/usr/bin/env bash
# Selloi Backup Alert Notification Dispatcher
# Dispatches targeted failure and recovery warning alerts via Telegram Bot API.

set -uo pipefail

CONFIG_FILE="/etc/selloi/backup.env"
if [[ -f "${CONFIG_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${CONFIG_FILE}"
fi

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_ADMIN_CHAT_ID:-${ADMIN_TELEGRAM_ID:-}}"

LEVEL="ERROR"
STEP="Unknown Step"
ERROR_MSG="Unspecified failure occurred"
LOG_FILE="/var/log/selloi_backup.log"
HOSTNAME_STR="$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo 'selloi-vps')"
TIMESTAMP="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --level LEVEL       Severity level (CRITICAL, ERROR, WARN, INFO; default: ERROR)
  --step STEP         Name of the step where error occurred
  --error MESSAGE     Detailed error description (no credentials)
  --log-file PATH     Path to relevant log file
  -h, --help          Show this help message
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --level)
            LEVEL="$2"
            shift 2
            ;;
        --step)
            STEP="$2"
            shift 2
            ;;
        --error)
            ERROR_MSG="$2"
            shift 2
            ;;
        --log-file)
            LOG_FILE="$2"
            shift 2
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

# Sanitize error message to prevent accidental token or credential leakage
SANITIZED_MSG=$(echo "${ERROR_MSG}" | sed -E 's/[0-9]{8,10}:[a-zA-Z0-9_-]{35}/[REDACTED_BOT_TOKEN]/g' | sed -E 's/password=[^ &]*/password=[REDACTED]/g')

ALERT_TEXT="🚨 *SELLOI BACKUP ALERT: ${LEVEL}*

*Host:* \`${HOSTNAME_STR}\`
*Timestamp:* \`${TIMESTAMP}\`
*Failed Step:* *${STEP}*
*Error Details:*
\`\`\`
${SANITIZED_MSG}
\`\`\`
*Log File Reference:* \`${LOG_FILE}\`

_Automated safety lock engaged: historical backups have been preserved._"

echo "[ALERT Dispatch] ${LEVEL} in step '${STEP}': ${SANITIZED_MSG}" >&2

if [[ -z "${TELEGRAM_BOT_TOKEN}" || -z "${TELEGRAM_CHAT_ID}" ]]; then
    echo "[WARN] Telegram credentials not configured. Skipping remote alert dispatch." >&2
    exit 0
fi

# Send alert with safe timeout and error suppression
HTTP_CODE=$(curl -s -m 10 -o /dev/null -w "%{http_code}" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=${ALERT_TEXT}" \
    -d "parse_mode=Markdown" 2>/dev/null || echo "000")

if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "[OK] Telegram alert dispatched successfully." >&2
else
    echo "[WARN] Failed to dispatch Telegram alert (HTTP ${HTTP_CODE}). Continuing without crashing." >&2
fi

exit 0
