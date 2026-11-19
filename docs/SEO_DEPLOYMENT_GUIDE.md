# Selloi.uz: Production Deployment & Rollback Guide for SEO & Frontend Release

**Target Environment:** Selloi.uz Production VPS  
**Host:** `ubuntu@129.146.163.171`  
**Git Branch:** `frontend/linear-redesign`  
**Date:** November 2026  
**Safety Classification:** NON-DESTRUCTIVE / ZERO APPLICATION DOWNTIME  

---

## 1. Safety Rules & Pre-Deployment Checklist

Before deploying changes to production, ensure:
1. No uncommitted local changes exist on the production server (`git status`).
2. Docker containers for backend, database, and cloudflared tunnel remain undisturbed.
3. Only the frontend container will be rebuilt and refreshed.
4. Production database and persistent volumes are never modified.

---

## 2. Step-by-Step Deployment Instructions

### Step 1: Connect to VPS
```bash
ssh ubuntu@129.146.163.171
```

### Step 2: Navigate to Project Directory
```bash
cd /opt/selloi  # or your active project directory
```

### Step 3: Fetch and Pull Latest Changes
```bash
git fetch origin frontend/linear-redesign
git checkout frontend/linear-redesign
git pull origin frontend/linear-redesign
```

### Step 4: Build and Refresh Frontend Container
```bash
# Rebuild frontend container with new static SEO routes without downtime
docker compose build frontend
docker compose up -d --no-deps frontend
```

### Step 5: Verify Production Endpoints
Run post-deployment health checks from the server:
```bash
# 1. Verify robots.txt route returns HTTP 200
curl -sI https://selloi.uz/robots.txt | grep -E "HTTP/|content-type"

# 2. Verify sitemap.xml route returns HTTP 200
curl -sI https://selloi.uz/sitemap.xml | grep -E "HTTP/|content-type"

# 3. Verify Open Graph image route returns HTTP 200
curl -sI https://selloi.uz/og-image.png | grep -E "HTTP/|content-type"

# 4. Verify canonical and JSON-LD structured data on homepage
curl -s https://selloi.uz/ | grep -o '<link rel="canonical" href="https://selloi.uz"/>'
curl -s https://selloi.uz/ | grep -o 'https://schema.org'
```

---

## 3. Rollback Procedure

If any unexpected issue occurs after deployment:

### Fast Rollback via Git
```bash
# 1. Identify previous working commit
git log -n 5 --oneline

# 2. Revert to previous commit (e.g., commit hash)
git checkout <PREVIOUS_COMMIT_HASH>

# 3. Rebuild and restart frontend container
docker compose build frontend
docker compose up -d --no-deps frontend
```
The previous frontend image will be restored immediately without impacting the database or backend.
