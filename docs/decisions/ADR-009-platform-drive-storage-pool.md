# ADR-009 — Platform Google Drive storage pool, resumable uploads and media workers

**Status:** Accepted (owner request, 2026-11-19)
**Date:** 2026-11-19
**Related:** ADR-008 (tenant Google connection, which this extends); R4-3; new tracker rows R4-3a, R4-3b, R4-3c

## Context

ADR-008 stores videos in the Drive of the Google account each academy connects. The owner wants the platform
itself to provide video storage. The super admin adds several Google accounts (Google One or any other plan; the
first one has about 5 TB), and the platform spreads uploads across them:

- Free space is checked before every upload.
- When the account currently in use cannot hold the file, the next account is used.
- An interrupted upload continues from where it stopped.
- Slow Google work moves to background workers.

## Problem

1. Tokens owned by the platform cannot live in a tenant database. A tenant must never read the credentials of an
   account that also holds other tenants' files.
2. Several uploads can start at once. Each one could see the same free space and together overfill an account.
3. The `complete` request did 3 to 4 Google calls synchronously, and the browser could not resume a dropped upload.

## Options

- **A. Keep tenant-only storage (ADR-008).** Rejected: the owner wants central storage and capacity.
- **B. One shared Drive folder per teacher, filled through the Drive web UI.** Rejected:
  - With `drive.file` the app cannot see files it did not create.
  - Each file stays owned by the teacher and counts against the teacher's own quota.
  - Every teacher needs a Google account and editor rights on the folder.
- **C. A pool of platform accounts, with central tokens, a folder per tenant per account, and reservations.** Chosen.

## Decision

### Where files go

- If the academy has its own connected Google account (ADR-008), its uploads still go there.
- Otherwise uploads go to the **platform pool**.
- Google Meet (R8-6) always uses the academy's own connection: pool accounts are storage only.

### Pool data (central database)

**`platform_drive_accounts`** holds one row per account, with these columns:

| Column | Meaning |
| --- | --- |
| `account_email` | unique |
| `status` | `connected`, `error` or `disabled` |
| `access_token`, `refresh_token` | `encrypted` casts, hidden |
| `token_expires_at` | |
| `scopes` | |
| `quota_limit_bytes` | null means unlimited |
| `quota_usage_bytes` | |
| `quota_checked_at` | |
| `priority` | lower is used first |
| `accepting_uploads` | |
| `connected_by` | |
| `last_error` | |

**`platform_drive_folders`** maps (account, tenant) to `folder_id`. Every tenant gets its own folder,
`LMS — {tenant name}`, inside a root folder `LMS Platform Storage` on each account.

**`platform_drive_reservations`** has these columns:

- `account_id`, `tenant_id`, `upload_id`
- `bytes`
- `expires_at` (the life of the Google upload session: 7 days)
- `released_at`

### Choosing an account

1. Take every account that is `connected` and `accepting_uploads`, ordered by `priority`, then by the most free space.
2. If an account's quota was checked more than 10 minutes ago, read it again from Google (`about.get?fields=storageQuota`).
3. Free space = limit − usage − active reservations. The first account with free space ≥ file size + margin
   (`GOOGLE_DRIVE_POOL_MARGIN_BYTES`, default 1 GiB) wins.
4. Choosing the account and writing its reservation happen in one transaction that locks the account rows. On
   PostgreSQL this uses `SELECT … FOR UPDATE`; SQLite serialises writes anyway. A concurrent upload therefore sees the
   space already reserved.
5. If no account fits, the upload is refused before any byte is sent: `409 STORAGE_FULL`, plus an audit entry.
6. A reservation is released when the upload completes, when it fails, or when it expires.

The pool order is "fill first": the account currently in use stays in use until it cannot take the next file.

### Connecting pool accounts

- The super admin page calls `GET /platform/drive-accounts/connect` and gets a Google consent URL.
- The consent asks for `openid email drive.file`, with offline access and `prompt=consent`.
- The OAuth callback is the same public route. The cached state says whether it is a tenant connection or a pool
  connection, so pool tokens are never written into a tenant database.
- The super admin can:
  - list accounts with used, free and reserved space
  - refresh the quota
  - stop new uploads to an account
  - disconnect an account. This is only allowed when no media references it, unless forced; disconnecting keeps the
    files.
- All of these actions are audited.

### Resumable uploads

- The browser sends the file in a single `PUT` with progress.
- On a network error it asks the API how many bytes Google already holds (`GET /media/uploads/{id}`, which queries
  Google with `Content-Range: bytes */size`). It then sends only the rest (`Content-Range: bytes N-(size-1)/size`),
  retrying with back-off.
- The pending upload (id, file name, size, last-modified) is kept in `localStorage`. After a reload the teacher
  picks the same file again; the name and size must match, and the upload continues from Google's offset.
- The session URL is returned only to the creator, and only while the upload is pending and not expired.

### Workers (queue `media`)

- **`FinalizeMediaUpload`**: `POST /media/uploads/{id}/complete` now answers `202` with status `finalizing`.
  The job checks the file (folder, video mime), shares it, creates the `MediaAsset`, releases the reservation and
  audits. The browser reads `GET /media/uploads/{id}` until the status is `completed` or `failed`.
- **`PollDriveVideoProcessing`**: while Drive has not produced `videoMediaMetadata`, it rechecks with back-off
  (1, 2, 5, 10, 30 minutes, then hourly, up to 24 hours) and flips the asset from `processing` to `ready`.
- **`lms:refresh-drive-quotas`**: scheduled every 15 minutes; it refreshes the quota of every pool account and
  expires stale reservations.

Production runs `php artisan queue:work --queue=media,default` under a process supervisor. The tests use the `sync` queue.

### Where an asset lives

`media_assets.metadata.storage` is `{ "kind": "tenant" }` or `{ "kind": "pool", "account_id": … }`. Every later Drive
call for that asset (processing checks, verification) uses the same credentials.

## Consequences

- Platform credentials are concentrated in one place, so central DB encryption and `APP_KEY` protection matter more.
  Tenants never see pool tokens, account emails or other tenants' folders.
- While the consent screen is in Testing mode:
  - every pool account must be a test user
  - Google revokes refresh tokens after 7 days

  The app must be published (and verified for the Calendar scope) before production.
- Drive's per-account upload limit of about 750 GB per day is multiplied by the number of accounts.
- Playback is still the Drive `/preview` player, with its limits: no watch tracking, a pop-out link, and view quotas.
  Moving playback to a video platform such as Vimeo is a separate, later decision.
- The resumable flow and the 202 status flow are new frontend contracts (see `docs/backend/openapi.yaml`).

## Status

Accepted 2026-11-19. Implementation: R4-3a (pool and reservations), R4-3b (resumable uploads), R4-3c (media workers).
