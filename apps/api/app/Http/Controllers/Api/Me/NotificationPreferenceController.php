<?php

namespace App\Http\Controllers\Api\Me;

use App\Domain\Communication\NotificationCatalog;
use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationPreferenceController extends Controller
{
    /**
     * GET /me/notification-preferences
     */
    public function show(Request $request): JsonResponse
    {
        return ApiResponse::success(['preferences' => $this->payload($request->user())]);
    }

    /**
     * PUT /me/notification-preferences
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preferences' => 'required|array|min:1',
            'preferences.*.event' => ['required', 'string', Rule::in(array_keys(NotificationCatalog::all()))],
            'preferences.*.in_app' => 'required|boolean',
            'preferences.*.mail' => 'required|boolean',
        ]);

        /** @var TenantUser $user */
        $user = $request->user();

        foreach ($validated['preferences'] as $item) {
            NotificationPreference::updateOrCreate(
                ['user_id' => $user->id, 'event_key' => $item['event']],
                ['in_app' => $item['in_app'], 'mail' => $item['mail']]
            );
        }

        return ApiResponse::success(['preferences' => $this->payload($user)]);
    }

    /**
     * @return array<int, array{event: string, label: string, in_app: bool, mail: bool}>
     */
    private function payload(TenantUser $user): array
    {
        $saved = NotificationPreference::where('user_id', $user->id)->get()->keyBy('event_key');

        return collect(NotificationCatalog::all())
            ->map(fn (array $template, string $event) => [
                'event' => $event,
                'label' => $template['label'],
                'in_app' => $saved->get($event)?->in_app ?? true,
                'mail' => $saved->get($event)?->mail ?? $template['mail'],
            ])
            ->values()
            ->all();
    }
}
