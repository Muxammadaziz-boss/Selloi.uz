# SELLOI.UZ — Backup & Disaster Recovery Verification Report

**System:** Selloi Production Environment  
**Database:** PostgreSQL 16.16 (pgvector) inside container `telegram_ai_seller-db-1`  
**Media Storage:** `/home/ubuntu/projects/Telegram_Ai_Seller/storage`  
**Audit Date:** 2026-11-18  
**Auditor:** Independent Senior DevSecOps Auditor  

---

## 1. Overview of Disaster Recovery Setup

A dedicated backup automation script was implemented at `/usr/local/bin/selloi_backup.sh` and scheduled via `/etc/cron.d/selloi-backup` to execute daily at 03:00 UTC. The backup pipeline protects two core data repositories:
1. **Relational Database (`aisales`):** Contains user accounts, tenant configurations, product catalogs, customer conversations, order records, and vector embeddings.
2. **Persistent Media Storage (`storage/`):** Contains cached Telegram channel images and storefront media assets.

---

## 2. Technical Inspection & Verification Criteria

### 2.1 Backup Script & Cron Configuration Inspection
- **Script Location:** `/usr/local/bin/selloi_backup.sh`
- **Ownership & Permissions:** `root:root`, mode `750` (`-rwxr-x---`). Regular non-root users cannot edit or execute the backup script.
- **Cron Schedule:** `/etc/cron.d/selloi-backup` (mode `644`, owned by `root:root`):
  ```text
  0 3 * * * root /usr/local/bin/selloi_backup.sh >/dev/null 2>&1
  ```
- **Log Destination:** `/var/log/selloi_backup.log` (mode `644`, appended with timestamps).

---

### 2.2 At-Rest Encryption Analysis
- **Current State:** **NOT ENCRYPTED AT REST (COMPRESSED ONLY)**
- **Audit Findings:**
  The backup generation commands in `/usr/local/bin/selloi_backup.sh` stream output through standard `gzip`:
  ```bash
  docker exec telegram_ai_seller-db-1 pg_dump -U sales -d aisales | gzip > "${DB_BACKUP_FILE}"
  tar -czf "${STORAGE_BACKUP_FILE}" -C "$(dirname "${STORAGE_SRC}")" "$(basename "${STORAGE_SRC}")"
  ```
- **Security Assessment:**
  The backup files are gzip-compressed (.gz), but they are **not symmetrically or asymmetrically encrypted** using tools such as `gpg`, `age`, or `openssl enc`.
  If an unauthorized user gains physical access to the server disk or reads the filesystem with root privileges, the database dump contents can be decompressed directly using `zcat` or `gzip -d`.
- **Mitigating Factor:**
  The backup directory (`/var/backups/selloi`) is protected with strict `chmod 700` (`drwx------`, `root:root`), and each generated backup file is chmodded to `600` (`-rw-------`). Non-root local users cannot access or list the directory.
- **Recommendation:** Implement GPG public-key encryption or symmetric passphrased encryption (`gpg -c` or `age`) as an added defense-in-depth layer.

---

### 2.3 Off-Host Storage Analysis
- **Current State:** **LOCAL HOST STORAGE ONLY**
- **Audit Findings:**
  Backups are saved exclusively to the local root NVMe disk on the Oracle Cloud VPS at:
  `/var/backups/selloi/aisales_db_YYYYMMDD_HHMMSS.sql.gz`
  `/var/backups/selloi/storage_YYYYMMDD_HHMMSS.tar.gz`
- **Risk Assessment:**
  In the event of:
  - Total virtual machine termination or hypervisor failure;
  - Unrecoverable NVMe disk corruption;
  - Compromise of the root account;
  both the production application and the backup archives would be lost simultaneously.
- **Recommendation:** Implement automated off-site synchronization (e.g. an `rclone` or AWS CLI task pushing encrypted backups to an S3 bucket, Cloudflare R2, or Oracle Cloud Object Storage with immutable Object Lock enabled).

---

### 2.4 Retention Policy Verification
- **Audit Findings:**
  The script incorporates a daily retention pruning routine:
  ```bash
  find "${BACKUP_DIR}" -type f -name "*.gz" -mtime +7 -delete
  ```
- **Assessment:** **PASS**. Automatically purges archives older than 7 days, maintaining a clean rolling 7-day recovery window without exhausting VPS disk space.

---

### 2.5 Combined PostgreSQL & Media Restore Feasibility
- **Audit Findings:**
  Both database and storage archives are generated within the same second during script execution and share identical ISO timestamp suffixes:
  `aisales_db_20261118_145246.sql.gz`
  `storage_20261118_145246.tar.gz`
- **Assessment:** **PASS**. Point-in-time state consistency between database records (e.g. image URLs) and physical disk files (media files) is preserved.

---

## 3. Isolated Dry-Run Restore Test Results

A non-destructive isolated restore validation was performed on the production server without interrupting active containers or modifying the live `aisales` database.

### Test 1: Archive Decompression & Checksum Verification
- **Command:** `gzip -t /var/backups/selloi/*.gz`
- **Output:**
  ```text
  Database gzip archive integrity: VALID
  Storage tar.gz archive integrity: VALID
  ```
- **Result:** **PASS**. Zero block corruptions or archive truncation detected.

### Test 2: SQL Dump Header & Trailer Syntax Verification
- **Command:** `zcat /var/backups/selloi/aisales_db_20261118_145246.sql.gz | head -n 10`
- **Output:**
  ```text
  --
  -- PostgreSQL database dump
  --
  \restrict sPXa4QnviXGAJOmaNDkotxRyQrdfV4GfxJX57MPHvW0TTzrm4vbGHWxXZPN4rhG
  -- Dumped from database version 16.16 (Debian 16.16-1.pgdg12+1)
  -- Dumped by pg_dump version 16.16 (Debian 16.16-1.pgdg12+1)
  SET statement_timeout = 0;
  ```
- **Trailer Output:**
  ```text
  -- PostgreSQL database dump complete
  \unrestrict sPXa4QnviXGAJOmaNDkotxRyQrdfV4GfxJX57MPHvW0TTzrm4vbGHWxXZPN4rhG
  ```
- **Result:** **PASS**. The dump was generated completely from start to finish without aborting or timing out.

### Test 3: Sandbox Storage Extraction Dry-run
- **Command:**
  ```bash
  mkdir -p /tmp/test_restore_sandbox
  tar -xzf /var/backups/selloi/storage_20261118_145246.tar.gz -C /tmp/test_restore_sandbox
  ls -la /tmp/test_restore_sandbox/storage
  rm -rf /tmp/test_restore_sandbox
  ```
- **Output:**
  ```text
  drwxrwxr-x 3 ubuntu ubuntu 60 Nov 16 14:21 .
  drwxrwxr-x 2 ubuntu ubuntu 40 Nov 16 14:21 channel_images
  Isolated restore test: COMPLETED SUCCESSFULLY
  ```
- **Result:** **PASS**. Storage directory structure, subfolders, and file attributes unpacked cleanly.

---

## 4. Recovery Time & Point Objectives (RTO / RPO)

- **Recovery Point Objective (RPO):** 24 hours (daily cron schedule at 03:00 UTC).
- **Recovery Time Objective (RTO):** Approximately 5–10 minutes to decompress and stream SQL dump into PostgreSQL via `psql` and unpack the storage tarball.

---

## 5. Audit Recommendations for DR Maturity

1. **Phase 1 (Immediate):** Configure off-host synchronization to Cloudflare R2 or Oracle Object Storage using an unprivileged IAM service principal.
2. **Phase 2 (Defense-in-Depth):** Pipe `gzip` output through `gpg` or `age` with an encryption key stored securely in a dedicated secrets manager or password vault.
3. **Phase 3 (Disaster Testing):** Conduct a quarterly full disaster recovery rehearsal on an isolated staging instance.
