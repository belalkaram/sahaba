<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'tenants';

    protected $fillable = [
        'type',
        'organization_kind',
        'auth_mode',
        'status',
        'accepts_registrations',
        'name',
        'slug',
        'logo_url',
        'primary_color',
        'secondary_color',
        'brand_tagline',
        'city',
        'contact_phone',
        'onboarding_source',
        'brand_settings',
    ];

    protected $casts = [
        'accepts_registrations' => 'boolean',
        'brand_settings' => 'array',
    ];

    protected $appends = [
        'services',
    ];

    /**
     * Check if tenant allows a specific authentication mode.
     */
    public function allowsAuthMode(string $mode): bool
    {
        $tenantMode = $this->auth_mode ?? 'hybrid';
        if ($tenantMode === 'hybrid') {
            return true;
        }

        return $tenantMode === $mode;
    }

    /**
     * Domains registered for this tenant.
     */
    public function domains(): HasMany
    {
        return $this->hasMany(TenantDomain::class, 'tenant_id');
    }

    /**
     * Database allocation for this tenant.
     */
    public function databaseConfig(): HasOne
    {
        return $this->hasOne(TenantDatabase::class, 'tenant_id');
    }

    /**
     * Feature toggles configured for this tenant.
     */
    public function features(): HasMany
    {
        return $this->hasMany(TenantFeature::class, 'tenant_id');
    }

    /**
     * Determine if tenant is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Determine if tenant has a specific feature enabled.
     */
    public function hasFeature(string $featureKey): bool
    {
        $this->loadMissing('features');
        $feature = $this->features->firstWhere('feature_key', $featureKey);

        if ($feature !== null) {
            return (bool) $feature->enabled;
        }

        $module = config("authorization.modules.{$featureKey}");

        return $module ? (bool) ($module['is_default'] ?? true) : false;
    }

    /**
     * Determine active services (OD-31): online, offline, or both.
     *
     * @return string[]
     */
    public function getServicesAttribute(): array
    {
        $features = $this->relationLoaded('features')
            ? $this->features->where('enabled', true)->pluck('feature_key')->all()
            : $this->features()->where('enabled', true)->pluck('feature_key')->all();

        $hasOnline = in_array('online', $features, true) || in_array('courses', $features, true);
        $hasOffline = in_array('offline', $features, true) || in_array('attendance', $features, true);

        $services = [];
        if ($hasOnline) {
            $services[] = 'online';
        }
        if ($hasOffline) {
            $services[] = 'offline';
        }

        return ! empty($services) ? $services : ['online', 'offline'];
    }

    /**
     * Active services accessor helper.
     *
     * @return string[]
     */
    public function services(): array
    {
        return $this->getServicesAttribute();
    }

    /**
     * Active services accessor helper.
     *
     * @return string[]
     */
    public function activeServices(): array
    {
        return $this->getServicesAttribute();
    }
}
