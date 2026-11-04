<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportAccessLog extends Model
{
    use HasUuids;

    protected $table = 'support_access_logs';

    protected $fillable = [
        'platform_user_id',
        'tenant_id',
        'reason',
        'ip_address',
        'status',
        'accessed_at',
        'expires_at',
        'ended_at',
        'revoked_at',
    ];

    protected $casts = [
        'accessed_at' => 'datetime',
        'expires_at' => 'datetime',
        'ended_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(PlatformUser::class, 'platform_user_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function end(): void
    {
        $this->update([
            'status' => 'ended',
            'ended_at' => now(),
        ]);
    }
}
