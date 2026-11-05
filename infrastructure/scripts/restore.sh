#!/usr/bin/env bash
# =============================================================================
# restore.sh — Multi-Tenant LMS Restore Script
# Restores a specific timestamped backup set
# Usage: ./restore.sh <TIMESTAMP> [--dry-run]
# Example: ./restore.sh 20261015_020000
# =============================================================================
set -euo pipefail

TIMESTAMP="${1:?Usage: ./restore.sh <TIMESTAMP> [--dry-run]}"
DRY_RUN="${2:-}"
BACKUP_DIR="${BACKUP_STORAGE_PATH:-/var/backups/lms}"
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
DB_URL="${DB_URL:?DB_URL is required}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Validate backup set ───────────────────────────────────────────────────────
if [ ! -d "$BACKUP_PATH" ]; then
    echo "ERROR: Backup not found: $BACKUP_PATH"
    exit 1
fi

if [ ! -f "$BACKUP_PATH/manifest.json" ]; then
    echo "ERROR: manifest.json missing in $BACKUP_PATH"
    exit 1
fi

log "Restoring backup: $TIMESTAMP"
cat "$BACKUP_PATH/manifest.json"

if [ "$DRY_RUN" = "--dry-run" ]; then
    log "DRY RUN — listing encrypted files that would be restored:"
    ls -lh "$BACKUP_PATH/"*.enc 2>/dev/null || log "No encrypted files found"
    log "DRY RUN complete — no data was changed"
    exit 0
fi

# ── Confirmation ─────────────────────────────────────────────────────────────
read -r -p "WARNING: This will overwrite existing databases. Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled"
    exit 1
fi

# ── Restore database (control plane + all tenant schemas) ─────────────────────
DUMP_ENC="$BACKUP_PATH/database.dump.enc"
if [ ! -f "$DUMP_ENC" ]; then
    echo "ERROR: $DUMP_ENC not found"
    exit 1
fi
log "Restoring database with pg_restore (--clean --if-exists)..."
openssl enc -d -aes-256-cbc -pbkdf2 -k "$ENCRYPTION_KEY" -in "$DUMP_ENC" \
    | pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$DB_URL"
log "Restore finished. Verify with:  php artisan lms:db:check"
