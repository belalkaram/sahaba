# ADR-008 — Tenant Google connection and Google Drive media

**Status:** Accepted
**Date:** 2026-11-17
**Related:** T-FEAT-06, T-FEAT-07, T-FEAT-08, C-08 (Drive part); OD-3, OD-5; tracker R4-3 (and R8-6, which reuses the connection); Master §22, §27

## Context

Before this ADR, `GoogleDriveVideoProvider` only parsed a pasted Drive link: no Google API call, no upload, no way to know whether a
file exists, and the meeting provider refused real Google Meet creation. OD-3 chose one Google connection **per tenant**, authorised
by the tenant owner, with uploads going into a tenant folder; OD-5 chose Calendar events with `conferenceData` on the same
connection. The owner provided a Google Cloud project on 2026-11-17 (`lms-platform-515016`, web OAuth client, External consent
screen in Testing, Drive API and Calendar API enabled).

## Decision

### Connection

- Tenant table `integration_connections` (one row per provider, `provider = 'google'`): `account_email`, `access_token` and
  `refresh_token` (Laravel `encrypted` casts, never serialised), `token_expires_at`, `scopes`, `status`
  (`connected | error`), `drive_folder_id`, `connected_by`, `connected_at`, `last_error`. It lives in the tenant database, so no
  tenant id column is needed and no cross-tenant read is possible through it.
- Scopes, requested once with `access_type=offline` and `prompt=consent`:
  `openid`, `email`, `https://www.googleapis.com/auth/drive.file`, `https://www.googleapis.com/auth/calendar.events`.
  `drive.file` is non-sensitive (no Google security assessment) and only exposes files the app created or the user opened with it.
  Calendar is requested now so R8-6 does not need a second consent (owner decision, 2026-11-17).
- Flow: `GET /integrations/google/connect` (permission `tenant.settings`) returns the Google URL. The `state` is 40 random
  characters stored in the cache for 10 minutes with the tenant id and user id, and is single-use (`Cache::pull`). Google calls
  `GET /integrations/google/callback` (public: Google sends no tenant header or bearer token). The callback resolves the tenant only
  from the state, exchanges the code, reads the account email, stores the tokens and redirects the browser to
  `WEB_APP_URL/admin/integrations?google=connected|error`. Error codes in that redirect are fixed words; no Google text and no
  tokens appear in URLs.
- `GET /integrations/google` returns the status (`connected`, email, scopes, connected_at). `DELETE /integrations/google` revokes
  the token at Google (best effort) and deletes the row. Connect, callback success and disconnect write audit entries.
- Access tokens are refreshed when they expire within 60 seconds. If Google answers `invalid_grant`, the row is set to `error`
  and callers get `GOOGLE_NOT_CONNECTED` until the owner reconnects.
- HTTP calls use Laravel's HTTP client (no `google/apiclient`): the two APIs used are small REST calls, the SDK is very large, and
  `Http::fake()` lets tests mock Google at the HTTP layer as the phase requires. Everything stays behind
  `GoogleOAuthClient`, `GoogleDriveClient` and `VideoProviderInterface`.

### Drive upload (large files go browser ⇒ Google directly)

1. `POST /media/uploads` (permission `media.upload`): title, file name, `video/*` MIME type, size (≤ 5 GB), optional course and
   lesson. The server makes sure the tenant folder exists (created once, named after the tenant, id stored on the connection),
   opens a Drive **resumable session** with the browser's `Origin` (needed for CORS), stores a `media_uploads` row (session URL
   encrypted) and returns `{upload_id, upload_url}`. The session URL is returned only to that uploader.
2. The browser `PUT`s the file to `upload_url`.
3. `POST /media/uploads/{id}/complete` (same uploader): the server asks Google for the session status itself
   (`Content-Range: bytes */<size>`), so the client cannot substitute another file id. It then reads the file, checks it is in
   the tenant folder and is a video, sets sharing, creates the `MediaAsset` (`metadata.verification = verified`) and marks the
   upload completed.

### Sharing

The Drive `/preview` iframe only plays for viewers who can read the file, and students do not sign in to Google. Uploaded files
are therefore shared **"anyone with the link — reader"**. The link is protected by the platform, not by Google: it is returned only
by `GET /media/{id}/embed` after the content access policy, and `embed_url` / `playback_url` are removed from media listings and
details for users without `media.upload`. Residual risk: a student who has access can copy the link and share it. Domain-restricted
sharing is not possible for personal Google accounts and would break playback for students; a signed proxy stream is out of scope.

### Pasted links (secondary option)

The link must contain a well-formed Drive file id, otherwise it is rejected (422). If the tenant is connected and Google returns the
file, it is checked (not trashed, `video/*` for video media) and saved as `verified`. If the file is not visible to the app (normal
under `drive.file`) or the tenant is not connected, the link is accepted and saved as `unverified`, shown as such to staff
(owner decision, 2026-11-17). No ids are generated by the server.

### Failure modes

| Situation | Result |
|---|---|
| Not connected / token revoked | `409 GOOGLE_NOT_CONNECTED` for uploads; pasted links saved as `unverified` |
| Google 5xx / timeout | `502 PROVIDER_ERROR` / `504 PROVIDER_TIMEOUT`; nothing saved |
| Upload not finished at `complete` | `409 UPLOAD_INCOMPLETE`; can be retried |
| File outside tenant folder or not a video | `422`; no asset |
| Bad or reused OAuth state | redirect with `google=error&reason=state` |

## Alternatives considered

- **Platform-wide service account** (OD-3 alternative): one Google account holding every tenant's content; rejected in OD-3.
- **`drive.readonly` / `drive` scope**: would validate any pasted link but is a restricted scope requiring Google's security
  assessment before production; rejected for now.
- **`google/apiclient` SDK**: heavier, harder to fake; the REST surface used is small.
- **Upload through the API server**: doubles bandwidth and hits PHP upload limits for long videos.

## Consequences

- Migration: two new tenant tables; no change to existing rows. Existing pasted assets have no `verification` key and are treated
  as `unverified`.
- Security: tokens encrypted with `APP_KEY` (rotating it requires reconnecting Google); state single-use and short-lived; callback
  never trusts a tenant header; secrets never in URLs or logs.
- Production: the consent screen is in **Testing** (only listed test users can connect) and the redirect URI is localhost.
  Production needs its own redirect URI and Google app verification (sensitive Calendar scope).
- Frontend: `/admin/integrations` shows the real connection state with connect/disconnect; the media page offers direct upload when
  connected and shows the verification state.
- Tests: `GoogleDriveConnectionTest` covers connect/callback/state reuse/disconnect/permissions, upload start/complete, folder
  check, pasted link verified/unverified/invalid, and hidden embed URLs, with Google mocked via `Http::fake()`.

## Implementation tasks

R4-3 (this ADR). R8-6 will add Calendar event creation on the same connection.
