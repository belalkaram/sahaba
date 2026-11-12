<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TenantSetting;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * R8: tenant-level notification and analytics settings.
 */
class AcademicSettingsController extends Controller
{
    private const KEYS = [
        TenantSetting::NOTIFY_PARENTS_ON_ABSENCE => true,
        TenantSetting::AT_RISK_ATTENDANCE_BELOW => 75,
        TenantSetting::AT_RISK_SCORE_BELOW => 60,
        TenantSetting::MIN_ATTENDANCE_FOR_EXAMS => null,
    ];

    /**
     * GET /tenant/academic-settings
     */
    public function show(): JsonResponse
    {
        return ApiResponse::success($this->payload());
    }

    /**
     * PUT /tenant/academic-settings
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            TenantSetting::NOTIFY_PARENTS_ON_ABSENCE => 'sometimes|boolean',
            TenantSetting::AT_RISK_ATTENDANCE_BELOW => 'sometimes|numeric|min:0|max:100',
            TenantSetting::AT_RISK_SCORE_BELOW => 'sometimes|numeric|min:0|max:100',
            TenantSetting::MIN_ATTENDANCE_FOR_EXAMS => 'sometimes|nullable|numeric|min:1|max:100',
        ]);

        foreach ($validated as $key => $value) {
            TenantSetting::setValue($key, $value);
        }

        AuditLogger::log(action: 'tenant.academic_settings.updated', entityType: 'TenantSetting', payload: $validated);

        return ApiResponse::success($this->payload());
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return collect(self::KEYS)
            ->map(fn ($default, $key) => TenantSetting::getValue($key, $default))
            ->all();
    }
}
