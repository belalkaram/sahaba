<?php

namespace App\Http\Controllers\Api\Platform;

use App\Domain\Platform\PlatformMetricsService;
use App\Http\Controllers\Controller;
use App\Models\SupportAccessLog;
use App\Models\Tenant;
use App\Models\TenantFeature;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantProvisioningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class TenantController extends Controller
{
    public const ALLOWED_TYPES = [
        'individual_teacher',
        'organization',
        'center',
        'academy',
        'school',
        'institute',
        'educational_center',
        'university',
    ];

    public const ALLOWED_ORGANIZATION_KINDS = [
        'center',
        'academy',
        'school',
        'institute',
    ];

    /**
     * List all tenants on the platform.
     */
    public function index(): JsonResponse
    {
        $tenants = Tenant::with(['domains', 'databaseConfig', 'features'])->get();

        return ApiResponse::success(['tenants' => $tenants]);
    }

    /**
     * Show a specific tenant.
     */
    public function show(string $id): JsonResponse
    {
        $tenant = Tenant::with(['domains', 'databaseConfig', 'features'])->findOrFail($id);

        return ApiResponse::success(['tenant' => $tenant]);
    }

    /**
     * Provision a new tenant using the atomic provisioning service.
     */
    public function store(Request $request, TenantProvisioningService $provisioningService): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:50|unique:tenants,slug',
            'domain' => 'nullable|string|max:255|unique:tenant_domains,domain',
            'type' => ['required', 'string', Rule::in(self::ALLOWED_TYPES)],
            'organization_kind' => ['nullable', 'string', Rule::in(self::ALLOWED_ORGANIZATION_KINDS)],
            'auth_mode' => 'nullable|string|in:password,coupon,hybrid',
            'logo_url' => 'nullable|string|max:500',
            'primary_color' => 'nullable|string|max:30',
            'secondary_color' => 'nullable|string|max:30',
            'brand_tagline' => 'nullable|string|max:255',
            'brand_settings' => 'nullable|array',
            'modules' => 'nullable|array',
            'modules.*' => 'string',
            'owner' => 'nullable|array',
            'owner.name' => 'required_with:owner|string|max:255',
            'owner.email' => 'required_with:owner|email|max:255',
            'owner.phone' => 'nullable|string|max:30',
            'owner.password' => 'required_with:owner|string|min:8',
        ]);

        try {
            $tenant = $provisioningService->provision(
                $validated,
                actorType: 'platform_admin',
                actorId: (string) ($request->user()?->id ?? 'admin')
            );

            return ApiResponse::success(['tenant' => $tenant], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            return ApiResponse::error(
                'TENANT_PROVISIONING_FAILED',
                'Failed to provision tenant: '.$e->getMessage(),
                Response::HTTP_INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Update tenant metadata or white-label branding.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => ['sometimes', 'string', Rule::in(self::ALLOWED_TYPES)],
            'organization_kind' => ['nullable', 'string', Rule::in(self::ALLOWED_ORGANIZATION_KINDS)],
            'auth_mode' => 'sometimes|string|in:password,coupon,hybrid',
            'status' => 'sometimes|string|in:active,suspended,provisioning,archived',
            'logo_url' => 'nullable|string|max:500',
            'primary_color' => 'nullable|string|max:30',
            'secondary_color' => 'nullable|string|max:30',
            'brand_tagline' => 'nullable|string|max:255',
            'brand_settings' => 'nullable|array',
        ]);

        $tenant->update($validated);
        $tenant->load(['domains', 'databaseConfig', 'features']);

        AuditLogger::log(
            action: 'tenant.updated',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id,
            payload: $validated,
            actorType: 'platform_admin'
        );

        return ApiResponse::success([
            'tenant' => $tenant,
            'message' => 'Tenant branding and details updated successfully',
        ]);
    }

    /**
     * Suspend a tenant.
     */
    public function suspend(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update(['status' => 'suspended']);

        AuditLogger::log(
            action: 'tenant.suspended',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id,
            payload: ['status' => 'suspended'],
            actorType: 'platform_admin'
        );

        return ApiResponse::success([
            'tenant' => $tenant->fresh(['domains', 'databaseConfig', 'features']),
            'message' => 'Tenant suspended successfully.',
        ]);
    }

    /**
     * Activate a tenant.
     */
    public function activate(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update(['status' => 'active']);

        AuditLogger::log(
            action: 'tenant.activated',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id,
            payload: ['status' => 'active'],
            actorType: 'platform_admin'
        );

        return ApiResponse::success([
            'tenant' => $tenant->fresh(['domains', 'databaseConfig', 'features']),
            'message' => 'Tenant activated successfully.',
        ]);
    }

    /**
     * Update enabled modules for a tenant.
     */
    public function updateModules(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $validated = $request->validate([
            'modules' => 'required|array',
            'modules.*' => 'string',
        ]);

        $allConfiguredModules = array_keys(config('authorization.modules', []));
        $enabledModules = $validated['modules'];

        foreach ($allConfiguredModules as $moduleKey) {
            $isEnabled = in_array($moduleKey, $enabledModules, true);
            TenantFeature::updateOrCreate(
                ['tenant_id' => $tenant->id, 'feature_key' => $moduleKey],
                ['enabled' => $isEnabled]
            );
        }

        AuditLogger::log(
            action: 'tenant.modules_updated',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id,
            payload: ['modules' => $enabledModules],
            actorType: 'platform_admin'
        );

        return ApiResponse::success([
            'tenant' => $tenant->fresh(['domains', 'databaseConfig', 'features']),
            'message' => 'Tenant modules updated successfully.',
        ]);
    }

    /**
     * Aggregate metrics across the platform (Master §51: counts only, no raw tenant data).
     */
    public function metrics(PlatformMetricsService $metrics): JsonResponse
    {
        return ApiResponse::success($metrics->summary());
    }

    /**
     * POST /platform/metrics/refresh — recompute now instead of waiting for the hourly job.
     */
    public function refreshMetrics(PlatformMetricsService $metrics): JsonResponse
    {
        $metrics->refreshAll();

        return ApiResponse::success($metrics->summary());
    }

    /**
     * List all platform support sessions.
     */
    public function supportSessions(): JsonResponse
    {
        $sessions = SupportAccessLog::with(['tenant', 'user'])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return ApiResponse::success(['support_sessions' => $sessions]);
    }
}
