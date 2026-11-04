<?php

namespace App\Tenancy;

use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Tenancy\Exceptions\TenantInactiveException;
use App\Tenancy\Exceptions\TenantNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TenantResolver
{
    /**
     * Resolve a tenant from the incoming HTTP request.
     */
    public function resolve(Request $request): Tenant
    {
        $tenant = $this->resolveFromHeaders($request)
            ?? $this->resolveFromHost($request);

        if (! $tenant) {
            throw new TenantNotFoundException('Tenant could not be resolved from domain or headers.');
        }

        if (! $tenant->isActive()) {
            throw new TenantInactiveException(
                sprintf('Tenant [%s] is currently %s.', $tenant->slug, $tenant->status)
            );
        }

        return $tenant;
    }

    /**
     * Resolve tenant from X-Tenant-Slug or X-Tenant-ID headers.
     */
    protected function resolveFromHeaders(Request $request): ?Tenant
    {
        $slug = $request->header('X-Tenant-Slug') ?? $request->header('X-Tenant');
        // Public, read-only academy images are loaded by a bare <img> that cannot send headers.
        if (! $slug && $request->isMethod('GET') && $request->is('api/v1/public/academy/*')) {
            $slug = $request->query('tenant');
        }
        if (is_string($slug) && trim($slug) !== '') {
            return Tenant::with(['domains', 'databaseConfig', 'features'])
                ->where('slug', trim($slug))
                ->first();
        }

        $id = $request->header('X-Tenant-ID');
        if (is_string($id) && Str::isUuid(trim($id))) {
            return Tenant::with(['domains', 'databaseConfig', 'features'])
                ->where('id', trim($id))
                ->first();
        }

        return null;
    }

    /**
     * Resolve tenant from HTTP host or subdomain.
     */
    protected function resolveFromHost(Request $request): ?Tenant
    {
        $host = $request->getHost();

        // 1. Direct domain match
        $domainMapping = TenantDomain::with('tenant')
            ->where('domain', $host)
            ->where('active', true)
            ->first();

        if ($domainMapping?->tenant) {
            $domainMapping->tenant->loadMissing(['domains', 'databaseConfig', 'features']);

            return $domainMapping->tenant;
        }

        // 2. Subdomain extraction (e.g. "teacher-ahmed.platform.local")
        $parts = explode('.', $host);
        if (count($parts) >= 2) {
            $subdomain = $parts[0];
            $tenant = Tenant::with(['domains', 'databaseConfig', 'features'])
                ->where('slug', $subdomain)
                ->first();

            if ($tenant) {
                return $tenant;
            }
        }

        return null;
    }
}
