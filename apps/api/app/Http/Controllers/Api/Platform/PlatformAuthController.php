<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformToken;
use App\Models\PlatformUser;
use App\Models\SupportAccessLog;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * PlatformAuthController (R1-A9)
 *
 * Handles control-plane platform user authentication and support session termination.
 */
class PlatformAuthController extends Controller
{
    /**
     * POST /platform/auth/login
     * Authenticate platform user and issue platform bearer token.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = PlatformUser::with('roles')
            ->where('email', strtolower(trim($validated['email'])))
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return ApiResponse::error(
                'INVALID_CREDENTIALS',
                'Invalid email or password.',
                Response::HTTP_UNAUTHORIZED
            );
        }

        if (! $user->isActive()) {
            return ApiResponse::error(
                'USER_INACTIVE',
                'Platform account is suspended.',
                Response::HTTP_FORBIDDEN
            );
        }

        $tokenResult = $user->createToken();

        AuditLogger::log(
            action: 'platform.login',
            actorType: 'platform_user',
            actorId: (string) $user->id,
            actorEmail: $user->email,
        );

        return ApiResponse::success([
            'token' => $tokenResult['plainTextToken'],
            'token_type' => 'Bearer',
            'expires_at' => $tokenResult['token']->expires_at?->toIso8601String(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'roles' => $user->roles->map(fn ($r) => [
                    'name' => $r->name,
                    'label' => $r->label,
                ]),
            ],
        ]);
    }

    /**
     * GET /platform/auth/me
     * Return authenticated platform user and roles.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var PlatformUser|null $user */
        $user = $request->attributes->get('platform_user');

        if ($user) {
            $user->loadMissing('roles');

            return ApiResponse::success([
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'roles' => $user->roles->map(fn ($r) => [
                    'name' => $r->name,
                    'label' => $r->label,
                ]),
            ]);
        }

        // Static token actor fallback
        return ApiResponse::success([
            'id' => null,
            'name' => 'Platform Administrator (Token)',
            'email' => 'platform-admin@system.local',
            'status' => 'active',
            'roles' => [
                ['name' => 'super_admin', 'label' => 'مدير المنصة العام'],
            ],
        ]);
    }

    /**
     * POST /platform/auth/logout
     * Revoke active platform bearer token.
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var PlatformToken|null $token */
        $token = $request->attributes->get('platform_token');

        if ($token) {
            $token->delete();
        }

        return ApiResponse::success(['message' => 'Platform session ended successfully.']);
    }

    /**
     * POST /platform/support-sessions/{id}/end
     * Terminate an active support session immediately.
     */
    public function endSupportSession(Request $request, string $id): JsonResponse
    {
        $session = SupportAccessLog::findOrFail($id);

        $session->end();

        AuditLogger::log(
            action: 'platform.support_session_ended',
            tenantId: $session->tenant_id,
            entityType: 'SupportAccessLog',
            entityId: $session->id,
            payload: [
                'ended_at' => $session->ended_at?->toIso8601String(),
            ]
        );

        return ApiResponse::success([
            'id' => $session->id,
            'status' => $session->status,
            'ended_at' => $session->ended_at?->toIso8601String(),
            'message' => 'Support session ended successfully.',
        ]);
    }
}
