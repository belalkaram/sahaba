<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\PlatformSetting;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformSettingsController extends Controller
{
    /**
     * GET /platform/settings
     */
    public function show(): JsonResponse
    {
        return ApiResponse::success($this->payload());
    }

    /**
     * PUT /platform/settings
     * OD-20: the one-click switch for demo accounts on the login page. Audited.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'demo_login_enabled' => 'required|boolean',
        ]);

        $actorId = (string) $request->attributes->get('platform_actor_id');

        PlatformSetting::setValue(PlatformSetting::DEMO_LOGIN_ENABLED, $validated['demo_login_enabled'], $actorId);

        AuditLogger::log(
            action: 'platform.settings.updated',
            entityType: 'PlatformSetting',
            entityId: PlatformSetting::DEMO_LOGIN_ENABLED,
            payload: $validated,
            actorType: (string) $request->attributes->get('platform_actor_type'),
            actorId: $actorId
        );

        return ApiResponse::success($this->payload());
    }

    /**
     * GET /platform/contact-messages
     */
    public function contactMessages(Request $request): JsonResponse
    {
        $perPage = min((int) $request->query('per_page', 25), 100);
        $paginator = ContactMessage::query()->orderByDesc('created_at')->paginate($perPage);

        return ApiResponse::success([
            'messages' => $paginator->items(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    /**
     * POST /platform/contact-messages/{id}/handled
     */
    public function markHandled(Request $request, int $id): JsonResponse
    {
        $message = ContactMessage::query()->findOrFail($id);
        $message->update(['status' => 'handled', 'handled_at' => now()]);

        AuditLogger::log(
            action: 'contact_message.handled',
            entityType: 'ContactMessage',
            entityId: (string) $message->id,
            actorType: (string) $request->attributes->get('platform_actor_type'),
            actorId: (string) $request->attributes->get('platform_actor_id')
        );

        return ApiResponse::success(['message' => $message]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'demo_login_enabled' => (bool) PlatformSetting::getValue(PlatformSetting::DEMO_LOGIN_ENABLED, false),
        ];
    }
}
