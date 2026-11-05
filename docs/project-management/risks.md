# Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| RK-1 | UI shows success while the change is not persisted or not reflected (see `audit/2026-11-05-frontend-backend-persistence-audit.md`) | Owner and user trust | Plan phase PS |
| RK-2 | The "create tenant" form on the platform console defaults the owner password to `password123` when left empty | Account takeover | PS-1 (fix first) |
| RK-3 | QR scanner has no camera decoding on iOS Safari or Firefox | Manual entry only on iPhone | P6 (OD-29 approved) |
| RK-4 | Tenant `type` holds free-form values | Wrong behaviour per tenant type | P1 |
| RK-5 | Many PARTIAL tasks without E2E | Regressions | R9-1 |
