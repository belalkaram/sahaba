<?php

namespace App\Http\Middleware;

use App\Models\PlatformToken;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Platform authentication middleware (R1-A9).
 *
 * Authenticates platform administrators and operations engineers against the Control DB:
 *  1. Checks `platform_tokens` for active, unexpired tokens.
 *  2. Fallback: validates static PLATFORM_ADMIN_TOKEN from environment (for automated tests and CI).
 *  3. On success, binds platform user and token attributes to the request.
 */
class PlatformAuthenticate
{
    public function handle(Request $request, Closure $next): Response|JsonResponse
    {
        $bearer = $request->bearerToken();

        if (! $bearer) {
            return ApiResponse::error(
                'PLATFORM_TOKEN_REQUIRED',
                'Platform authentication token is required.',
                Response::HTTP_UNAUTHORIZED
            );
        }

        // 1. Try real platform token in Control DB
        $tokenRecord = PlatformToken::findToken($bearer);

        if ($tokenRecord && $tokenRecord->user && $tokenRecord->user->isActive()) {
            $tokenRecord->update(['last_used_at' => now()]);

            $request->setUserResolver(fn () => $tokenRecord->user);
            $request->attributes->set('platform_user', $tokenRecord->user);
            $request->attributes->set('platform_token', $tokenRecord);
            $request->attributes->set('platform_actor_type', 'platform_user');
            $request->attributes->set('platform_actor_id', (string) $tokenRecord->user->id);

            return $next($request);
        }

        // 2. Fallback to static configured token (for CI / backward-compatible tests)
        $configuredToken = config('platform.admin_token', '');
        if (! empty($configuredToken) && hash_equals($configuredToken, $bearer)) {
            $request->attributes->set('platform_actor_type', 'platform_token');
            $request->attributes->set('platform_actor_id', 'platform_admin');

            return $next($request);
        }

        return ApiResponse::error(
            'PLATFORM_TOKEN_INVALID',
            'Invalid or expired platform authentication token.',
            Response::HTTP_UNAUTHORIZED
        );
    }
}
