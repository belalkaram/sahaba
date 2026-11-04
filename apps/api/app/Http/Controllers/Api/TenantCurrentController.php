<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantCurrentController extends Controller
{
    /**
     * Return information about the currently resolved tenant.
     */
    public function show(TenantContext $context): JsonResponse
    {
        $tenant = $context->getTenantOrFail();

        return ApiResponse::success([
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
            'type' => $tenant->type,
            'auth_mode' => $tenant->auth_mode ?? 'hybrid',
            'status' => $tenant->status,
            'logo_url' => $tenant->logo_url,
            'primary_color' => $tenant->primary_color ?? null,
            'secondary_color' => $tenant->secondary_color ?? null,
            'brand_tagline' => $tenant->brand_tagline,
            'brand_settings' => $tenant->brand_settings ?? [],
            'domains' => $tenant->domains->pluck('domain')->values()->all(),
            'features' => $tenant->features->where('enabled', true)->pluck('feature_key')->values()->all(),
        ]);
    }

    public function __invoke(TenantContext $context): JsonResponse
    {
        return $this->show($context);
    }

    /**
     * Update tenant branding and settings (Tenant Admin).
     */
    public function update(Request $request, TenantContext $context): JsonResponse
    {
        $tenant = $context->getTenantOrFail();

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'logo_url' => 'nullable|string|max:500',
            'primary_color' => 'nullable|string|max:30',
            'secondary_color' => 'nullable|string|max:30',
            'brand_tagline' => 'nullable|string|max:255',
            'brand_settings' => 'nullable|array',
            'auth_mode' => 'nullable|string|in:password,coupon,hybrid',
        ]);

        $tenant->update($validated);

        AuditLogger::log(
            action: 'tenant.settings.updated',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id,
            payload: $validated
        );

        return ApiResponse::success([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'type' => $tenant->type,
                'auth_mode' => $tenant->auth_mode,
                'status' => $tenant->status,
                'logo_url' => $tenant->logo_url,
                'primary_color' => $tenant->primary_color,
                'secondary_color' => $tenant->secondary_color,
                'brand_tagline' => $tenant->brand_tagline,
                'brand_settings' => $tenant->brand_settings ?? [],
                'domains' => $tenant->domains->pluck('domain')->values()->all(),
                'features' => $tenant->features->where('enabled', true)->pluck('feature_key')->values()->all(),
            ],
            'message' => 'تم تحديث إعدادات المؤسسة بنجاح',
        ]);
    }
}
