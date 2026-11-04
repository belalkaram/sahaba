<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\SupportAccessLog;
use App\Models\SupportExchangeCode;
use App\Models\Tenant;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * R0-1, R0-5: Platform support access controller.
 *
 * generateToken() now returns a one-time exchange code (60s TTL, hashed server-side)
 * instead of the bearer token directly. The frontend POSTs the code to
 * POST /auth/support/exchange (tenant-scoped) to obtain the actual token.
 *
 * This prevents the bearer token from appearing in URLs, browser history,
 * referrer headers, or server logs. (Fixes T-SEC-03)
 */
class SupportAccessController extends Controller
{
    /**
     * Generate a one-time exchange code for support access to a tenant.
     *
     * Protected by: platform.auth middleware (R0-1)
     * Returns: exchange code (not the bearer token)
     */
    public function generateToken(Request $request, string $tenantId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:5|max:255',
        ]);

        $tenant = Tenant::findOrFail($tenantId);

        // Platform actor resolved from platform.auth middleware.
        // R1-A9 will replace with real platform_users.
        $platformActorType = $request->attributes->get('platform_actor_type', 'platform_token');

        $platformUserId = (string) $request->attributes->get('platform_actor_id', 'platform_admin');

        // 1. Audit Log (Control DB)
        $log = SupportAccessLog::create([
            'platform_user_id' => $platformUserId,
            'tenant_id' => $tenant->id,
            'reason' => $validated['reason'],
            'ip_address' => $request->ip(),
            'accessed_at' => now(),
            'expires_at' => now()->addHours(2),
        ]);

        AuditLogger::log(
            action: 'support.access_code_issued',
            tenantId: $tenant->id,
            entityType: 'Tenant',
            entityId: $tenant->id,
            payload: ['reason' => $validated['reason'], 'expires_in_hours' => 2, 'log_id' => $log->id],
            actorType: $platformActorType,
            actorId: (string) $platformUserId,
        );

        // 2. Generate a one-time exchange code (plaintext returned once; hash stored)
        $plainCode = Str::random(64);
        $codeHash = hash('sha256', $plainCode);

        SupportExchangeCode::create([
            'code_hash' => $codeHash,
            'tenant_id' => $tenant->id,
            'actor_id' => $platformUserId,
            'actor_type' => $platformActorType,
            'reason' => $validated['reason'],
            'expires_at' => now()->addSeconds(60),  // 60s to exchange
        ]);

        // Return the exchange code — NOT the bearer token.
        // Frontend opens: /login?support_code={code}&tenant={slug}
        // The login page POSTs to POST /auth/support/exchange { code } (inside tenant middleware)
        return ApiResponse::success([
            'message' => 'Support exchange code issued. POST it to /auth/support/exchange within 60 seconds.',
            'tenant' => $tenant->slug,
            'support_code' => $plainCode,
            'support_code_ttl' => 60,
            'audit_log_id' => $log->id,
        ]);
    }
}
