# Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| RK-1 | UI shows success while the change is not persisted or not reflected (see `audit/2026-11-05-frontend-backend-persistence-audit.md`) | Owner and user trust | PARTIALLY FIXED in PS-1 (F-5) & PS-2 (F-1..F-4: teacher directory in `/`, instant `is_public` switches with badges/links, cache-busting `&v=` query hashes, logo file upload + `refreshSession`); remaining F-6..F-16 in PS-3..PS-6 |
| RK-2 | The "create tenant" form on the platform console defaults the owner password to `password123` when left empty | Account takeover | CLOSED in PS-1 (2026-11-05): owner password required (min: 8), real owner-name field, no default password, tested in PlatformTenantProvisioningSecurityTest |
| RK-3 | QR scanner has no camera decoding on iOS Safari or Firefox | Manual entry only on iPhone | P6 (OD-29 approved) |
| RK-4 | Tenant `type` holds free-form values | Wrong behaviour per tenant type | P1 |
| RK-6 | Super admin reads students' personal data (OD-28) | Privacy / Saudi PDPL compliance | ADR-005: role-limited, every read audited, privacy notice |
| RK-7 | Moving payment review from tenant to platform (OD-27) changes the R3 flow and existing tests | Regressions in billing | ADR-004 + migration of pending requests + update `ContentAccessPolicyTest` |
| RK-8 | WhatsApp messages cost money and need approved templates | Cost / delivery | Per-event channel settings, queue + retry, `log` channel until credentials exist |
| RK-5 | Many PARTIAL tasks without E2E | Regressions | R9-1 |
