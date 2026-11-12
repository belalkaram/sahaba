<?php

namespace App\Http\Controllers\Api\Me;

use App\Domain\Communication\AnnouncementService;
use App\Http\Controllers\Controller;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** OD-37: the recipient side — banner/modal announcements to show, and receipts. Only the person's own rows. */
class MyAnnouncementController extends Controller
{
    public function __construct(private readonly AnnouncementService $service) {}

    /** GET /me/announcements */
    public function index(Request $request): JsonResponse
    {
        return ApiResponse::success(['announcements' => $this->service->activeFor($this->user($request))->all()]);
    }

    /** POST /me/announcements/{id}/seen */
    public function seen(Request $request, string $id): JsonResponse
    {
        return $this->service->markSeen($this->user($request), $id)
            ? ApiResponse::success(['ok' => true])
            : ApiResponse::error('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found.', Response::HTTP_NOT_FOUND);
    }

    /** POST /me/announcements/{id}/dismiss — closed with ×. */
    public function dismiss(Request $request, string $id): JsonResponse
    {
        return $this->service->dismiss($this->user($request), $id)
            ? ApiResponse::success(['ok' => true])
            : ApiResponse::error('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found.', Response::HTTP_NOT_FOUND);
    }

    private function user(Request $request): TenantUser
    {
        /** @var TenantUser $user */
        $user = $request->user();

        return $user;
    }
}
