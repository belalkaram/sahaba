<?php

namespace App\Http\Controllers\Api\Education;

use App\Domain\Billing\Services\ContentAccessPolicy;
use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\LessonMaterial;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use App\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class LessonMaterialController extends Controller
{
    /**
     * Authorize material management based on course ownership.
     */
    protected function authorizeMaterialManage(TenantUser $user, Lesson $lesson): void
    {
        if (! $user->hasPermissionTo('materials.manage')) {
            throw new AuthorizationException('You do not have permission to manage lesson materials.');
        }

        $scope = ScopeResolver::resolveScope($user, 'materials.manage');
        if ($scope === 'own') {
            if (! $user->staff || $lesson->course->teacher_staff_id !== $user->staff->id) {
                throw new AuthorizationException('You can only manage materials in your own courses.');
            }
        }
    }

    /**
     * Add material to a lesson (file or external link).
     */
    public function store(Request $request, string $lessonId, TenantContext $tenantContext): JsonResponse
    {
        $lesson = Lesson::with('course')->findOrFail($lessonId);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeMaterialManage($user, $lesson);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'kind' => 'required|string|in:file,link',
            'file' => 'required_if:kind,file|file|max:20480', // 20MB limit
            'url' => 'required_if:kind,link|nullable|url|max:1000',
            'sort_order' => 'nullable|integer',
        ]);

        $storagePath = null;
        $mime = null;
        $size = null;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $tenant = $tenantContext->getTenant();
            $tenantSlug = $tenant ? $tenant->slug : 'default';
            $storagePath = $file->store('tenants/'.$tenantSlug.'/materials', 'local');
            $mime = $file->getClientMimeType();
            $size = $file->getSize();
        }

        $maxOrder = $lesson->materials()->max('sort_order') ?? 0;

        $material = $lesson->materials()->create([
            'title' => $validated['title'],
            'kind' => $validated['kind'],
            'storage_path' => $storagePath,
            'url' => $validated['url'] ?? null,
            'mime' => $mime,
            'size' => $size,
            'sort_order' => $validated['sort_order'] ?? ($maxOrder + 1),
        ]);

        return ApiResponse::success(['material' => $material], Response::HTTP_CREATED);
    }

    /**
     * Download or view lesson material (protected by ContentAccessPolicy).
     */
    public function download(Request $request, string $id, ContentAccessPolicy $policy)
    {
        $material = LessonMaterial::with(['lesson.course'])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        // Check content access policy on lesson
        $decision = $policy->canAccessLesson($user, $material->lesson);
        if (! $decision->isAllowed()) {
            if ($user->student) {
                return ApiResponse::error(
                    'ACCESS_REQUIRES_SUBSCRIPTION',
                    'Access to this material requires an active subscription for the course.',
                    Response::HTTP_FORBIDDEN
                );
            }
            throw new AuthorizationException('You are not authorized to download this material.');
        }

        if ($material->kind === 'link' && $material->url) {
            return redirect()->away($material->url);
        }

        if (! $material->storage_path || ! Storage::disk('local')->exists($material->storage_path)) {
            return ApiResponse::error('FILE_NOT_FOUND', 'Material file not found on server.', Response::HTTP_NOT_FOUND);
        }

        return Storage::disk('local')->download(
            $material->storage_path,
            $material->title.'.'.pathinfo($material->storage_path, PATHINFO_EXTENSION)
        );
    }

    /**
     * Delete a lesson material.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $material = LessonMaterial::with(['lesson.course'])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();
        $this->authorizeMaterialManage($user, $material->lesson);

        if ($material->storage_path && Storage::disk('local')->exists($material->storage_path)) {
            Storage::disk('local')->delete($material->storage_path);
        }

        $material->delete();

        return ApiResponse::success(['message' => 'Material deleted successfully.']);
    }
}
