<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * TenantModuleMiddleware (R1-A5)
 *
 * Enforces organization-level module enablement (online, offline, assessment, billing, credentials, analytics).
 * If the module is not enabled in `tenant_features`, returns HTTP 403 `MODULE_DISABLED`.
 */
class TenantModuleMiddleware
{
    public function __construct(
        protected TenantContext $tenantContext
    ) {}

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $module): Response|JsonResponse
    {
        $tenant = $this->tenantContext->getTenant();

        if (! $tenant) {
            return ApiResponse::error(
                'TENANT_NOT_RESOLVED',
                'No active tenant context found for module verification.',
                Response::HTTP_UNAUTHORIZED
            );
        }

        if (! $tenant->hasFeature($module)) {
            return ApiResponse::error(
                'MODULE_DISABLED',
                "The [{$module}] module is not enabled for this organization.",
                Response::HTTP_FORBIDDEN
            );
        }

        return $next($request);
    }
}
