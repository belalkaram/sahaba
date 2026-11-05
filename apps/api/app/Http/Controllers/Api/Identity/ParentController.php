<?php

namespace App\Http\Controllers\Api\Identity;

use App\Domain\Identity\Services\UserManagementService;
use App\Http\Controllers\Controller;
use App\Models\ParentProfile;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ParentController extends Controller
{
    public function __construct(
        protected UserManagementService $userService
    ) {}

    /**
     * List all parents.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('parents.view') && ! $user->hasPermissionTo('parents.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to view parents.');
        }

        $parents = ParentProfile::with(['user', 'students.user'])->get();

        return ApiResponse::success(['parents' => $parents]);
    }

    /**
     * Show parent profile.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $isSelf = $user->parentProfile && $user->parentProfile->id === $id;
        $canManage = $user->hasPermissionTo('parents.view') || $user->hasPermissionTo('parents.manage');

        if (! $isSelf && ! $canManage) {
            throw new AuthorizationException('Forbidden. You do not have permission to view this parent.');
        }

        $parent = ParentProfile::with(['user', 'students.user'])->findOrFail($id);

        return ApiResponse::success(['parent' => $parent]);
    }

    /**
     * Create a new parent.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('parents.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage parents.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:30',
            'password' => 'nullable|string|min:6',
            'children' => 'nullable|array',
            'children.*.student_id' => 'required|string',
            'children.*.relation_type' => 'nullable|string|in:father,mother,guardian',
        ]);

        $parent = $this->userService->createParent($validated, $user);

        return ApiResponse::success(['parent' => $parent], Response::HTTP_CREATED);
    }

    /**
     * Link a child to a parent.
     */
    public function linkChild(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('parents.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage parent links.');
        }

        $parent = ParentProfile::findOrFail($id);

        $validated = $request->validate([
            'student_id' => 'required|string',
            'relation_type' => 'nullable|string|in:father,mother,guardian',
        ]);

        $this->userService->linkChild(
            $parent,
            $validated['student_id'],
            $validated['relation_type'] ?? 'guardian',
            $user
        );

        return ApiResponse::success([
            'parent' => $parent->fresh(['students.user']),
            'message' => 'Child linked successfully.',
        ]);
    }

    /**
     * Unlink a child from a parent.
     */
    public function unlinkChild(Request $request, string $id, string $studentId): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('parents.manage')) {
            throw new AuthorizationException('Forbidden. You do not have permission to manage parent links.');
        }

        $parent = ParentProfile::findOrFail($id);

        $this->userService->unlinkChild($parent, $studentId, $user);

        return ApiResponse::success([
            'parent' => $parent->fresh(['students.user']),
            'message' => 'Child unlinked successfully.',
        ]);
    }

    /**
     * Update WhatsApp opt-in status (OD-33).
     */
    public function setWhatsAppOptIn(Request $request, string $id): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $parent = ParentProfile::findOrFail($id);
        $isSelf = $user->parentProfile && $user->parentProfile->id === $id;
        $canManage = $user->hasPermissionTo('parents.manage');

        if (! $isSelf && ! $canManage) {
            throw new AuthorizationException('Forbidden. You do not have permission to change WhatsApp opt-in for this parent.');
        }

        $validated = $request->validate([
            'opt_in' => 'required|boolean',
        ]);

        $parent->update([
            'whatsapp_opt_in' => $validated['opt_in'],
            'whatsapp_opted_out_at' => $validated['opt_in'] ? null : now(),
        ]);

        return ApiResponse::success([
            'parent' => $parent->fresh(['user']),
            'message' => $validated['opt_in'] ? 'تم تفعيل استقبال رسائل الواتساب.' : 'تم إيقاف استقبال رسائل الواتساب.',
        ]);
    }
}
