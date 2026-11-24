<?php

namespace App\Domain\Integrations\Google;

use App\Domain\Integrations\Exceptions\ProviderException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Google OAuth 2.0 endpoints (ADR-008). Plain HTTP so tests can fake Google at the HTTP layer.
 */
class GoogleOAuthClient
{
    public const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

    public const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    public const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

    public const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    public function isConfigured(): bool
    {
        return filled(config('services.google.client_id')) && filled(config('services.google.client_secret'));
    }

    /** @param  array<int, string>|null  $scopes  defaults to the tenant connection scopes (ADR-008) */
    public function authorizationUrl(string $state, ?array $scopes = null): string
    {
        return self::AUTH_URL.'?'.http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect_uri'),
            'response_type' => 'code',
            'scope' => implode(' ', $scopes ?? config('services.google.scopes', [])),
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state,
        ]);
    }

    /**
     * @return array{access_token: string, refresh_token: ?string, expires_in: int, scope: string}
     */
    public function exchangeCode(string $code): array
    {
        $response = $this->post(self::TOKEN_URL, [
            'code' => $code,
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => config('services.google.redirect_uri'),
            'grant_type' => 'authorization_code',
        ]);

        return $this->tokenPayload($response);
    }

    /**
     * @return array{access_token: string, refresh_token: ?string, expires_in: int, scope: string}
     *
     * @throws GoogleNotConnectedException when Google no longer accepts the refresh token
     */
    public function refresh(string $refreshToken): array
    {
        $response = $this->post(self::TOKEN_URL, [
            'refresh_token' => $refreshToken,
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'grant_type' => 'refresh_token',
        ]);

        if ($response->status() === 400 && $response->json('error') === 'invalid_grant') {
            throw new GoogleNotConnectedException('Google refused the stored authorisation (invalid_grant).');
        }

        return $this->tokenPayload($response);
    }

    public function accountEmail(string $accessToken): ?string
    {
        try {
            $response = Http::withToken($accessToken)->acceptJson()->timeout(15)->get(self::USERINFO_URL);
        } catch (ConnectionException $e) {
            throw new ProviderException('Google userinfo request failed.', 'google', 0, $e);
        }

        return $response->successful() ? $response->json('email') : null;
    }

    /** Best effort: the local row is deleted even when Google cannot be reached. */
    public function revoke(string $token): bool
    {
        try {
            return Http::asForm()->timeout(10)->post(self::REVOKE_URL, ['token' => $token])->successful();
        } catch (ConnectionException) {
            return false;
        }
    }

    private function post(string $url, array $form): Response
    {
        try {
            return Http::asForm()->acceptJson()->timeout(15)->post($url, $form);
        } catch (ConnectionException $e) {
            throw new ProviderException('Google token endpoint could not be reached.', 'google', 0, $e);
        }
    }

    /**
     * @return array{access_token: string, refresh_token: ?string, expires_in: int, scope: string}
     */
    private function tokenPayload(Response $response): array
    {
        if (! $response->successful() || ! is_string($response->json('access_token'))) {
            // Google's error code only — never the request body, which carries the client secret.
            throw new ProviderException('Google token request failed: '.($response->json('error') ?? $response->status()), 'google');
        }

        return [
            'access_token' => $response->json('access_token'),
            'refresh_token' => $response->json('refresh_token'),
            'expires_in' => (int) ($response->json('expires_in') ?? 3600),
            'scope' => (string) ($response->json('scope') ?? ''),
        ];
    }
}
