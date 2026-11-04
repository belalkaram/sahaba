<?php

namespace App\Http\Controllers\Api\Education;

use App\Domain\Media\Services\ProfileImageService;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Staff;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\AbacEngine;
use App\Support\Authorization\ScopeResolver;
use App\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Course cover images and teacher photo / public profile (opt-in visibility). */
class ProfileImageController extends Controller
{
    public function __construct(
        protected ProfileImageService $images,
        protected TenantContext $context
    ) {}

    public function storeCourseCover(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);
        $this->authorizeCourse($request->user(), $course);

        $request->validate([
            'image' => 'required|file|image|mimes:'.ProfileImageService::MIMES.'|max:'.ProfileImageService::MAX_KB,
        ]);

        $slug = $this->context->getTenantOrFail()->slug;
        $course->update(['cover_path' => $this->images->store($request->file('image'), $slug, 'courses', $course->cover_path)]);

        AuditLogger::log('course.cover.updated', null, 'course', $course->id);

        return ApiResponse::success(['course' => $course->fresh()]);
    }

    public function destroyCourseCover(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);
        $this->authorizeCourse($request->user(), $course);

        $this->images->delete($course->cover_path, $this->context->getTenantOrFail()->slug);
        $course->update(['cover_path' => null]);

        AuditLogger::log('course.cover.removed', null, 'course', $course->id);

        return ApiResponse::success(['course' => $course->fresh()]);
    }

    /** Authenticated preview (an <img> cannot send the bearer token, so the client fetches it as a blob). */
    public function showCourseCover(string $id)
    {
        $course = Course::findOrFail($id);

        return $this->images->response($course->cover_path, $this->context->getTenantOrFail()->slug)
            ?? ApiResponse::error('IMAGE_NOT_FOUND', 'No image.', 404);
    }

    public function showStaffPhoto(string $id)
    {
        $staff = Staff::findOrFail($id);

        return $this->images->response($staff->photo_path, $this->context->getTenantOrFail()->slug)
            ?? ApiResponse::error('IMAGE_NOT_FOUND', 'No image.', 404);
    }

    public function showStaffProfile(Request $request, string $id): JsonResponse
    {
        $staff = Staff::findOrFail($id);
        $this->authorizeStaff($request->user(), $staff);

        return ApiResponse::success(['profile' => [
            'id' => $staff->id,
            'headline' => $staff->headline,
            'public_bio' => $staff->public_bio,
            'is_public' => (bool) $staff->is_public,
            'has_photo' => (bool) $staff->photo_path,
        ]]);
    }

    public function updateStaffProfile(Request $request, string $id): JsonResponse
    {
        $staff = Staff::findOrFail($id);
        $this->authorizeStaff($request->user(), $staff);

        $validated = $request->validate([
            'headline' => 'nullable|string|max:160',
            'public_bio' => 'nullable|string|max:2000',
            'is_public' => 'sometimes|boolean',
        ]);

        $staff->update($validated);

        AuditLogger::log('staff.public_profile.updated', null, 'staff', $staff->id, ['is_public' => $staff->is_public]);

        return ApiResponse::success(['staff' => $staff->fresh()->load('user')]);
    }

    public function storeStaffPhoto(Request $request, string $id): JsonResponse
    {
        $staff = Staff::findOrFail($id);
        $this->authorizeStaff($request->user(), $staff);

        $request->validate([
            'image' => 'required|file|image|mimes:'.ProfileImageService::MIMES.'|max:'.ProfileImageService::MAX_KB,
        ]);

        $slug = $this->context->getTenantOrFail()->slug;
        $staff->update(['photo_path' => $this->images->store($request->file('image'), $slug, 'staff', $staff->photo_path)]);

        AuditLogger::log('staff.photo.updated', null, 'staff', $staff->id);

        return ApiResponse::success(['staff' => $staff->fresh()->load('user')]);
    }

    public function destroyStaffPhoto(Request $request, string $id): JsonResponse
    {
        $staff = Staff::findOrFail($id);
        $this->authorizeStaff($request->user(), $staff);

        $this->images->delete($staff->photo_path, $this->context->getTenantOrFail()->slug);
        $staff->update(['photo_path' => null]);

        AuditLogger::log('staff.photo.removed', null, 'staff', $staff->id);

        return ApiResponse::success(['staff' => $staff->fresh()->load('user')]);
    }

    protected function authorizeCourse(TenantUser $user, Course $course): void
    {
        $permission = 'courses.update';
        if (! $user->hasPermissionTo($permission) || ! app(AbacEngine::class)->authorize($user, $permission, $course)) {
            throw new AuthorizationException('Forbidden.');
        }
        if (ScopeResolver::resolveScope($user, $permission) === 'own'
            && (! $user->staff || $course->teacher_staff_id !== $user->staff->id)) {
            throw new AuthorizationException('You can only modify courses that belong to you.');
        }
    }

    /** A teacher manages their own profile; administrators with staff.manage manage anyone's. */
    protected function authorizeStaff(TenantUser $user, Staff $staff): void
    {
        $isSelf = $user->staff && $user->staff->id === $staff->id;
        if (! $isSelf && ! $user->hasPermissionTo('staff.manage')) {
            throw new AuthorizationException('Forbidden.');
        }
    }
}
