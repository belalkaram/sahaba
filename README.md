# LMS AI-Ready Project — Complete Recovered Package

This package was rebuilt from the shared ChatGPT conversation, including the hidden embedded conversation data that is not exposed in the visible page text.

## Start here

1. Read `AGENTS.md` and `CLAUDE.md`.
2. The project is in the **Recovery Program**: rules in `prompts/recovery/02-OPERATING-RULES.md`, decisions in `prompts/recovery/01-DECISIONS.md`, status in `prompts/recovery/03-PROGRESS-TRACKER.md`.
3. Evidence per phase: `docs/recovery-reports/`. Specification: `docs/master/MASTER-SPECIFICATION.md`.

### Running locally

```bash
# API (apps/api)
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --force && php artisan lms:migrate-tenants && php artisan db:seed
php artisan serve
php artisan queue:work      # reports, emails, analytics
php artisan schedule:work   # scheduled notifications and metrics

# Web (apps/web)
npm ci && npm run dev
```

### Checks

```bash
node scripts/release-gate.mjs                  # all gates, writes docs/project-management/release-evidence.json
cd apps/web && npx playwright test             # E2E + accessibility (API and web must be running)
```

## Completeness

The package contains 71 original bootstrap files plus the recovered detailed phase/requirements/source files. The full recovered payload is preserved under `source/`.
