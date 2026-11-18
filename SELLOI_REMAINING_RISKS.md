# SELLOI.UZ — Remaining Risks & Security Roadmap

**Target System:** `selloi.uz` / `www.selloi.uz`  
**Assessment Date:** 2026-11-18  
**Auditor:** Independent Senior DevSecOps Auditor  
**Document Purpose:** Clear, prioritized registry of residual infrastructure and application risks with concrete remediation steps.

---

## 1. Residual Risk Registry

### RISK-01: Single Point of Storage for Disaster Recovery Backups (Local Host Only)
- **Risk ID:** `RSK-INF-001`
- **Severity:** **HIGH**
- **Likelihood:** Low
- **Impact:** Critical (Catastrophic Data Loss)
- **Description:** Automated database dumps and media archives are stored exclusively on the local NVMe root disk at `/var/backups/selloi/`. If the Oracle Cloud VPS instance is accidentally deleted, suffers catastrophic storage hardware failure, or experiences hypervisor corruption, all backups would be destroyed alongside the active production data.
- **Current Mitigation:** Daily automated backups with verified gzip integrity, 7-day retention, and strict file permissions (`600`/`700`).
- **Remediation Plan:**
  1. Provision a private, authenticated object storage bucket (e.g. Cloudflare R2, Oracle Cloud Object Storage, or AWS S3) with Object Lock (immutability) enabled.
  2. Install and configure `rclone` or AWS CLI on the host using scoped, least-privilege API credentials.
  3. Append an automated sync step in `/usr/local/bin/selloi_backup.sh` after local verification passes:
     ```bash
     rclone copy /var/backups/selloi/ remote-backup:selloi-backups/
     ```

---

### RISK-02: Absence of At-Rest Cryptographic Encryption on Backup Dumps
- **Risk ID:** `RSK-INF-002`
- **Severity:** **MEDIUM**
- **Likelihood:** Low
- **Impact:** High (Sensitive Data Disclosure)
- **Description:** Backup files are compressed via `gzip` without an additional cryptographic layer (such as AES-256 or GPG/age). Protection currently relies entirely on Linux filesystem Discretionary Access Controls (`chmod 700` and `600` owned by `root`).
- **Current Mitigation:** Restricted directory permissions (`drwx------ root:root`). Non-root users cannot read or list the directory.
- **Remediation Plan:**
  1. Generate an encryption key or GPG recipient keypair.
  2. Update `/usr/local/bin/selloi_backup.sh` to pipe the compressed stream through `gpg --encrypt` or `age -r <public_key>` before writing to disk.
  3. Securely escrow the decryption key off-host in a password manager or cloud key management service (KMS).

---

### RISK-03: Cloudflare Free Plan Rate Limiting Rule Quota
- **Risk ID:** `RSK-EDG-001`
- **Severity:** **MEDIUM**
- **Likelihood:** Medium
- **Impact:** Medium (Layer 7 HTTP Floods)
- **Description:** Cloudflare Free tier permits only 1 custom rate limiting rule. While backend application-level rate limiting is actively enforced for `/auth/login` and `/auth/register` (5 attempts per minute), Layer 7 volumetric HTTP floods against general endpoints must be absorbed by Cloudflare's automated unmanaged DDoS heuristics.
- **Current Mitigation:** In-memory application rate limiting (`is_rate_limited`) and Cloudflare automated DDoS protection.
- **Remediation Plan:**
  1. Upgrade Cloudflare zone to Pro tier ($20/month) when transaction volume scales.
  2. Implement Cloudflare Managed WAF Rulesets (OWASP Core Ruleset) and multiple custom rate limiting rules for `/api/*` endpoints.

---

### RISK-04: Container Execution as Root Inside Namespaces
- **Risk ID:** `RSK-CNT-001`
- **Severity:** **LOW**
- **Likelihood:** Low
- **Impact:** Medium (Container Breakout Defense-in-Depth)
- **Description:** `telegram_ai_seller-api-1` and `telegram_ai_seller-web-1` run without an explicit `USER` directive in their Dockerfiles, causing processes inside the container to execute with UID 0. While containers are unprivileged (`HostConfig.Privileged: false`) and cannot reach host devices, executing as a non-root user is a recommended container security best practice.
- **Current Mitigation:** `privileged: false`, limited host volume binds (`/app/storage` only), loopback network binding.
- **Remediation Plan:**
  1. In backend `Dockerfile`, create a system group and user (`addgroup -S app && adduser -S app -G app`) and append `USER app`.
  2. In `web/Dockerfile`, use the standard `USER node` directive provided in the Node.js alpine/slim image.

---

### RISK-05: Public Visibility of Interactive Swagger API Documentation
- **Risk ID:** `RSK-APP-001`
- **Severity:** **LOW**
- **Likelihood:** Medium
- **Impact:** Low (API Reconnaissance)
- **Description:** While API endpoints enforce authentication (`401 Unauthorized`), the interactive Swagger UI (`https://selloi.uz/docs`) and OpenAPI schema (`https://selloi.uz/openapi.json`) are accessible without basic authentication, providing an attacker with an indexed list of endpoint routes and schema definitions.
- **Current Mitigation:** Endpoints are strictly protected with authentication and authorization checks.
- **Remediation Plan:**
  1. In Nginx, add HTTP Basic Authentication (`auth_basic`) on `location ~ ^/(docs|openapi.json)`:
     ```nginx
     location ~ ^/(docs|openapi.json) {
         auth_basic "Restricted API Documentation";
         auth_basic_user_file /etc/nginx/.htpasswd;
         proxy_pass http://127.0.0.1:8000;
     }
     ```
  2. Alternatively, disable Swagger UI in production by setting `docs_url=None` and `redoc_url=None` in `FastAPI(docs_url=None if settings.is_production else "/docs")`.

---

### RISK-06: External Heartbeat & Synthetic Uptime Monitoring
- **Risk ID:** `RSK-OPS-001`
- **Severity:** **LOW**
- **Likelihood:** Medium
- **Impact:** Medium (Delayed Outage Detection)
- **Description:** Health checks currently run locally via systemd and cloudflared metrics (`127.0.0.1:20241/ready`). There is no external third-party synthetic monitoring service configured to alert platform operators via SMS or Telegram if the Cloudflare Tunnel or VPS encounters an outage.
- **Current Mitigation:** Systemd automatic restart policies on `cloudflared`, `nginx`, and Docker services.
- **Remediation Plan:**
  1. Set up an external uptime monitor (e.g. Better Stack, UptimeRobot, or Cloudflare Health Checks) pinging `https://selloi.uz/` every 60 seconds.
  2. Configure alerting hooks directly to the administrator Telegram chat or phone.

---

## 2. Prioritized Implementation Roadmap

| Priority | Risk ID | Action Item | Target Timeline | Impact on System |
| :---: | :---: | :--- | :---: | :---: |
| **P1** | `RSK-INF-001` | Set up off-host backup synchronization to S3/Cloudflare R2 | 1–3 Days | Zero downtime; DR safety |
| **P2** | `RSK-INF-002` | Add GPG / age encryption to the backup script | 1–3 Days | Zero downtime; data protection |
| **P3** | `RSK-APP-001` | Restrict `/docs` and `/openapi.json` behind HTTP Basic Auth | 1 Week | Developer access control |
| **P4** | `RSK-OPS-001` | Connect external synthetic uptime monitoring & alerting | 1 Week | Proactive SRE notification |
| **P5** | `RSK-CNT-001` | Migrate container Dockerfiles to non-root `USER` execution | Next Sprint | Container hardening |
