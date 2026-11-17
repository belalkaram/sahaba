<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ADR-007 (TL-1): Landing page settings for a tenant (control DB).
 *
 * @property string $id
 * @property string $tenant_id
 * @property array|null $published
 * @property array|null $draft
 * @property int $version
 * @property \Carbon\Carbon|null $published_at
 * @property string|null $published_by
 * @property string|null $preview_token_hash
 * @property \Carbon\Carbon|null $preview_expires_at
 */
class TenantLandingSettings extends Model
{
    use HasUuids;

    protected $table = 'tenant_landing_settings';

    protected $fillable = [
        'tenant_id',
        'published',
        'draft',
        'version',
        'published_at',
        'published_by',
        'preview_token_hash',
        'preview_expires_at',
    ];

    protected $casts = [
        'published' => 'array',
        'draft' => 'array',
        'version' => 'integer',
        'published_at' => 'datetime',
        'preview_expires_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /** Whether the preview token is valid right now. */
    public function isPreviewTokenValid(string $rawToken): bool
    {
        if (! $this->preview_token_hash || ! $this->preview_expires_at) {
            return false;
        }

        return hash('sha256', $rawToken) === $this->preview_token_hash
            && $this->preview_expires_at->isFuture();
    }
}
