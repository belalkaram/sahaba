# ADR-007 — Tenant landing page: five templates, four-colour theme, fixed "Powered by Sahaba"

**Status:** Accepted (owner, 2026-11-13)
**Date:** 2026-11-12
**Related:** Master Specification §7 (White-Label per Tenant), Quality Gate §11, `UI-UX-REDESIGN-PLAN.md` §2.3, `LANDING-REDESIGN-PLAN.md` §5.2 (L5 PARTIAL), OD-22, OD-24, OD-36, OD-40; plan `docs/design/TENANT-LANDING-THEMES-PLAN.md`

## Context

Every academy and independent teacher has public pages at `/a/{slug}`. Today they are client-rendered, use the
platform's own emerald gradient, and ignore the tenant's `primary_color`. The owner wants each tenant to pick one of
**five ready templates** (different shapes, icons, cards and motion) and **four colours** that restyle the whole page,
while a **"مدعوم بمنصة سحابة"** line stays on every page for the platform's rights.

What exists: `tenants.primary_color/secondary_color/logo_url/brand_tagline`, a `brand_settings` JSON that has become a
grab bag (attendance thresholds live in it), a single `--brand-primary` override inside the workspace with a silent
fallback (`lib/brand-color.ts`), a `tenant.branding` permission defined in the catalog but used by no route, and
`GET /public/academy/profile` that deliberately returns marketing fields only.

## Decision

1. **Scope (OD-42).** Phase 1 themes the public academy pages (`/a/{slug}` and children) and the tenant login page
   only. The workspace keeps its single-colour behaviour; full in-app theming is a later ADR.
2. **Four colours, derived tokens (OD-41).** The tenant stores `palette = {primary, secondary, accent, surface}`
   (hex `#RRGGBB` only). One pure function, `deriveTenantTheme(palette)`, produces the full semantic token set for
   light and dark (OKLCH lightness offsets, dark mode derived, not inverted) and **enforces WCAG AA** for every
   text/background pair by nudging lightness; pairs that cannot be fixed fall back to platform defaults and surface a
   warning in the editor. Tokens use the existing names from `globals.css`, scoped under `[data-tenant-theme]`, and are
   injected server-side as an inline `<style>` so there is no flash. Semantic status colours (`success/warning/
   danger/info`) are never tenant-controlled.
3. **Five templates as manifests.** `oasis` (current design, default), `beacon`, `breeze`, `atlas`, `horizon`. A
   template is a declared `TemplateManifest` (radius, decorative shape, icon style, card style, header, hero, motion)
   plus section components under `features/tenant-landing/templates/<id>/`. Templates change form only; data,
   section order rules, login/registration CTAs and the footer line are shared and not overridable.
4. **No custom CSS/JS/fonts (OD-45).** Customisation = template + palette + section toggles + plain-text content.
5. **Attribution (OD-46).** `PoweredByFooter` ("مدعوم بمنصة سحابة" linking to `/`) is rendered by the server layout
   outside any template, on every public academy page and the login page. Its presence is asserted by a Feature test
   (no API field can disable it) and by Playwright on the server HTML of all five templates.
6. **Storage.** New control-DB table `tenant_landing_settings(tenant_id unique, published json, draft json, version,
   published_at, published_by, preview_token_hash, preview_expires_at)`. `brand_settings` is not extended. On first
   publish `palette.primary` is copied into `tenants.primary_color` so the workspace stays consistent.
7. **API.** Admin routes under `tenant` + `tenant.auth` + `tenant.can:tenant.branding`:
   `GET /tenant/landing`, `PUT /tenant/landing/draft`, `POST /tenant/landing/publish`, `DELETE /tenant/landing/draft`,
   `POST /tenant/landing/preview-token`, `POST|DELETE /tenant/landing/cover`. Public: `GET /public/academy/profile`
   gains `landing` (published only; unpublished contact fields dropped); `?preview=<token>` returns the draft while the
   token is valid, otherwise the published version with no error that reveals anything. `GET /public/academy/cover`.
   `tenant.branding` is granted to `owner` and `center_admin` (OD-44). Every publish writes an audit entry.
8. **Rendering.** `app/a/[slug]/layout.tsx` becomes a Server Component with ISR and a per-tenant cache tag; publish
   triggers revalidation through a server-to-server secret. Child pages stay client components reading a thin provider.
9. **Content (OD-43).** New opt-in public content: cover image, about text + 3 highlights, contact fields each with its
   own publish switch (default off), FAQ (≤ 8). Plain text only, `https://` links only, E.164 phones.

## Alternatives considered

- **Extend `brand_settings` JSON** — rejected: it is returned whole by `/tenant/current`, mixes operational settings,
  and has no draft/publish/version.
- **Let tenants upload CSS or choose arbitrary fonts** — rejected: injection surface, broken RTL/contrast, unbounded
  QA matrix.
- **Eight colours (light + dark chosen by the owner)** — rejected: owners will not maintain two palettes; derived dark
  mode with AA enforcement is predictable and testable.
- **One template with many knobs** — rejected: the owner asked for recognisably different looks; manifests keep each
  template small while sharing all primitives.
- **Client-side theming on the current client layout** — rejected: unavoidable colour flash and no server HTML for the
  attribution test.

## Consequences

- Migration: one additive table; no existing column changes; no data transformation.
- Security: new authenticated routes all permission- and tenant-gated; public endpoint stays marketing-only; preview
  tokens are hashed and short-lived; uploads reuse `ProfileImageService` limits.
- Frontend: `/a/[slug]` layout moves to the server (same pattern as LANDING-V2 L0); existing `features/public-academy`
  components become the `oasis` template; new `features/tenant-landing/*` and `/admin/landing`.
- Tests that must exist: `TenantLandingSettingsTest` (allowed, forbidden, wrong role, cross-tenant, validation, public
  exposure, preview token), `derive-tenant-theme.test.ts` (AA for presets + seeded random palettes, deterministic CSS),
  Playwright matrix 5 templates × light/dark × 390/1440 with axe and the attribution check, editor E2E.
- Documentation: `openapi.yaml`, tracker rows TL-0..TL-7, coverage matrix, changelog, report
  `docs/recovery-reports/TENANT-LANDING.md`.

## Implementation tasks

TL-0 (this ADR + decisions) → TL-1 backend → TL-2 theme engine + server layout → TL-3 template system + `oasis` +
fixed footer → TL-4 remaining four templates → TL-5 editor → TL-6 content sections → TL-7 verification.
Details and acceptance thresholds: `docs/design/TENANT-LANDING-THEMES-PLAN.md` §2, §9.
