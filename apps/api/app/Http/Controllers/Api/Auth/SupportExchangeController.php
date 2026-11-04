<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Http\Controllers\Controller;
use App\Models\SupportExchangeCode;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * R0-5: Exchange a one-time support code for a bearer token.
 *
 * Flow:
 *   Platform console → POST /tenants/{id}/support-access → gets exchange code
 *   Frontend opens /login?support_code={code}&tenant={slug}
 *   Login page → POST /auth/support/exchange { code } (tenant-scoped, no tenant.auth required)
 *   This endpoint validates the code, burns it, creates the support user + token, returns token.
 *
 * The bearer token is NEVER in a URL. (Fixes T-SEC-03)
 */
class SupportExchangeController extends Controller
{
    public function exchange(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|size:64',
        ]);

        $codeHash = hash('sha256', $validated['code']);

        // Look up in control DB
        $exchangeCode = SupportExchangeCode::where('code_hash', $codeHash)->first();

        if (! $exchangeCode) {
            return ApiResponse::error(
                'SUPPORT_CODE_INVALID',
                'Invalid or expired support exchange code.',
                Response::HTTP_UNAUTHORIZED
            );
        }

        if (! $exchangeCode->isValid()) {
            return ApiResponse::error(
                'SUPPORT_CODE_EXPIRED',
                'Support exchange code has expired or was already used.',
                Response::HTTP_UNAUTHORIZED
            );
        }

        // Verify tenant matches the current request tenant
        $currentTenant = $request->attributes->get('tenant');
        if ($currentTenant && $currentTenant->id !== $exchangeCode->tenant_id) {
            return ApiResponse::error(
                'SUPPORT_CODE_TENANT_MISMATCH',
                'Support code does not match this tenant.',
                Response::HTTP_UNAUTHORIZED
            );
        }

        // Burn the code immediately (single-use)
        $exchangeCode->update(['used_at' => now()]);

        // Create/find support user in the tenant DB and generate a bearer token
        $supportEmail = 'support@platform.local';

        $supportUser = TenantUser::firstOrCreate(
            ['email' => $supportEmail],
            [
                'name' => 'Platform Support',
                'password' => Hash::make(Str::random(32)),
                'type' => 'support',
                'status' => 'active',
            ]
        );

        $tokenData = TenantToken::createTokenFor($supportUser, 'support_token', 120);

        AuditLogger::log(
            action: 'support.token_issued',
            tenantId: $exchangeCode->tenant_id,
            entityType: 'TenantUser',
            entityId: $supportUser->id,
            payload: [
                'reason' => $exchangeCode->reason,
                'actor_id' => $exchangeCode->actor_id,
                'actor_type' => $exchangeCode->actor_type,
            ],
            actorType: $exchangeCode->actor_type,
            actorId: $exchangeCode->actor_id,
        );

        // Support access is temporary and visible to the tenant owner.
        $notifier = app(NotificationService::class);
        $notifier->send(NotificationCatalog::SUPPORT_SESSION_STARTED, $notifier->usersWithRole('owner'), [], '/admin/audit');

        return ApiResponse::success([
            'token' => $tokenData['plainTextToken'],
            'expires_at' => now()->addHours(2),
        ]);
    }
}
