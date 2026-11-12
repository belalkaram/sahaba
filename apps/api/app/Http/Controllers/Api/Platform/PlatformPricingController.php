<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformPricing;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformPricingController extends Controller
{
    /**
     * GET /platform/pricing (OD-27)
     */
    public function show(Request $request): JsonResponse
    {
        $tenantId = $request->query('tenant_id');
        $pricing = PlatformPricing::getForTenant($tenantId);

        return ApiResponse::success(['pricing' => $pricing]);
    }

    /**
     * PUT /platform/pricing (OD-27, F-17)
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'student_monthly_fee' => 'sometimes|numeric|min:0', // legacy (OD-27), unused since OD-39
            'currency' => 'required|string|max:10',
            'receiving_account_type' => 'required|string|in:platform,teacher',
            'bank_name' => 'nullable|string|max:100',
            'account_holder_name' => 'nullable|string|max:150',
            'iban' => 'nullable|string|max:50',
            'transfer_instructions' => 'nullable|string|max:1000',
            'tenant_id' => 'nullable|uuid|exists:tenants,id',
        ]);

        $tenantId = $validated['tenant_id'] ?? null;
        $pricing = PlatformPricing::getForTenant($tenantId);

        $pricing->update([
            'student_monthly_fee' => $validated['student_monthly_fee'] ?? $pricing->student_monthly_fee,
            'currency' => $validated['currency'],
            'receiving_account_type' => $validated['receiving_account_type'],
            'bank_name' => $validated['bank_name'] ?? null,
            'account_holder_name' => $validated['account_holder_name'] ?? null,
            'iban' => $validated['iban'] ?? null,
            'transfer_instructions' => $validated['transfer_instructions'] ?? null,
        ]);

        AuditLogger::log(
            action: 'platform.pricing.updated',
            entityType: 'PlatformPricing',
            entityId: $pricing->id,
            payload: $validated,
            actorType: (string) $request->attributes->get('platform_actor_type', 'platform_admin'),
            actorId: (string) $request->attributes->get('platform_actor_id', 'platform_admin')
        );

        return ApiResponse::success(['pricing' => $pricing->fresh()]);
    }

    /**
     * GET /public/pricing (OD-27, F-17) - Unauthenticated public pricing endpoint.
     */
    public function publicPricing(): JsonResponse
    {
        $pricing = PlatformPricing::getForTenant();

        // OD-39 (ADR-006): students pay the platform nothing; academies buy seats (student = code) from the super admin.
        return ApiResponse::success([
            'student_platform_fee' => 0,
            'currency' => $pricing->currency,
            'capacity_model' => 'seats',
            'headline' => 'الطالب لا يدفع للمنصة شيئاً. الأكاديمية أو المدرس يشترون مقاعد (طالب = كود) من إدارة المنصة.',
            'receiving_account_type' => $pricing->receiving_account_type,
            'bank_name' => $pricing->bank_name,
            'account_holder_name' => $pricing->account_holder_name,
            'iban' => $pricing->iban,
            'transfer_instructions' => $pricing->transfer_instructions,
        ]);
    }
}
