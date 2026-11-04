<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Authorization\Services\AuthPayloadBuilder;
use App\Http\Controllers\Controller;
use App\Models\AccessCredential;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class LoginController extends Controller
{
    /**
     * Authenticate user within the active tenant context.
     * Enforces configurable tenant authentication models (Phase B BR-013):
     * - 'password': only email/phone + password allowed
     * - 'coupon': only access credential coupon allowed
     * - 'hybrid': both methods allowed (default)
     */
    public function __invoke(Request $request, TenantContext $tenantContext): JsonResponse
    {
        $tenant = $tenantContext->getTenantOrFail();
        $authMode = $tenant->auth_mode ?? 'hybrid';

        // Coupon Login Flow
        if ($request->filled('coupon_code')) {
            if ($authMode === 'password') {
                return ApiResponse::error(
                    code: 'AUTH_MODE_COUPON_DISABLED',
                    message: 'Coupon authentication is disabled for this organization.',
                    status: Response::HTTP_FORBIDDEN
                );
            }

            $validated = $request->validate([
                'coupon_code' => 'required|string',
                'secret' => 'required|string',
                'device_id' => 'required|string',
                'device_fingerprint' => 'required|string',
            ]);

            $credential = AccessCredential::with(['student.user', 'deviceBinding'])
                ->where('credential_code', $validated['coupon_code'])
                ->first();

            if (! $credential) {
                return ApiResponse::error('CREDENTIAL_NOT_FOUND', 'Coupon code not found.', Response::HTTP_NOT_FOUND);
            }

            if ($credential->isRevoked()) {
                return ApiResponse::error('CREDENTIAL_REVOKED', 'This coupon has been revoked.', Response::HTTP_FORBIDDEN);
            }

            if ($credential->isExpired()) {
                return ApiResponse::error('CREDENTIAL_EXPIRED', 'This coupon has expired.', Response::HTTP_FORBIDDEN);
            }

            if (! $credential->verifySecret($validated['secret'])) {
                return ApiResponse::error('INVALID_CREDENTIAL_SECRET', 'Invalid coupon secret.', Response::HTTP_UNAUTHORIZED);
            }

            // First use: the secret was just verified, the same proof POST /credentials/{id}/activate asks for.
            if ($credential->status === 'pending') {
                $credential->update(['status' => 'active', 'activated_at' => now()]);
            }

            if ($credential->status !== 'active') {
                return ApiResponse::error('CREDENTIAL_NOT_ACTIVE', 'Coupon is not yet active.', Response::HTTP_FORBIDDEN);
            }

            // Enforce single-device binding
            $currentBinding = $credential->deviceBinding;
            if (! $currentBinding) {
                $currentBinding = $credential->bindDevice($validated['device_id'], $validated['device_fingerprint']);
            } elseif (! $currentBinding->matchesDevice($validated['device_id'], $validated['device_fingerprint'])) {
                return ApiResponse::error(
                    'SECOND_DEVICE_PROHIBITED',
                    'Access denied. This coupon is bound to another device.',
                    Response::HTTP_FORBIDDEN
                );
            }

            $user = $credential->student->user;
            if (! $user || ! $user->isActive()) {
                return ApiResponse::error('USER_INACTIVE', 'Student account is suspended or inactive.', Response::HTTP_FORBIDDEN);
            }

            $tokenResult = TenantToken::createTokenFor($user, 'coupon_session');
            $authPayload = AuthPayloadBuilder::build($user, $tenant, $tokenResult['token']);

            return ApiResponse::success(array_merge([
                'token' => $tokenResult['plainTextToken'],
                'token_type' => 'Bearer',
                'auth_method' => 'coupon',
            ], $authPayload));
        }

        // Standard Password Login Flow
        if ($authMode === 'coupon') {
            return ApiResponse::error(
                code: 'AUTH_MODE_PASSWORD_DISABLED',
                message: 'Password login is disabled for this organization. Please use your coupon code.',
                status: Response::HTTP_FORBIDDEN
            );
        }

        $validated = $request->validate([
            'identifier' => 'required|string',
            'password' => 'required|string',
        ]);

        $identifier = trim($validated['identifier']);

        $user = TenantUser::with(['roles.permissions', 'student', 'staff', 'parentProfile'])
            ->where(function ($query) use ($identifier) {
                $query->where('email', $identifier)
                    ->orWhere('phone', $identifier);
            })
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return ApiResponse::error(
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid login identifier or password.',
                status: Response::HTTP_UNAUTHORIZED
            );
        }

        if (! $user->isActive()) {
            return ApiResponse::error(
                code: 'USER_INACTIVE',
                message: 'Your account is suspended or pending verification.',
                status: Response::HTTP_FORBIDDEN
            );
        }

        $tokenResult = TenantToken::createTokenFor($user);
        $authPayload = AuthPayloadBuilder::build($user, $tenant, $tokenResult['token']);

        return ApiResponse::success(array_merge([
            'token' => $tokenResult['plainTextToken'],
            'token_type' => 'Bearer',
            'auth_method' => 'password',
        ], $authPayload));
    }
}
