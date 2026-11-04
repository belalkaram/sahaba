<?php

namespace App\Tenancy;

use App\Models\Tenant;
use App\Tenancy\Exceptions\TenantNotFoundException;

class TenantContext
{
    protected ?Tenant $tenant = null;

    /**
     * Set the currently active tenant.
     */
    public function setTenant(Tenant $tenant): void
    {
        $this->tenant = $tenant;
    }

    /**
     * Get the currently active tenant, or null if unassigned.
     */
    public function getTenant(): ?Tenant
    {
        return $this->tenant;
    }

    /**
     * Get the active tenant or throw if not set.
     */
    public function getTenantOrFail(): Tenant
    {
        if (! $this->tenant) {
            throw new TenantNotFoundException('No active tenant context bound to current request.');
        }

        return $this->tenant;
    }

    /**
     * Determine if a tenant is currently bound.
     */
    public function hasTenant(): bool
    {
        return $this->tenant !== null;
    }

    /**
     * Get the active tenant UUID or null.
     */
    public function getTenantId(): ?string
    {
        return $this->tenant?->id;
    }

    /**
     * Clear the tenant context.
     */
    public function clear(): void
    {
        $this->tenant = null;
    }

    /**
     * Delegate static method calls to the singleton instance.
     */
    public static function __callStatic(string $method, array $arguments): mixed
    {
        return app(self::class)->$method(...$arguments);
    }

    /**
     * Static accessors forwarding to the container singleton.
     */
    public static function getActiveTenant(): ?Tenant
    {
        return app(self::class)->getTenant();
    }

    public static function activeId(): ?string
    {
        return app(self::class)->getTenantId();
    }
}
