<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Unauthenticated runtime configuration for public pages. Only non-sensitive flags belong here.
 */
class PublicConfigController extends Controller
{
    /**
     * GET /public/config
     */
    public function show(): JsonResponse
    {
        return ApiResponse::success([
            // OD-20: off unless a platform admin explicitly enables it.
            'demo_login_enabled' => (bool) PlatformSetting::getValue(PlatformSetting::DEMO_LOGIN_ENABLED, false),
        ]);
    }
}
