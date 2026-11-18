# SELLOI.UZ — Production Security Hardening Report

**System Name:** Selloi Platform (`selloi.uz`)  
**Deployment Infrastructure:** Oracle Cloud Infrastructure VPS (`129.146.163.171`), Ubuntu 26.04.1 LTS  
**Date of Execution:** 2026-11-18  
**Engineer:** Senior DevSecOps Engineer & Production SRE  
**Status:** Completed & Validated  

---

## 1. Scope and Objectives

The objective was to perform comprehensive security hardening on the production infrastructure hosting **Selloi.uz** while guaranteeing **zero downtime**, **zero data loss**, and **uninterrupted customer service**.

### Key Milestones Achieved:
1. Eliminated all direct-to-origin exposure across IPv4 and IPv6.
2. Contained Docker container networking so application ports are never accessible directly from the internet.
3. Configured Nginx to listen exclusively on loopback (`127.0.0.1`), terminating Cloudflare Tunnel connections securely.
4. Restored real client IP resolution from Cloudflare Tunnel ingress headers (`CF-Connecting-IP`), unblinding backend rate limiting and audit logs.
5. Injected defensive HTTP response headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) and removed tech stack identifiers (`server_tokens off`, `X-Powered-By` hidden).
6. Hardened SSH service parameters and deployed `fail2ban` with active automated jail defense.
7. Masked legacy and unneeded system daemons (`rpcbind`, `ModemManager`).
8. Engineered an automated, self-validating disaster recovery backup pipeline for PostgreSQL and persistent assets.
9. Upgraded pending security packages via `apt`.

---

## 2. Hardening Implementations by Phase

### Phase 1: Infrastructure Discovery & Perimeter Mapping
- **Action:** Audited open ports using `ss -tulpn`, firewall rules using `ufw status numbered` and `iptables -S`, Docker processes using `docker ps`, and cloudflared ingress mappings.
- **Key Finding:** Next.js (port 3000), FastAPI (port 8000), and Nginx (port 80) were listening on `0.0.0.0`. Bot scans were actively hitting port 80 directly.

### Phase 2 & 7: Docker & Network Isolation Hardening
- **Target File:** `/home/ubuntu/projects/Telegram_Ai_Seller/docker-compose.yml`
- **Implementation:**
  Updated port bindings for `api` and `web` from general host exposure to loopback interface only:
  ```yaml
  # Previous:
  ports:
    - "8000:8000"
    - "3000:3000"

  # Hardened:
  ports:
    - "127.0.0.1:8000:8000"
    - "127.0.0.1:3000:3000"
  ```
- **Deployment:** Executed `docker compose up -d` to recreate containers.
- **Result:** Containers communicate internally through the `telegram_ai_seller_default` bridge, host Nginx reverse proxy connects over `127.0.0.1`, and external connection attempts are rejected at the TCP level.

### Phase 4: Nginx Web Server Hardening
- **Target Files:** `/etc/nginx/nginx.conf` and `/etc/nginx/sites-available/default`
- **Configuration Changes:**
  1. Disabled server signature in `nginx.conf`:
     ```nginx
     server_tokens off;
     ```
  2. Bound virtual host exclusively to loopback:
     ```nginx
     listen 127.0.0.1:80 default_server;
     ```
  3. Added Cloudflare Tunnel Real IP parsing:
     ```nginx
     set_real_ip_from 127.0.0.1;
     real_ip_header CF-Connecting-IP;
     ```
  4. Injected defensive security headers:
     ```nginx
     add_header X-Content-Type-Options "nosniff" always;
     add_header X-Frame-Options "SAMEORIGIN" always;
     add_header Referrer-Policy "strict-origin-when-cross-origin" always;
     add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
     proxy_hide_header X-Powered-By;
     ```
  5. Implemented deny rules for dotfiles and sensitive extensions:
     ```nginx
     location ~ /\.(?!well-known) {
         deny all;
         access_log off;
         log_not_found off;
         return 404;
     }
     location ~* \.(env|git|sql|bak|swp|yml|yaml|ini|log|conf|sh)$ {
         deny all;
         access_log off;
         log_not_found off;
         return 404;
     }
     ```
- **Validation:** Tested with `sudo nginx -t` (syntax OK) and restarted service via `sudo systemctl restart nginx`.

### Phase 2: Host Firewall (UFW) Hardening
- **Implementation:** With Nginx bound to `127.0.0.1:80` and `cloudflared` using outbound QUIC tunnels, public inbound HTTP and HTTPS rules were retired.
- **Commands:**
  ```bash
  sudo ufw delete allow 80/tcp
  sudo ufw delete allow 443/tcp
  ```
- **Active Firewall Policy:**
  ```text
  Status: active
  Logging: on (low)
  Default: deny (incoming), allow (outgoing), deny (routed)
  To                         Action      From
  22/tcp                     ALLOW IN    Anywhere                  
  22/tcp (v6)                ALLOW IN    Anywhere (v6)
  ```

### Phase 3: SSH Service Hardening & Fail2ban Deployment
- **Target File:** `/etc/ssh/sshd_config.d/99-security-hardening.conf`
- **Settings Applied:**
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
- **Validation:** Tested with `sudo sshd -t` (valid), reloaded with `sudo systemctl reload ssh`. Kept existing session active while establishing a secondary validation connection.
- **Intrusion Prevention:** Installed `fail2ban`, enabled `systemctl enable fail2ban`, started service, and verified the `sshd` jail actively monitors `ssh.service`.

### Phase 8: System Clean-up & Security Patching
- **Unnecessary Services Retired:** Stopped, disabled, and masked `rpcbind.service`, `rpcbind.socket`, and `ModemManager.service`. Confirmed port 111 is closed.
- **Operating System Updates:** Executed `sudo apt-get upgrade -y` to apply pending security updates for `distro-info`, `python3-distro-info`, `python3-software-properties`, `snapd`, and `software-properties-common`.
- **Automated Security Updates:** Verified `/etc/apt/apt.conf.d/20auto-upgrades` has daily package list updates and daily unattended upgrades enabled (`active`).

### Phase 9: Automated Disaster Recovery Backup Pipeline
- **Target Script:** `/usr/local/bin/selloi_backup.sh` (owned by `root:root`, mode `750`).
- **Features:**
  1. PostgreSQL database dump via `docker exec telegram_ai_seller-db-1 pg_dump -U sales -d aisales`.
  2. Streamed directly through `gzip` to `/var/backups/selloi/aisales_db_TIMESTAMP.sql.gz`.
  3. Archive of persistent customer storage (`/home/ubuntu/projects/Telegram_Ai_Seller/storage`) to `storage_TIMESTAMP.tar.gz`.
  4. Self-validation using `gzip -t` and file-size threshold tests before declaring success.
  5. Automatic pruning of backups older than 7 days.
  6. File permissions set to `600` on every artifact; directory restricted to `700` (`root:root`).
- **Scheduling:** Configured `/etc/cron.d/selloi-backup` for daily execution at 03:00 UTC.

---

## 3. Evidence of Verification

### 3.1 Network Listening Sockets (`ss -tulpn`)
```text
Netid State  Recv-Q Send-Q     Local Address:Port  Peer Address:PortProcess                                                     
tcp   LISTEN 0      4096             0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=14176,fd=3))
tcp   LISTEN 0      4096           127.0.0.1:8000       0.0.0.0:*    users:(("docker-proxy",pid=739443,fd=7))
tcp   LISTEN 0      4096           127.0.0.1:3000       0.0.0.0:*    users:(("docker-proxy",pid=739523,fd=7))
tcp   LISTEN 0      511            127.0.0.1:80         0.0.0.0:*    users:(("nginx",pid=740265,fd=5))
tcp   LISTEN 0      4096                [::]:22            [::]:*    users:(("sshd",pid=14176,fd=4))
```
*Zero application or web sockets are listening on 0.0.0.0 except SSH.*

### 3.2 Public Edge Verification (`curl -sI https://selloi.uz`)
```text
HTTP/1.1 200 OK
Date: Wed, 18 Nov 2026 14:52:04 GMT
Content-Type: text/html; charset=utf-8
Connection: keep-alive
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
Server: cloudflare
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
cf-cache-status: DYNAMIC
alt-svc: h3=":443"; ma=86400
```
*Status 200 OK, Cloudflare Edge proxying, all defensive security headers present.*

### 3.3 Direct IP Penetration Test (`curl http://129.146.163.171:80`)
```text
curl: (28) Connection timed out after 3002 milliseconds
```
*Direct-to-IP connection is completely blocked.*

### 3.4 Client IP Logging Verification (`/var/log/nginx/access.log`)
```text
144.124.192.80 - - [18/Nov/2026:14:49:30 +0000] "HEAD / HTTP/1.1" 200 0 "-" "curl/8.16.0"
144.124.192.80 - - [18/Nov/2026:14:49:31 +0000] "HEAD / HTTP/1.1" 200 0 "-" "curl/8.16.0"
```
*Real client IP (`144.124.192.80`) is accurately captured through Cloudflare Tunnel.*

### 3.5 Automated Backup Execution Output
```text
[2026-11-18 14:52:46] Starting Selloi automated backup...
[2026-11-18 14:52:46] Dumping PostgreSQL database 'aisales'...
[2026-11-18 14:52:46] Database backup successful: /var/backups/selloi/aisales_db_20261118_145246.sql.gz (8.0K)
[2026-11-18 14:52:46] Archiving persistent storage directory...
[2026-11-18 14:52:46] Storage archive successful: /var/backups/selloi/storage_20261118_145246.tar.gz (4.0K)
[2026-11-18 14:52:46] Cleaning up backups older than 7 days...
[2026-11-18 14:52:46] Selloi automated backup completed successfully.
```

---

## 4. Final Verdict

### **PRODUCTION READY**
All security requirements have been fulfilled. The system operates with strict defense-in-depth across the network, operating system, web proxy, container, and application layers.
