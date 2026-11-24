<?php

namespace App\Domain\Integrations\Google\Drive;

use App\Domain\Integrations\Google\GoogleDriveClient;
use App\Domain\Integrations\Google\GoogleNotConnectedException;
use App\Domain\Integrations\Google\GoogleOAuthClient;
use App\Domain\Integrations\Google\GoogleOAuthStates;
use App\Models\PlatformDriveAccount;
use App\Models\PlatformDriveFolder;
use App\Models\PlatformDriveReservation;
use App\Models\Tenant;
use App\Support\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Platform-owned Google Drive accounts used as shared video storage (ADR-009): connecting them, reading their
 * quota, choosing one with room for a file and reserving that room until the upload ends.
 */
class DrivePool
{
    public const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];

    private const QUOTA_MAX_AGE_SECONDS = 600;

    public function __construct(
        private readonly GoogleOAuthClient $oauth,
        private readonly GoogleOAuthStates $states,
        private readonly GoogleDriveClient $drive,
    ) {}

    public function access(PlatformDriveAccount $account): PoolDriveAccess
    {
        return new PoolDriveAccess($account, $this->oauth);
    }

    public function hasAccounts(): bool
    {
        return PlatformDriveAccount::query()->where('status', PlatformDriveAccount::CONNECTED)->where('accepting_uploads', true)->exists();
    }

    public function authorizationUrl(string $actorId, string $actorType): string
    {
        $state = $this->states->issue(GoogleOAuthStates::POOL, ['actor_id' => $actorId, 'actor_type' => $actorType]);

        return $this->oauth->authorizationUrl($state, self::SCOPES);
    }

    /** @param  array<string, mixed>  $pending  the pulled state */
    public function completeAuthorization(array $pending, string $code): PlatformDriveAccount
    {
        $tokens = $this->oauth->exchangeCode($code);
        $email = $this->oauth->accountEmail($tokens['access_token']);
        if (! $email) {
            throw new GoogleNotConnectedException('Google did not return the account email.');
        }

        $existing = PlatformDriveAccount::query()->where('account_email', $email)->first();
        $account = PlatformDriveAccount::query()->updateOrCreate(['account_email' => $email], [
            'status' => PlatformDriveAccount::CONNECTED,
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'] ?? $existing?->refresh_token,
            'token_expires_at' => now()->addSeconds($tokens['expires_in']),
            'scopes' => array_values(array_filter(explode(' ', $tokens['scope']))),
            'accepting_uploads' => $existing?->accepting_uploads ?? true,
            'priority' => $existing?->priority ?? ((int) PlatformDriveAccount::query()->max('priority') + 10),
            'connected_by' => $pending['actor_id'] ?? null,
            'connected_at' => now(),
            'last_error' => null,
        ]);

        AuditLogger::log('platform.drive_account.connected', null, 'platform_drive_account', $account->id,
            ['account_email' => $email], (string) ($pending['actor_type'] ?? 'platform_admin'), $pending['actor_id'] ?? null);

        try {
            $this->refreshQuota($account);
        } catch (\Throwable $e) {
            Log::warning('Drive quota read failed right after connecting', ['account_id' => $account->id, 'error' => $e->getMessage()]);
        }

        return $account;
    }

    public function refreshQuota(PlatformDriveAccount $account): PlatformDriveAccount
    {
        $quota = $this->drive->storageQuota($this->access($account));
        $account->forceFill([
            'quota_limit_bytes' => $quota['limit'],
            'quota_usage_bytes' => $quota['usage'],
            'quota_checked_at' => now(),
        ])->save();

        return $account;
    }

    /**
     * Choose the first account (by priority) with room for the file plus the safety margin and reserve the room.
     * The lock makes concurrent uploads see each other's reservations.
     *
     * @return array{0: PlatformDriveAccount, 1: PlatformDriveReservation}
     *
     * @throws StorageFullException
     */
    public function reserve(Tenant $tenant, int $bytes, \DateTimeInterface $expiresAt): array
    {
        $this->refreshStaleQuotas();
        $needed = $bytes + (int) config('services.google.pool_margin_bytes');

        $result = DB::transaction(function () use ($tenant, $bytes, $needed, $expiresAt) {
            $accounts = PlatformDriveAccount::query()
                ->where('status', PlatformDriveAccount::CONNECTED)
                ->where('accepting_uploads', true)
                ->orderBy('priority')->orderBy('created_at')
                ->lockForUpdate()
                ->get();

            foreach ($accounts as $account) {
                $free = $account->freeBytes();
                if ($free === null || $free >= $needed) {
                    $reservation = PlatformDriveReservation::create([
                        'account_id' => $account->id,
                        'tenant_id' => $tenant->id,
                        'bytes' => $bytes,
                        'expires_at' => $expiresAt,
                    ]);

                    return [$account, $reservation];
                }
            }

            return null;
        });

        if ($result === null) {
            AuditLogger::log('platform.drive_pool.full', $tenant->id, 'tenant', $tenant->id, ['requested_bytes' => $bytes], 'system');

            throw new StorageFullException($bytes);
        }

        return $result;
    }

    public function release(?string $reservationId): void
    {
        if ($reservationId) {
            PlatformDriveReservation::query()->whereKey($reservationId)->whereNull('released_at')->update(['released_at' => now()]);
        }
    }

    /** "LMS Platform Storage / LMS — {tenant}" on the account, created on first use. */
    public function tenantFolder(PlatformDriveAccount $account, Tenant $tenant): string
    {
        $access = $this->access($account);

        $mapping = PlatformDriveFolder::query()->where('account_id', $account->id)->where('tenant_id', $tenant->id)->first();
        if ($mapping && $this->drive->folderUsable($access, $mapping->folder_id)) {
            return $mapping->folder_id;
        }

        if (! $this->drive->folderUsable($access, $account->root_folder_id)) {
            $account->forceFill(['root_folder_id' => $this->drive->createFolder($access, 'LMS Platform Storage')])->save();
        }

        $folderId = $this->drive->createFolder($access, 'LMS — '.$tenant->name, $account->root_folder_id);
        PlatformDriveFolder::query()->updateOrCreate(['account_id' => $account->id, 'tenant_id' => $tenant->id], ['folder_id' => $folderId]);

        return $folderId;
    }

    public function isTenantFolder(PlatformDriveAccount $account, Tenant $tenant, string $folderId): bool
    {
        return PlatformDriveFolder::query()->where('account_id', $account->id)->where('tenant_id', $tenant->id)->value('folder_id') === $folderId;
    }

    /** Scheduled (lms:refresh-drive-quotas): fresh quotas for every connected account, stale reservations released. */
    public function refreshAll(): array
    {
        $expired = PlatformDriveReservation::query()->whereNull('released_at')->where('expires_at', '<=', now())->update(['released_at' => now()]);
        $refreshed = 0;
        $failed = 0;

        foreach (PlatformDriveAccount::query()->where('status', PlatformDriveAccount::CONNECTED)->get() as $account) {
            try {
                $this->refreshQuota($account);
                $refreshed++;
            } catch (\Throwable $e) {
                $failed++;
                Log::warning('Drive quota refresh failed', ['account_id' => $account->id, 'error' => $e->getMessage()]);
            }
        }

        return ['refreshed' => $refreshed, 'failed' => $failed, 'expired_reservations' => $expired];
    }

    public function disconnect(PlatformDriveAccount $account, string $actorId, string $actorType): void
    {
        if ($account->refresh_token || $account->access_token) {
            $this->oauth->revoke($account->refresh_token ?: $account->access_token);
        }

        // The row stays: uploaded assets still point at it, and the files stay in that Drive.
        $account->forceFill([
            'status' => PlatformDriveAccount::DISABLED,
            'accepting_uploads' => false,
            'access_token' => null,
            'refresh_token' => null,
            'token_expires_at' => null,
        ])->save();

        AuditLogger::log('platform.drive_account.disconnected', null, 'platform_drive_account', $account->id,
            ['account_email' => $account->account_email], $actorType, $actorId);
    }

    private function refreshStaleQuotas(): void
    {
        $stale = PlatformDriveAccount::query()
            ->where('status', PlatformDriveAccount::CONNECTED)
            ->where('accepting_uploads', true)
            ->where(fn ($q) => $q->whereNull('quota_checked_at')->orWhere('quota_checked_at', '<', now()->subSeconds(self::QUOTA_MAX_AGE_SECONDS)))
            ->get();

        foreach ($stale as $account) {
            try {
                $this->refreshQuota($account);
            } catch (GoogleNotConnectedException) {
                // PoolDriveAccess already marked it broken; it is skipped below.
            } catch (\Throwable $e) {
                Log::warning('Drive quota refresh failed before an upload', ['account_id' => $account->id, 'error' => $e->getMessage()]);
            }
        }
    }
}
