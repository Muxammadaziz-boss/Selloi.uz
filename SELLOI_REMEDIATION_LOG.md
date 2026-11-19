# SELLOI.UZ : Security Remediation & Change Log

**Target:** `selloi.uz` Production Server (`129.146.163.171`)  
**Date:** 2026-11-18  
**Author:** Senior DevSecOps Engineer & Production SRE  

---

## Change Entry 1: Docker Compose Localhost Port Isolation

- **File Modified:** `/home/ubuntu/projects/Telegram_Ai_Seller/docker-compose.yml` (and local `docker-compose.yml`)
- **Previous Configuration:**
  ```yaml
  api:
    ports:
      - "8000:8000"
  web:
    ports:
      - "3000:3000"
  ```
- **New Configuration:**
  ```yaml
  api:
    ports:
      - "127.0.0.1:8000:8000"
  web:
    ports:
      - "127.0.0.1:3000:3000"
  ```
- **Reason:** Docker default daemon routing publishes ports to `0.0.0.0` in the iptables `DOCKER` PREROUTING chain, bypassing UFW host firewall rules and exposing internal FastAPI and Next.js services directly to the internet.
- **Validation Result:**
  Executed `docker compose up -d`. Output of `docker ps` confirmed `127.0.0.1:8000->8000/tcp` and `127.0.0.1:3000->3000/tcp`. `curl -I http://127.0.0.1:3000` and `curl -I http://127.0.0.1:8000/docs` returned 200 OK.
- **Rollback Instructions:**
  Restore backup file:
  `cp /home/ubuntu/projects/Telegram_Ai_Seller/docker-compose.yml.bak_20261118 /home/ubuntu/projects/Telegram_Ai_Seller/docker-compose.yml`
  `cd /home/ubuntu/projects/Telegram_Ai_Seller && docker compose up -d`

---

## Change Entry 2: Nginx Web Server Hardening & Real IP Configuration

- **Files Modified:** `/etc/nginx/nginx.conf` and `/etc/nginx/sites-available/default`
- **Previous Configuration:**
  - `server_tokens build;` in `nginx.conf`.
  - `listen 80 default_server;` and `listen [::]:80 default_server;`.
  - Missing `set_real_ip_from` and `real_ip_header`.
  - Missing defensive HTTP response headers.
  - Missing sensitive file deny blocks (`.env`, `.git`, `.bak`, `.sql`).
- **New Configuration:**
  - `server_tokens off;` in `nginx.conf`.
  - `listen 127.0.0.1:80 default_server;` (bound exclusively to loopback).
  - Real IP extraction:
    ```nginx
    set_real_ip_from 127.0.0.1;
    real_ip_header CF-Connecting-IP;
    ```
  - Defensive security headers:
    ```nginx
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    proxy_hide_header X-Powered-By;
    ```
  - Block rules for dotfiles and sensitive extensions:
    ```nginx
    location ~ /\.(?!well-known) { deny all; access_log off; log_not_found off; return 404; }
    location ~* \.(env|git|sql|bak|swp|yml|yaml|ini|log|conf|sh)$ { deny all; access_log off; log_not_found off; return 404; }
    ```
- **Reason:**
  1. Closes direct HTTP port 80 scanning on the public IP.
  2. Ensures Cloudflare Tunnel passes genuine client IP addresses for rate limiting and forensic logging.
  3. Prevents clickjacking and MIME sniffing vulnerabilities.
  4. Hides tech stack information from automated fingerprinting scanners.
- **Validation Result:**
  `sudo nginx -t` returned successful. `sudo systemctl restart nginx` bound Nginx strictly to `127.0.0.1:80`. Verified `curl -sI https://selloi.uz` contains all security headers and hides server version. Verified `/var/log/nginx/access.log` records real client IPs.
- **Rollback Instructions:**
  Restore backup folder:
  `sudo rm -rf /etc/nginx`
  `sudo cp -r /etc/nginx_backup_20261118 /etc/nginx`
  `sudo systemctl restart nginx`

---

## Change Entry 3: Uncomplicated Firewall (UFW) Policy Tightening

- **Service / Rules Modified:** UFW (`/etc/ufw/user.rules`, `/etc/ufw/user6.rules`)
- **Previous Configuration:**
  - `22/tcp ALLOW IN Anywhere`
  - `80/tcp ALLOW IN Anywhere`
  - `443/tcp ALLOW IN Anywhere`
- **New Configuration:**
  - `22/tcp ALLOW IN Anywhere`
  - Rules for `80/tcp` and `443/tcp` deleted.
- **Reason:** Cloudflare Tunnel operates entirely via outbound connections from the VPS to Cloudflare Edge. There is no requirement for inbound port 80 or 443 on the VPS. Disallowing public inbound HTTP/S eliminates direct port probes and unauthorized origin bypasses.
- **Validation Result:**
  `sudo ufw status verbose` confirms default deny incoming, with only `22/tcp` allowed. Public site `https://selloi.uz` remains 100% accessible via Cloudflare Tunnel. Direct connection `curl http://129.146.163.171:80` times out.
- **Rollback Instructions:**
  To re-open public web ports if ever needed:
  `sudo ufw allow 80/tcp`
  `sudo ufw allow 443/tcp`

---

## Change Entry 4: OpenSSH Server Hardening

- **File Modified:** `/etc/ssh/sshd_config.d/99-security-hardening.conf`
- **Previous Configuration:** Default settings (`MaxAuthTries 6`, `X11Forwarding yes`, `ClientAliveInterval 0`).
- **New Configuration:**
  ```text
  PasswordAuthentication no
  PubkeyAuthentication yes
  PermitEmptyPasswords no
  MaxAuthTries 3
  X11Forwarding no
  ClientAliveInterval 300
  ClientAliveCountMax 2
  LoginGraceTime 30
  MaxSessions 5
  AllowAgentForwarding no
  ```
- **Reason:** Enforce strict authentication limits, drop idle sessions after 10 minutes of inactivity, prevent X11 forwarding overhead on a headless server, and harden against credential abuse.
- **Validation Result:**
  `sudo sshd -t` validated syntax. `sudo systemctl reload ssh` applied changes without dropping the current SSH session. Verified new login session succeeded with public key authentication.
- **Rollback Instructions:**
  Remove hardening file and reload SSH:
  `sudo rm -f /etc/ssh/sshd_config.d/99-security-hardening.conf`
  `sudo systemctl reload ssh`

---

## Change Entry 5: Fail2ban Intrusion Prevention Deployment

- **Service Modified:** `fail2ban.service`
- **Previous Configuration:** `fail2ban` was not installed on the system.
- **New Configuration:**
  Installed package `fail2ban` via `apt-get`. Enabled and started service with standard `sshd` jail reading from systemd journal.
- **Reason:** Automatically detects and blocks brute-force attackers attempting repeated failed authentications on SSH port 22.
- **Validation Result:**
  `sudo fail2ban-client status sshd` confirmed active monitoring with `_SYSTEMD_UNIT=ssh.service`.
- **Rollback Instructions:**
  `sudo systemctl stop fail2ban`
  `sudo systemctl disable fail2ban`
  `sudo apt-get remove -y fail2ban`

---

## Change Entry 6: Masking Unnecessary Daemons (`rpcbind`, `ModemManager`)

- **Services Modified:** `rpcbind.service`, `rpcbind.socket`, `ModemManager.service`
- **Previous Configuration:** Active and running in `systemd`. `rpcbind` listening on UDP/TCP port 111 across `0.0.0.0`.
- **New Configuration:** Stopped, disabled, and masked to `/dev/null`.
- **Reason:** Legacy RPC portmap daemon is unnecessary for this web application and represents a classic amplification attack surface. ModemManager is unneeded on cloud server infrastructure.
- **Validation Result:**
  `ss -tulpn | grep 111` returned empty. Port 111 is closed.
- **Rollback Instructions:**
  `sudo systemctl unmask rpcbind.service rpcbind.socket ModemManager.service`
  `sudo systemctl enable rpcbind.service rpcbind.socket ModemManager.service`
  `sudo systemctl start rpcbind.service rpcbind.socket ModemManager.service`

---

## Change Entry 7: Automated PostgreSQL & Storage Disaster Recovery Pipeline

- **Files Created:**
  - Script: `/usr/local/bin/selloi_backup.sh` (mode `750`, `root:root`)
  - Cron Job: `/etc/cron.d/selloi-backup` (mode `644`, `root:root`)
  - Storage Directory: `/var/backups/selloi` (mode `700`, `root:root`)
- **Previous Configuration:** No automated backups existed.
- **New Configuration:**
  Daily automated dump of PostgreSQL database `aisales` (`pg_dump | gzip`) and tarball of storage directory (`storage/`) at 03:00 UTC. Self-validation check via `gzip -t` and file-size threshold. Automated deletion of backups older than 7 days.
- **Reason:** Ensures recoverability in the event of hardware failure, database corruption, or ransomware threat.
- **Validation Result:**
  Manual execution generated verified files `/var/backups/selloi/aisales_db_20261118_145246.sql.gz` and `storage_20261118_145246.tar.gz`. Integrity verified with `gzip -t`.
- **Rollback Instructions:**
  `sudo rm -f /etc/cron.d/selloi-backup`
  `sudo rm -f /usr/local/bin/selloi_backup.sh`
  `sudo rm -rf /var/backups/selloi`

---

## Change Entry 8: Operating System Security Package Upgrades

- **Packages Upgraded:** `distro-info`, `python3-distro-info`, `software-properties-common`, `python3-software-properties`, `snapd`.
- **Previous Configuration:** 5 upgradable packages flagged by `apt`.
- **New Configuration:** Upgraded to latest security maintenance release.
- **Reason:** Mitigates known package vulnerabilities and keeps system libraries supported.
- **Validation Result:**
  `apt-get upgrade -y` completed with exit code 0. No service failures reported.
- **Rollback Instructions:** Packages are managed by standard Ubuntu APT repository.
