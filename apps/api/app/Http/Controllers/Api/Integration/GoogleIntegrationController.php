<?php

namespace App\Http\Controllers\Api\Integration;

use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Google\Drive\DrivePool;
use App\Domain\Integrations\Google\GoogleConnectionService;
use App\Domain\Integrations\Google\GoogleOAuthStates;
use App\Http\Controllers\Controller;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * The tenant's Google connection (OD-3, ADR-008). Connect/status/disconnect need `tenant.settings`;
 * the callback is public because Google calls it, and it trusts only the single-use state.
 */
class GoogleIntegrationController extends Controller
{
    public function __construct(
        private readonly GoogleConnectionService $google,
        private readonly GoogleOAuthStates $states,
        private readonly DrivePool $pool,
    ) {}

    public function show(): JsonResponse
    {
        return ApiResponse::success(['google' => $this->google->status()]);
    }

    public function connect(Request $request, TenantContext $context): JsonResponse
    {
        if (! $this->google->isConfigured()) {
            return ApiResponse::error('GOOGLE_NOT_CONFIGURED', 'لم تُضبط بيانات Google على الخادم.', Response::HTTP_SERVICE_UNAVAILABLE);
        }

        /** @var TenantUser $user */
        $user = $request->user();

        return ApiResponse::success([
            'authorization_url' => $this->google->authorizationUrl($context->getTenantOrFail(), $user),
        ]);
    }

    public function callback(Request $request): RedirectResponse
    {
        $state = (string) $request->query('state', '');
        $code = (string) $request->query('code', '');

        if ($request->query('error') !== null) {
            return $this->backToApp('error', 'denied');
        }
        if ($state === '' || $code === '') {
            return $this->backToApp('error', 'state');
        }

        $pending = $this->states->pull($state);
        if ($pending === null) {
            return $this->backToApp('error', 'state');
        }
        $returnUrl = $pending['kind'] === GoogleOAuthStates::POOL
            ? config('services.google.pool_return_url')
            : config('services.google.connect_return_url');

        try {
            if ($pending['kind'] === GoogleOAuthStates::POOL) {
                $this->pool->completeAuthorization($pending, $code);

                return $this->backToApp('connected', null, $returnUrl);
            }
            $tenant = $this->google->completeAuthorization($pending, $code);
        } catch (ProviderException $e) {
            Log::warning('Google OAuth callback failed', ['kind' => $pending['kind'], 'message' => $e->getMessage()]);

            return $this->backToApp('error', 'exchange', $returnUrl);
        }

        return $tenant ? $this->backToApp('connected', null, $returnUrl) : $this->backToApp('error', 'state', $returnUrl);
    }

    public function destroy(): JsonResponse
    {
        if (! $this->google->disconnect()) {
            return ApiResponse::error('GOOGLE_NOT_CONNECTED', 'لا يوجد حساب Google مرتبط.', Response::HTTP_NOT_FOUND);
        }

        return ApiResponse::success(['google' => $this->google->status()]);
    }

    private function backToApp(string $result, ?string $reason = null, ?string $url = null): RedirectResponse
    {
        $query = http_build_query(array_filter(['google' => $result, 'reason' => $reason]));

        return redirect()->away(($url ?? config('services.google.connect_return_url')).'?'.$query);
    }
}
