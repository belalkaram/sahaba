<?php

namespace App\Domain\Integrations\Google\Drive;

use App\Domain\Integrations\Google\GoogleNotConnectedException;
use App\Domain\Integrations\Google\GoogleOAuthClient;
use App\Models\PlatformDriveAccount;
use App\Support\Audit\AuditLogger;

/** A platform storage account (ADR-009). */
class PoolDriveAccess implements DriveAccess
{
    public function __construct(
        public readonly PlatformDriveAccount $account,
        private readonly GoogleOAuthClient $oauth,
    ) {}

    public function accessToken(): string
    {
        $account = $this->account;
        if ($account->status !== PlatformDriveAccount::CONNECTED) {
            throw new GoogleNotConnectedException('Platform Drive account is not connected.');
        }

        if ($account->access_token && $account->token_expires_at?->isAfter(now()->addSeconds(60))) {
            return $account->access_token;
        }

        if (! $account->refresh_token) {
            $this->markBroken('no_refresh_token');
            throw new GoogleNotConnectedException('Platform Drive account has no refresh token.');
        }

        try {
            $tokens = $this->oauth->refresh($account->refresh_token);
        } catch (GoogleNotConnectedException $e) {
            $this->markBroken('invalid_grant');
            throw $e;
        }

        $account->forceFill([
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'] ?? $account->refresh_token,
            'token_expires_at' => now()->addSeconds($tokens['expires_in']),
        ])->save();

        return $account->access_token;
    }

    public function markBroken(string $reason): void
    {
        $this->account->forceFill(['status' => PlatformDriveAccount::ERROR, 'last_error' => $reason])->save();
        AuditLogger::log('platform.drive_account.broken', null, 'platform_drive_account', $this->account->id, ['reason' => $reason], 'system');
    }

    public function storageRef(): array
    {
        return ['kind' => 'pool', 'account_id' => $this->account->id];
    }
}
