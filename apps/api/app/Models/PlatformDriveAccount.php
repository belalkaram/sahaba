<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A platform-owned Google account used as video storage for academies without their own connection (ADR-009).
 * Control DB only. Tokens are encrypted at rest and never serialised.
 *
 * @property string $id
 * @property string $account_email
 * @property string $status
 * @property string|null $access_token
 * @property string|null $refresh_token
 * @property Carbon|null $token_expires_at
 * @property string|null $root_folder_id
 * @property int|null $quota_limit_bytes
 * @property int $quota_usage_bytes
 * @property Carbon|null $quota_checked_at
 * @property int $priority
 * @property bool $accepting_uploads
 */
class PlatformDriveAccount extends Model
{
    use HasUuids;

    public const CONNECTED = 'connected';

    public const ERROR = 'error';

    public const DISABLED = 'disabled';

    protected $table = 'platform_drive_accounts';

    protected $fillable = [
        'account_email', 'status', 'access_token', 'refresh_token', 'token_expires_at', 'scopes', 'root_folder_id',
        'quota_limit_bytes', 'quota_usage_bytes', 'quota_checked_at', 'priority', 'accepting_uploads',
        'connected_by', 'connected_at', 'last_error',
    ];

    protected $hidden = ['access_token', 'refresh_token'];

    protected $casts = [
        'access_token' => 'encrypted',
        'refresh_token' => 'encrypted',
        'token_expires_at' => 'datetime',
        'quota_checked_at' => 'datetime',
        'connected_at' => 'datetime',
        'scopes' => 'array',
        'quota_limit_bytes' => 'integer',
        'quota_usage_bytes' => 'integer',
        'priority' => 'integer',
        'accepting_uploads' => 'boolean',
    ];

    public function reservations(): HasMany
    {
        return $this->hasMany(PlatformDriveReservation::class, 'account_id');
    }

    /** Bytes held by uploads that have started and not finished, failed or expired. */
    public function reservedBytes(): int
    {
        return (int) $this->reservations()->active()->sum('bytes');
    }

    /** null when Google reports no limit. */
    public function freeBytes(): ?int
    {
        if ($this->quota_limit_bytes === null) {
            return null;
        }

        return max(0, $this->quota_limit_bytes - $this->quota_usage_bytes - $this->reservedBytes());
    }
}
