#!/usr/bin/env bash
# =============================================================================
# backup.sh — Multi-Tenant LMS Backup Script
# Backs up: the Postgres database (control plane + every tenant schema), Redis snapshot
# Encrypts with AES-256 before writing to backup storage
# Schedule: cron daily at 02:00
# =============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_STORAGE_PATH:-/var/backups/lms}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
# Provider-agnostic: one connection string (Neon, RDS, self-hosted ...). Use the DIRECT endpoint.
DB_URL="${DB_URL:?DB_URL is required (postgresql://user:pass@host/db?sslmode=require)}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_PATH"
log "Backup started — target: $BACKUP_PATH"

# ── 1. Whole database (control plane in `public` + one schema per tenant) ─────
# A single pg_dump is one consistent snapshot across all tenants.
log "Dumping database with pg_dump"
pg_dump --format=custom --no-owner --no-privileges "$DB_URL" \
    | openssl enc -aes-256-cbc -salt -pbkdf2 \
        -k "$ENCRYPTION_KEY" \
        -out "$BACKUP_PATH/database.dump.enc"
log "Database backup complete"

TENANT_COUNT=$(psql "$DB_URL" -At -c "SELECT count(*) FROM information_schema.schemata WHERE schema_name LIKE 'tenant\_%'")

# ── 3. Redis snapshot ────────────────────────────────────────────────────────
log "Triggering Redis BGSAVE..."
redis-cli -h "${REDIS_HOST:-redis}" -a "${REDIS_PASSWORD}" BGSAVE > /dev/null 2>&1 || true
sleep 5
if [ -f "/data/dump.rdb" ]; then
    cp /data/dump.rdb "$BACKUP_PATH/redis.rdb"
    log "Redis snapshot copied"
else
    log "WARN: Redis dump.rdb not found — skipping"
fi

# ── 4. Manifest ──────────────────────────────────────────────────────────────
cat > "$BACKUP_PATH/manifest.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "engine": "postgresql",
  "tenant_count": $TENANT_COUNT,
  "retention_days": $RETENTION_DAYS,
  "encryption": "AES-256-CBC-PBKDF2",
  "version": "2.0"
}
EOF

log "Manifest written"

# ── 5. Prune old backups ─────────────────────────────────────────────────────
log "Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true
log "Pruning complete"

log "Backup finished successfully — $BACKUP_PATH"
