<?php

namespace App\Http\Middleware;

use App\Models\TenantToken;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantAuthenticate
{
    /**
     * Handle an incoming request requiring tenant authentication.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $bearerToken = $request->bearerToken();

        if (! $bearerToken) {
            throw new AuthenticationException('Unauthenticated. Missing bearer token.');
        }

        $tokenRecord = TenantToken::findToken($bearerToken);

        if (! $tokenRecord || ! $tokenRecord->user) {
            throw new AuthenticationException('Unauthenticated. Invalid or expired token.');
        }

        $user = $tokenRecord->user;

        if (! $user->isActive()) {
            throw new AuthorizationException('User account is suspended or inactive.');
        }

        // "Last used" has minute resolution: skipping the write on bursts saves a network round trip per request.
        if ($tokenRecord->last_used_at === null || $tokenRecord->last_used_at->diffInSeconds(now()) >= 60) {
            $tokenRecord->update(['last_used_at' => now()]);
        }

        // Bind user to request
        $request->setUserResolver(fn () => $user);
        $request->attributes->set('tenant_user', $user);
        $request->attributes->set('tenant_token', $tokenRecord);
        auth()->setUser($user);

        return $next($request);
    }
}
