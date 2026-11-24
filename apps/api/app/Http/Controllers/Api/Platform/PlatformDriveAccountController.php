<?php

namespace App\Http\Controllers\Api\Platform;

use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Google\Drive\DrivePool;
use App\Domain\Integrations\Google\GoogleNotConnectedException;
use App\Domain\Integrations\Google\GoogleOAuthClient;
use App\Http\Controllers\Controller;
use App\Models\PlatformDriveAccount;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Super admin: the Google Drive accounts that store academies' videos (ADR-009). Tokens are never returned.
 */
class PlatformDriveAccountController extends Controller
{
    public function __construct(private readonly DrivePool $pool) {}

    public function index(GoogleOAuthClient $oauth): JsonResponse
    {
        $accounts = PlatformDriveAccount::query()->orderBy('priority')->orderBy('created_at')->get();

        return ApiResponse::success([
            'configured' => $oauth->isConfigured(),
            'margin_bytes' => (int) config('services.google.pool_margin_bytes'),
            'accounts' => $accounts->map(fn (PlatformDriveAccount $a) => $this->present($a))->values(),
        ]);
    }

    public function connect(Request $request, GoogleOAuthClient $oauth): JsonResponse
    {
        if (! $oauth->isConfigured()) {
            return ApiResponse::error('GOOGLE_NOT_CONFIGURED', 'لم تُضبط بيانات Google على الخادم.', Response::HTTP_SERVICE_UNAVAILABLE);
        }

        [$actorId, $actorType] = $this->actor($request);

        return ApiResponse::success(['authorization_url' => $this->pool->authorizationUrl($actorId, $actorType)]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $account = PlatformDriveAccount::query()->findOrFail($id);
        $validated = $request->validate([
            'accepting_uploads' => 'sometimes|boolean',
            'priority' => 'sometimes|integer|min:0|max:100000',
        ]);

        if (($validated['accepting_uploads'] ?? false) && $account->status !== PlatformDriveAccount::CONNECTED) {
            return ApiResponse::error('ACCOUNT_NOT_CONNECTED', 'أعد ربط الحساب أولاً.', Response::HTTP_CONFLICT);
        }

        $account->forceFill($validated)->save();
        [$actorId, $actorType] = $this->actor($request);
        AuditLogger::log('platform.drive_account.updated', null, 'platform_drive_account', $account->id, $validated, $actorType, $actorId);

        return ApiResponse::success(['account' => $this->present($account)]);
    }

    public function refreshQuota(string $id): JsonResponse
    {
        $account = PlatformDriveAccount::query()->findOrFail($id);

        try {
            $this->pool->refreshQuota($account);
        } catch (GoogleNotConnectedException) {
            return ApiResponse::error('ACCOUNT_NOT_CONNECTED', 'رفض Google صلاحية هذا الحساب. أعد ربطه.', Response::HTTP_CONFLICT);
        } catch (ProviderException $e) {
            return ApiResponse::error('PROVIDER_ERROR', $e->getMessage(), Response::HTTP_BAD_GATEWAY);
        }

        return ApiResponse::success(['account' => $this->present($account->refresh())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $account = PlatformDriveAccount::query()->findOrFail($id);
        if ($account->reservedBytes() > 0) {
            return ApiResponse::error('UPLOADS_IN_PROGRESS', 'توجد عمليات رفع جارية على هذا الحساب. أوقف الرفع الجديد وانتظر انتهاءها.', Response::HTTP_CONFLICT);
        }

        [$actorId, $actorType] = $this->actor($request);
        $this->pool->disconnect($account, $actorId, $actorType);

        return ApiResponse::success(['account' => $this->present($account->refresh())]);
    }

    /** @return array<string, mixed> */
    private function present(PlatformDriveAccount $account): array
    {
        return [
            'id' => $account->id,
            'account_email' => $account->account_email,
            'status' => $account->status,
            'accepting_uploads' => $account->accepting_uploads,
            'priority' => $account->priority,
            'quota_limit_bytes' => $account->quota_limit_bytes,
            'quota_usage_bytes' => $account->quota_usage_bytes,
            'reserved_bytes' => $account->reservedBytes(),
            'free_bytes' => $account->freeBytes(),
            'quota_checked_at' => $account->quota_checked_at?->toIso8601String(),
            'connected_at' => $account->connected_at?->toIso8601String(),
            'last_error' => $account->last_error,
        ];
    }

    /** @return array{0: string, 1: string} */
    private function actor(Request $request): array
    {
        return [
            (string) $request->attributes->get('platform_actor_id'),
            (string) ($request->attributes->get('platform_actor_type') ?: 'platform_admin'),
        ];
    }
}
