# R5 — Attendance & Secure QR

> **بالعربي:** QR آمن قصير العمر للطالب، ماسح كاميرا للموبايل، تحقق كامل قبل تسجيل الحضور، تصحيح بسجل، وشاشات الفروع والفصول والجلسات.
> **Closes:** T-SEC-10, T-FEAT-13, 14, 15 (UI), 16, C-08 (QR part)
> **Depends on:** R2 (branches API, assignments). **Decisions:** OD-4. **Spec:** Master §20, §30-32, FR-OFFLINE-001..008, FR-CRED-004.

## Tasks

### R5-1 — Student QR token
- `GET /me/attendance-qr` (student) ⇒ `{ token, expires_at }`. Token = signed opaque payload (HMAC with app key + tenant id; contains student id, nonce, `exp` ≤ 60s). Never contains the student code or secret credential data.
- Optionally bound to the active credential/device: if tenant uses coupons, include credential id and reject if revoked.
- Tests: valid token; expired; tampered; other tenant's token.

### R5-2 — Scan endpoint with full validation
- Replace `POST /sessions/{id}/attendance/scan` body with `{ token }` (keep the old `qr_data` path behind a tenant setting `allow_static_student_code_scan` default **false**, for barcode cards — document).
- Validation order (FR-OFFLINE-008): tenant ⇒ token signature/expiry ⇒ student active ⇒ session exists and status `scheduled|in_progress` and now within `[starts_at - grace, ends_at + grace]` (tenant setting) ⇒ student belongs to the session's class ⇒ scanner has `attendance.scan` with scope over the class ⇒ record.
- Deterministic duplicates: second scan returns `200 { already_recorded: true, record }`.
- Audit each scan. Return a compact payload for fast UI (student name, photo initial, status).
- Tests for every rejection branch.

### R5-3 — (Deferred by OD-4) Session QR
- Do not implement. Mark tracker as DEFERRED with reference to OD-4.

### R5-4 — Corrections & modes
- `PUT /attendance-records/{id}` with `{status, reason}` — `attendance.correct`, scoped; keeps history table `attendance_record_changes` (old, new, by, reason, at).
- Session `attendance_mode` respected (`manual`, `qr`, `both`); tenant default mode setting; FR-OFFLINE-005 open/scheduled/session-based: implement `open` (no time window) and `scheduled` (window enforced) as a session flag.
- Session lifecycle endpoints: `POST /sessions/{id}/start|end|cancel`.

### R5-5 — Student "My Card"
- `/student/card`: large QR auto-refreshing before expiry (countdown ring), student name/code, tenant branding, brightness hint; works offline only for display of a fresh token (no caching tokens in SW — PWA security).

### R5-6 — Mobile scanner (staff)
- `/staff/attendance/scan/[sessionId]`: full-screen camera scanner (use a maintained library, e.g. `@zxing/browser` or native `BarcodeDetector` with fallback — record choice), front/back camera switch, torch if supported, haptic + sound feedback, result toast (success / already / rejected with reason), running counter present/total, manual search fallback, offline queue (IndexedDB) that syncs when online with server re-validation (server is authoritative; show conflicts).
- Works at 360px width; large touch targets.

### R5-7 — Offline structure screens
- `/admin/branches` (from R2) linked to classrooms.
- `/staff/classes`, `/staff/classes/[id]` (students, sessions, attendance rate, add/remove students, assign assistant), `/staff/sessions` (calendar/week view of my sessions), `/staff/sessions/[id]` (live roster: present/absent/late/excused, manual marking, corrections with reason, start/end session, open scanner).
- Student `/student/attendance`: per-class history with stats; parent sees children's attendance (R7D).

## Acceptance criteria (E2E + API)

- [ ] Assistant scans a valid student QR on a phone-sized viewport ⇒ recorded; repeat ⇒ "مسجل مسبقًا".
- [ ] Expired/tampered/other-class/other-tenant/closed-session QR ⇒ rejected with specific Arabic reason.
- [ ] Static `student_code` scan rejected by default.
- [ ] Correction requires reason and appears in history.
- [ ] Teacher can create class, add students, schedule session, run attendance end-to-end.
- [ ] All standard commands pass.
