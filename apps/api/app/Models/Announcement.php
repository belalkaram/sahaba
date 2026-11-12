<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** OD-37: an academy announcement (see the tenant migration 2026_11_12_000001). */
class Announcement extends TenantModel
{
    public const DISPLAYS = ['bell', 'banner', 'modal'];

    public const FREQUENCIES = ['once', 'persistent'];

    public const TONES = ['info', 'success', 'warning', 'danger'];

    protected $fillable = [
        'title', 'body', 'display', 'frequency', 'tone', 'audience', 'status',
        'starts_at', 'ends_at', 'created_by', 'withdrawn_at', 'recipients_count',
    ];

    protected $casts = [
        'audience' => 'array',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'withdrawn_at' => 'datetime',
        'recipients_count' => 'integer',
    ];

    public function recipients(): HasMany
    {
        return $this->hasMany(AnnouncementRecipient::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by');
    }

    /** Published, started, not ended. */
    public function scopeLive(Builder $query): Builder
    {
        $now = now();

        return $query->where('status', 'published')
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', $now));
    }

    public function isLive(): bool
    {
        $now = now();

        return $this->status === 'published'
            && ($this->starts_at === null || $this->starts_at <= $now)
            && ($this->ends_at === null || $this->ends_at > $now);
    }
}
