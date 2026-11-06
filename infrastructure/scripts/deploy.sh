#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Multi-Tenant LMS Deployment Script
# Zero-downtime deployment via Docker Compose rolling update
# Usage: ./deploy.sh [--tag <image_tag>] [--env <env_file>]
# =============================================================================
set -euo pipefail

# ── Arguments ─────────────────────────────────────────────────────────────────
IMAGE_TAG="${IMAGE_TAG:-latest}"
ENV_FILE="${ENV_FILE:-.env}"
COMPOSE_FILE="infrastructure/docker-compose.yml"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
error(){ echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }
step() { echo ""; echo "══════════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════════"; }

cd "$REPO_ROOT"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
step "Pre-flight checks"

if [ ! -f "$ENV_FILE" ]; then
    error "Environment file not found: $ENV_FILE"
    error "Copy infrastructure/.env.production.example to .env and fill in secrets."
    exit 1
fi

# Validate critical secrets are set
source "$ENV_FILE"
REQUIRED_VARS=(APP_KEY DB_URL REDIS_PASSWORD BACKUP_ENCRYPTION_KEY)
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR:-}" ]; then
        error "Required secret not set: $VAR"
        exit 1
    fi
done

log "All required secrets present"
log "Docker version: $(docker --version)"
log "Compose version: $(docker compose version)"

# ── 1. Pull / build images ───────────────────────────────────────────────────
step "Building production images"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache api web
log "Images built"

# ── 2. Run database migrations ────────────────────────────────────────────────
step "Running database migrations"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm api php artisan migrate --force --no-interaction
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm api php artisan lms:migrate-tenants
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm api php artisan lms:db:check
log "Migrations complete"

# ── 3. Warm application cache ─────────────────────────────────────────────────
step "Warming application cache"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm api php artisan config:cache
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm api php artisan route:cache
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    run --rm api php artisan view:cache
log "Application cache warmed"

# ── 4. Deploy with zero-downtime rolling update ───────────────────────────────
step "Deploying services (rolling)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
log "All services started"

# ── 5. Health verification ────────────────────────────────────────────────────
step "Health verification"
MAX_RETRIES=12
RETRY_INTERVAL=10
HEALTH_URL="http://localhost/api/v1/health"

log "Waiting for API health check (up to $((MAX_RETRIES * RETRY_INTERVAL))s)..."
for i in $(seq 1 $MAX_RETRIES); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        log "Health check passed (attempt $i)"
        break
    fi
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        error "Health check failed after $MAX_RETRIES attempts (last status: $HTTP_STATUS)"
        error "Rolling back..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
        exit 1
    fi
    log "Attempt $i — status $HTTP_STATUS — retrying in ${RETRY_INTERVAL}s..."
    sleep $RETRY_INTERVAL
done

# ── 6. Summary ────────────────────────────────────────────────────────────────
step "Deployment complete"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
log "Deployment successful — image: $IMAGE_TAG"
