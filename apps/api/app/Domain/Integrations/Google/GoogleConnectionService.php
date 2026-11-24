<?php

namespace App\Domain\Integrations\Google;

use App\Models\IntegrationConnection;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantRunner;

/**
 * The tenant-level Google connection (OD-3, ADR-008): consent, token storage and refresh, disconnect.
 */
class GoogleConnectionService
{
    public function __construct(
        private readonly GoogleOAuthClient $oauth,
        private readonly TenantRunner $runner,
        private readonly GoogleOAuthStates $states,
    ) {}

    public function isConfigured(): bool
    {
        return $this->oauth->isConfigured();
    }

    /** Start consent for the current tenant; the state is the only thing that ties the callback to it. */
    public function authorizationUrl(Tenant $tenant, TenantUser $user): string
    {
        $state = $this->states->issue(GoogleOAuthStates::TENANT, ['tenant_id' => $tenant->id, 'user_id' => $user->id]);

        return $this->oauth->authorizationUrl($state);
    }

    /**
     * Finish consent for a pulled tenant state. Returns the connected tenant, or null when it is no longer active.
     */
    public function completeAuthorization(array $pending, string $code): ?Tenant
    {
        if (($pending['kind'] ?? null) !== GoogleOAuthStates::TENANT || empty($pending['tenant_id'])) {
            return null;
        }

        $tenant = Tenant::query()->where('status', 'active')->find($pending['tenant_id']);
        if (! $tenant) {
            return null;
        }

        $tokens = $this->oauth->exchangeCode($code);
        $email = $this->oauth->accountEmail($tokens['access_token']);

        $this->runner->run($tenant, function () use ($tokens, $email, $pending, $tenant) {
            $existing = IntegrationConnection::google();
            // Google omits the refresh token when it was already granted; keep the stored one then.
            $refresh = $tokens['refresh_token'] ?? $existing?->refresh_token;

            $connection = IntegrationConnection::query()->updateOrCreate(
                ['provider' => IntegrationConnection::PROVIDER_GOOGLE],
                [
                    'status' => IntegrationConnection::STATUS_CONNECTED,
                    'account_email' => $email,
                    'access_token' => $tokens['access_token'],
                    'refresh_token' => $refresh,
                    'token_expires_at' => now()->addSeconds($tokens['expires_in']),
                    'scopes' => array_values(array_filter(explode(' ', $tokens['scope']))),
                    // A different Google account cannot see the previous account's folder.
                    'drive_folder_id' => $existing && $existing->account_email === $email ? $existing->drive_folder_id : null,
                    'connected_by' => $pending['user_id'] ?? null,
                    'connected_at' => now(),
                    'last_error' => null,
                ]
            );

            AuditLogger::log(
                'integrations.google.connected',
                $tenant->id,
                'integration_connection',
                $connection->id,
                ['account_email' => $email, 'scopes' => $connection->scopes],
                'user',
                $pending['user_id'] ?? null,
            );
        });

        return $tenant;
    }

    /**
     * @return array<string, mixed>
     */
    public function status(): array
    {
        $connection = IntegrationConnection::google();

        return [
            'configured' => $this->isConfigured(),
            'connected' => $connection?->status === IntegrationConnection::STATUS_CONNECTED,
            'status' => $connection?->status ?? 'not_connected',
            'account_email' => $connection?->account_email,
            'scopes' => $connection?->scopes ?? [],
            'connected_at' => $connection?->connected_at?->toIso8601String(),
            'last_error' => $connection?->last_error,
        ];
    }

    public function disconnect(): bool
    {
        $connection = IntegrationConnection::google();
        if (! $connection) {
            return false;
        }

        $this->oauth->revoke($connection->refresh_token ?: $connection->access_token);
        AuditLogger::log('integrations.google.disconnected', null, 'integration_connection', $connection->id, [
            'account_email' => $connection->account_email,
        ]);
        $connection->delete();

        return true;
    }

    /** A usable connection with a fresh access token for the current tenant. */
    public function activeConnection(): IntegrationConnection
    {
        $connection = IntegrationConnection::google();
        if (! $connection || $connection->status !== IntegrationConnection::STATUS_CONNECTED) {
            throw new GoogleNotConnectedException;
        }

        if ($connection->token_expires_at && $connection->token_expires_at->isAfter(now()->addSeconds(60))) {
            return $connection;
        }

        if (! $connection->refresh_token) {
            $this->markBroken($connection, 'no_refresh_token');
            throw new GoogleNotConnectedException;
        }

        try {
            $tokens = $this->oauth->refresh($connection->refresh_token);
        } catch (GoogleNotConnectedException $e) {
            $this->markBroken($connection, 'invalid_grant');
            throw $e;
        }

        $connection->forceFill([
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'] ?? $connection->refresh_token,
            'token_expires_at' => now()->addSeconds($tokens['expires_in']),
        ])->save();

        return $connection;
    }

    public function isConnected(): bool
    {
        return IntegrationConnection::google()?->status === IntegrationConnection::STATUS_CONNECTED;
    }

    private function markBroken(IntegrationConnection $connection, string $reason): void
    {
        $connection->forceFill(['status' => IntegrationConnection::STATUS_ERROR, 'last_error' => $reason])->save();
        AuditLogger::log('integrations.google.broken', null, 'integration_connection', $connection->id, ['reason' => $reason], 'system');
    }
}
