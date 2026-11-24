<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Space held on a platform Drive account for an upload in progress (ADR-009).
 *
 * @property string $id
 * @property string $account_id
 * @property int $bytes
 * @property Carbon $expires_at
 * @property Carbon|null $released_at
 */
class PlatformDriveReservation extends Model
{
    use HasUuids;

    protected $table = 'platform_drive_reservations';

    protected $fillable = ['account_id', 'tenant_id', 'upload_id', 'bytes', 'expires_at', 'released_at'];

    protected $casts = [
        'bytes' => 'integer',
        'expires_at' => 'datetime',
        'released_at' => 'datetime',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('released_at')->where('expires_at', '>', now());
    }
}
