<?php

namespace App\Http\Controllers\Api;

use App\Domain\Media\Services\ProfileImageService;
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
            'organization_kind' => $tenant->organization_kind,
            'city' => $tenant->city,
            'contact_phone' => $tenant->contact_phone,
            'services' => $tenant->services(),
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
            'city' => 'nullable|string|max:100',
            'contact_phone' => 'nullable|string|max:50',
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
                'organization_kind' => $tenant->organization_kind,
                'city' => $tenant->city,
                'contact_phone' => $tenant->contact_phone,
                'services' => $tenant->services(),
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

    /**
     * Upload and store tenant branding logo.
     */
    public function storeLogo(Request $request, TenantContext $context, ProfileImageService $images): JsonResponse
    {
        $tenant = $context->getTenantOrFail();

        $request->validate([
            'image' => 'required|file|image|mimes:'.ProfileImageService::MIMES.'|max:'.ProfileImageService::MAX_KB,
        ]);

        $previous = $tenant->brand_settings['logo_path'] ?? null;
        $path = $images->store($request->file('image'), $tenant->slug, 'logo', $previous);

        $v = substr(md5($path), 0, 8);
        $logoUrl = "/public/academy/logo?tenant={$tenant->slug}&v={$v}";

        $brandSettings = $tenant->brand_settings ?? [];
        $brandSettings['logo_path'] = $path;

        $tenant->update([
            'logo_url' => $logoUrl,
            'brand_settings' => $brandSettings,
        ]);

        AuditLogger::log(
            action: 'tenant.logo.updated',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id
        );

        return ApiResponse::success([
            'tenant' => $tenant->fresh(),
            'logo_url' => $logoUrl,
            'message' => 'تم رفع وتحديث شعار المؤسسة بنجاح',
        ]);
    }

    /**
     * Delete stored tenant branding logo.
     */
    public function destroyLogo(Request $request, TenantContext $context, ProfileImageService $images): JsonResponse
    {
        $tenant = $context->getTenantOrFail();

        $previous = $tenant->brand_settings['logo_path'] ?? null;
        if ($previous) {
            $images->delete($previous, $tenant->slug);
        }

        $brandSettings = $tenant->brand_settings ?? [];
        unset($brandSettings['logo_path']);

        $tenant->update([
            'logo_url' => null,
            'brand_settings' => $brandSettings,
        ]);

        AuditLogger::log(
            action: 'tenant.logo.removed',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id
        );

        return ApiResponse::success([
            'tenant' => $tenant->fresh(),
            'message' => 'تم حذف شعار المؤسسة بنجاح',
        ]);
    }
}
