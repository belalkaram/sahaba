# Production Runbook — Multi-Tenant LMS Platform

**Status:** M13 Production Hardening — IMPLEMENTED  
**Audience:** DevOps, Platform Engineers, On-call Responders  
**Last Updated:** 2026-09-30

---

## Table of Contents

1. [Stack Overview](#stack-overview)
2. [Deployment](#deployment)
3. [Health Monitoring](#health-monitoring)
4. [Backup & Restore](#backup--restore)
5. [Tenant Management](#tenant-management)
6. [Incident Response](#incident-response)
7. [Rollback Procedure](#rollback-procedure)
8. [Secrets Rotation](#secrets-rotation)
9. [Scaling](#scaling)
10. [Log Access](#log-access)

---

## 1. Stack Overview

```
Internet → Nginx (TLS termination, rate limiting)
              ├── /api/*  → PHP-FPM (Laravel 13 — apps/api)
              └── /*      → Next.js 16 (apps/web)

Laravel → MySQL 8.4 (control plane DB + per-tenant DBs)
Laravel → Redis 7.4 (cache, sessions, queues)
Laravel → Queue Worker (report generation, async jobs)
```

**Container names:**
| Container    | Role                     |
|-------------|--------------------------|
| `lms_nginx` | Reverse proxy / TLS      |
| `lms_api`   | PHP-FPM application      |
| `lms_worker`| Queue worker             |
| `lms_web`   | Next.js frontend         |
| `lms_mysql` | MySQL 8.4 database       |
| `lms_redis` | Redis 7.4 cache/queue    |

---

## 2. Deployment

### First-time Setup

```bash
# 1. Clone repository
git clone <repo_url> /opt/lms
cd /opt/lms

# 2. Configure secrets
cp infrastructure/.env.production.example .env
nano .env   # Fill in ALL required secrets

# 3. Create TLS cert directory (mount real certs here)
mkdir -p infrastructure/certs
# Place fullchain.pem and privkey.pem from Let's Encrypt or your CA

# 4. Deploy
bash infrastructure/scripts/deploy.sh
```

### Standard Deployment (CI/CD)

```bash
# Triggered automatically by push to main/master via GitHub Actions
# Manual trigger:
IMAGE_TAG=abc1234 bash infrastructure/scripts/deploy.sh
```

### Post-deployment Verification

```bash
# API health
curl -s https://yourdomain.com/api/v1/health | jq .

# Detailed health report
docker exec lms_api php artisan lms:health-report

# Tenant audit
docker exec lms_api php artisan lms:tenant-audit
```

---

## 3. Health Monitoring

### Health Endpoint (external probe)

```
GET /api/v1/health
```

**Expected response (200):**
```json
{
  "data": {
    "status": "healthy",
    "services": { "database": "ok", "cache": "ok" },
    "version": "1.0.0",
    "environment": "production"
  }
}
```

**Alert threshold:** Non-200 for >30 seconds → PagerDuty/alert.

### Internal Health Report (Artisan)

```bash
# Human-readable table
docker exec lms_api php artisan lms:health-report

# JSON for monitoring agent
docker exec lms_api php artisan lms:health-report --json
```

Checks:
- `control_database` — MySQL connectivity + tenant count
- `cache` — Redis read/write roundtrip
- `queue_depth` — Pending and failed job count
- `tenant_count` — Active vs total tenants
- `config_invariants` — APP_DEBUG, APP_KEY, SESSION_DRIVER

### Cron Health Check Schedule

Add to server crontab:
```cron
*/5 * * * * docker exec lms_api php artisan lms:health-report --json >> /var/log/lms/health.log 2>&1
0 2 * * *   bash /opt/lms/infrastructure/scripts/backup.sh >> /var/log/lms/backup.log 2>&1
```

---

## 4. Backup & Restore

### Automatic Backup

Runs daily at 02:00 via cron. Backs up:
- Control plane DB (`lms_control`)
- All tenant databases (`tenant_*`)
- Redis snapshot
- Creates encrypted manifest

**Encryption:** AES-256-CBC with PBKDF2 key derivation.  
**Retention:** 30 days (configurable via `BACKUP_RETENTION_DAYS`).

### Manual Backup

```bash
BACKUP_STORAGE_PATH=/var/backups/lms \
BACKUP_ENCRYPTION_KEY="$(grep BACKUP_ENCRYPTION_KEY .env | cut -d= -f2)" \
DB_PASSWORD="$(grep DB_PASSWORD .env | cut -d= -f2)" \
MYSQL_ROOT_PASSWORD="$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2)" \
bash infrastructure/scripts/backup.sh
```

### Restore from Backup

```bash
# List available backups
ls /var/backups/lms/

# Dry run (no data changed)
bash infrastructure/scripts/restore.sh 20261015_020000 --dry-run

# Actual restore (requires confirmation)
bash infrastructure/scripts/restore.sh 20261015_020000
```

> [!CAUTION]
> Restore overwrites existing databases. Always dry-run first and ensure the application is in maintenance mode.

### Maintenance Mode

```bash
# Enable maintenance mode
docker exec lms_api php artisan down --render="errors::503" --retry=60

# Disable maintenance mode
docker exec lms_api php artisan up
```

---

## 5. Tenant Management

### View all tenants

```bash
docker exec lms_api php artisan lms:tenant-audit
```

### Provision a new tenant

```bash
docker exec lms_api php artisan tenant:provision \
  --name="School Name" \
  --slug="school-slug" \
  --domain="school.yourdomain.com"
```

### Run tenant migrations

```bash
# All tenants
docker exec lms_api php artisan tenant:migrate --all

# Specific tenant
docker exec lms_api php artisan tenant:migrate --tenant=school-slug
```

---

## 6. Incident Response

### API is returning 502 Bad Gateway

```bash
# 1. Check API container
docker ps | grep lms_api
docker logs lms_api --tail=50

# 2. Restart API
docker compose -f infrastructure/docker-compose.yml restart api

# 3. Check PHP-FPM health
docker exec lms_api php-fpm -t
```

### Database connectivity lost

```bash
# 1. Check MySQL container
docker ps | grep lms_mysql
docker logs lms_mysql --tail=20

# 2. Test connection
docker exec lms_mysql mysqladmin ping -h localhost -u root --password="$MYSQL_ROOT_PASSWORD"

# 3. Restart MySQL (last resort — will cause brief downtime)
docker compose -f infrastructure/docker-compose.yml restart mysql
```

### Redis down / cache miss storm

```bash
# 1. Check Redis
docker logs lms_redis --tail=20
docker exec lms_redis redis-cli -a "$REDIS_PASSWORD" ping

# 2. Flush rate-limit counters if needed (not cache)
docker exec lms_redis redis-cli -a "$REDIS_PASSWORD" FLUSHDB
```

### Background processes (R8)

Reports, notification emails and analytics run on the queue. Without a worker, reports stay in `queued` and emails are not sent.

```bash
php artisan queue:work      # worker (lms_worker in Docker)
php artisan schedule:work   # scheduler (lms_scheduler in Docker)
```

Scheduled commands: `lms:notify-scheduled` (hourly), `lms:compute-analytics` (02:00 daily), `lms:refresh-platform-metrics` (hourly).

On every deploy, migrate the Control DB **and** all tenant databases:

```bash
php artisan migrate --force
php artisan lms:migrate-tenants
```

Email uses `MAIL_MAILER` (`log` until SMTP credentials are configured). Queue backlog and failed jobs appear on the platform dashboard.

### Queue worker crashed

```bash
# 1. Check worker
docker ps | grep lms_worker
docker logs lms_worker --tail=30

# 2. List failed jobs
docker exec lms_api php artisan queue:failed

# 3. Retry all failed jobs
docker exec lms_api php artisan queue:retry all

# 4. Restart worker
docker compose -f infrastructure/docker-compose.yml restart worker
```

---

## 7. Rollback Procedure

```bash
# 1. Pull previous image tag
IMAGE_TAG=<previous_sha> bash infrastructure/scripts/deploy.sh

# OR roll back via Docker:
docker compose -f infrastructure/docker-compose.yml \
  up -d --no-build \
  --scale api=0 --scale web=0

docker tag ghcr.io/<org>/lms/api:<previous_sha> ghcr.io/<org>/lms/api:latest
docker tag ghcr.io/<org>/lms/web:<previous_sha> ghcr.io/<org>/lms/web:latest

docker compose -f infrastructure/docker-compose.yml up -d

# 2. If DB migration needs rollback
docker exec lms_api php artisan migrate:rollback --step=1
```

---

## 8. Secrets Rotation

| Secret | How to Rotate |
|--------|--------------|
| `APP_KEY` | `php artisan key:generate --show` → update .env → `config:clear` |
| `DB_PASSWORD` | Update MySQL + .env + restart api, worker |
| `REDIS_PASSWORD` | Update Redis config + .env + restart api, worker |
| `BACKUP_ENCRYPTION_KEY` | Rotate on a scheduled basis; re-encrypt old backups |
| Webhook secrets | Update in .env + provider dashboard simultaneously |

> [!WARNING]
> Rotating `APP_KEY` invalidates all encrypted values (sessions, encrypted fields). Schedule maintenance window.

---

## 9. Scaling

### Horizontal API scaling

```bash
# Scale API workers (PHP-FPM containers)
docker compose -f infrastructure/docker-compose.yml up -d --scale api=3

# Scale queue workers
docker compose -f infrastructure/docker-compose.yml up -d --scale worker=2
```

### MySQL read replicas

Add replica configuration in `infrastructure/docker-compose.yml` and configure Laravel's `read/write` connection splitting in `config/database.php`.

---

## 10. Log Access

```bash
# API application logs (stderr → Docker JSON log)
docker logs lms_api --follow

# Nginx access logs
docker logs lms_nginx --follow

# MySQL slow query log
docker exec lms_mysql tail -f /var/log/mysql/slow.log

# All containers at once
docker compose -f infrastructure/docker-compose.yml logs -f --tail=50
```

**Log rotation:** All containers use `json-file` driver with:
- `lms_api` / `lms_worker`: 50MB × 10 files
- `lms_nginx`: 10MB × 5 files
- `lms_web` / `lms_mysql`: 20MB × 5 files

---

## Contacts

| Role | Contact |
|------|---------|
| Platform Lead | — |
| On-call | — |
| DBA | — |

---

*This runbook is part of M13 Production Hardening and must be kept up to date with every architectural change.*
