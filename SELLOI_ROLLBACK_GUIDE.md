# SELLOI.UZ : Production Infrastructure Rollback & Disaster Recovery Guide

**Target System:** `selloi.uz` / `www.selloi.uz`  
**Host:** Oracle Cloud VPS (`129.146.163.171`), user: `ubuntu`  
**Created:** 2026-11-18  
**Purpose:** Precise, step-by-step procedures to revert any hardening modification or restore the database and persistent data from disaster recovery backups.

---

## 1. Safety Principles Before Any Rollback

1. **Verify Management Access First:** Always maintain an active SSH connection. Never close your active session while reconfiguring network or SSH settings.
2. **Review Incident Cause:** Ensure that reverting a security hardening measure does not re-open a vulnerability that is currently being actively exploited.
3. **Execute Incrementally:** Revert only the specific component experiencing issues. Do not apply broad system rollbacks if an isolated service is the source of the problem.

---

## 2. Component-by-Component Rollback Procedures

### 2.1 Reverting Docker Port Bindings
*Use this if an external tool or diagnostic script requires direct host access to ports 3000 or 8000.*

```bash
# 1. SSH into the production server
ssh -i ~/.ssh/vps_key ubuntu@129.146.163.171

# 2. Revert docker-compose.yml to the backup
cd /home/ubuntu/projects/Telegram_Ai_Seller
cp docker-compose.yml.bak_20261118 docker-compose.yml

# 3. Recreate the containers with original port bindings
docker compose up -d

# 4. Verify that ports are bound to 0.0.0.0
docker ps
```

---

### 2.2 Reverting Nginx Web Server Configuration
*Use this if Nginx fails to route, or if an upstream change breaks reverse proxying.*

```bash
# 1. SSH into the production server
ssh -i ~/.ssh/vps_key ubuntu@129.146.163.171

# 2. Restore full Nginx configuration directory from backup
sudo rm -rf /etc/nginx
sudo cp -r /etc/nginx_backup_20261118 /etc/nginx

# 3. Test configuration syntax
sudo nginx -t

# 4. Restart Nginx to rebind sockets
sudo systemctl restart nginx

# 5. Verify Nginx status
sudo systemctl status nginx --no-pager
```

---

### 2.3 Reverting Firewall (UFW) Rules
*Use this if public direct inbound HTTP/HTTPS traffic must temporarily be accepted directly without Cloudflare.*

```bash
# 1. SSH into the production server
ssh -i ~/.ssh/vps_key ubuntu@129.146.163.171

# 2. Allow ports 80 and 443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 3. Verify active rules
sudo ufw status verbose
```

---

### 2.4 Reverting SSH Hardening
*Use this if SSH client connectivity issues arise from MaxAuthTries or idle timeouts.*

```bash
# 1. Remove the custom hardening snippet
sudo rm -f /etc/ssh/sshd_config.d/99-security-hardening.conf

# 2. Validate sshd configuration
sudo sshd -t

# 3. Reload SSH daemon
sudo systemctl reload ssh

# 4. Verify from a separate terminal that SSH connects normally
```

---

### 2.5 Removing / Disabling Fail2ban
*Use this if legitimate administrator IP addresses are being blocked or if troubleshooting connection issues.*

```bash
# Unban a specific IP address:
sudo fail2ban-client set sshd unbanip <IP_ADDRESS>

# Temporarily stop fail2ban:
sudo systemctl stop fail2ban

# Permanently disable and remove:
sudo systemctl disable fail2ban
sudo apt-get remove -y fail2ban
```

---

### 2.6 Unmasking Retired Services (`rpcbind`, `ModemManager`)
*Use this only if an external service or package strictly requires RPC bind.*

```bash
sudo systemctl unmask rpcbind.service rpcbind.socket ModemManager.service
sudo systemctl enable rpcbind.service rpcbind.socket ModemManager.service
sudo systemctl start rpcbind.service rpcbind.socket ModemManager.service
```

---

## 3. Disaster Recovery: Database & Media Restore Procedure

In the event of database corruption, data loss, or server migration, follow this procedure to restore PostgreSQL data and customer media from automated backups.

### 3.1 Locate Available Backups
Automated backups are stored in `/var/backups/selloi/`:
```bash
sudo ls -lah /var/backups/selloi
```
Example files:
- Database: `/var/backups/selloi/aisales_db_YYYYMMDD_HHMMSS.sql.gz`
- Storage: `/var/backups/selloi/storage_YYYYMMDD_HHMMSS.tar.gz`

### 3.2 Restoring PostgreSQL Database (`aisales`)
```bash
# 1. Ensure the PostgreSQL container is running
docker compose -f /home/ubuntu/projects/Telegram_Ai_Seller/docker-compose.yml ps db

# 2. Choose the desired backup file
RESTORE_FILE="/var/backups/selloi/aisales_db_20261118_145246.sql.gz"

# 3. Verify backup archive integrity
sudo gzip -t "${RESTORE_FILE}"

# 4. Drop and recreate the database, or restore directly into 'aisales'
# Warning: This overwrites existing tables with the backed-up state
sudo zcat "${RESTORE_FILE}" | docker exec -i telegram_ai_seller-db-1 psql -U sales -d aisales

# 5. Restart backend API to flush caches and refresh connection pools
cd /home/ubuntu/projects/Telegram_Ai_Seller
docker compose restart api
```

### 3.3 Restoring Persistent Storage Directory
```bash
# 1. Choose the storage archive file
STORAGE_ARCHIVE="/var/backups/selloi/storage_20261118_145246.tar.gz"

# 2. Extract into the projects directory
sudo tar -xzf "${STORAGE_ARCHIVE}" -C /home/ubuntu/projects/Telegram_Ai_Seller/

# 3. Ensure proper file ownership
sudo chown -R ubuntu:ubuntu /home/ubuntu/projects/Telegram_Ai_Seller/storage
```

---

## 4. Verification After Any Rollback or Restore

Run the following smoke tests immediately following any rollback or restore operation:

```bash
# 1. Verify Cloudflare Tunnel health
sudo systemctl status cloudflared --no-pager

# 2. Verify local Nginx and container responses
curl -sI http://127.0.0.1:80 | head -n 5
curl -sI http://127.0.0.1:3000 | head -n 5
curl -sI http://127.0.0.1:8000/docs | head -n 5

# 3. Verify external public endpoint
curl -sI https://selloi.uz
curl -sI https://www.selloi.uz
```
