#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${LOG_FILE:-/var/log/selloi_backup.log}"
touch "${LOG_FILE}"

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Starting weekly Docker maintenance..." | tee -a "${LOG_FILE}"
docker image prune -a -f --filter "until=168h" >> "${LOG_FILE}" 2>&1 || true
docker builder prune -af --filter "until=168h" >> "${LOG_FILE}" 2>&1 || true
DISK_LINE="$(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Weekly Docker maintenance done. Root disk: ${DISK_LINE}" | tee -a "${LOG_FILE}"
