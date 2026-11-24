<?php

namespace App\Models;

use Illuminate\Support\Carbon;

/**
 * A tenant's connection to an external account (ADR-008). Tokens are encrypted at rest and never serialised.
 *
 * @property string $provider
 * @property string $status
 * @property string|null $account_email
 * @property string $access_token
 * @property string|null $refresh_token
 * @property Carbon|null $token_expires_at
 * @property array<int, string>|null $scopes
 * @property string|null $drive_folder_id
 */
class IntegrationConnection extends TenantModel
{
    public const PROVIDER_GOOGLE = 'google';

    public const STATUS_CONNECTED = 'connected';

    public const STATUS_ERROR = 'error';

    protected $table = 'integration_connections';

    protected $fillable = [
        'provider',
        'status',
        'account_email',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'scopes',
        'drive_folder_id',
        'connected_by',
        'connected_at',
        'last_error',
    ];

    protected $hidden = ['access_token', 'refresh_token'];

    protected $casts = [
        'access_token' => 'encrypted',
        'refresh_token' => 'encrypted',
        'token_expires_at' => 'datetime',
        'connected_at' => 'datetime',
        'scopes' => 'array',
    ];

    public static function google(): ?self
    {
        return self::query()->where('provider', self::PROVIDER_GOOGLE)->first();
    }
}
