<?php

namespace App\Http\Controllers\Api\Public;

use App\Domain\Media\Services\ProfileImageService;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Staff;
use App\Support\ApiResponse;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Unauthenticated, tenant-scoped landing data. Only opt-in content is exposed (published + is_public
 * courses, is_public teachers) and only marketing fields — never contact details or user ids.
 */
class PublicAcademyController extends Controller
{
    public function __construct(
        protected ProfileImageService $images,
        protected TenantContext $context
    ) {}

    public function courses(): JsonResponse
    {
        $courses = $this->listedCourses()->with('teacher.user')->orderByDesc('published_at')->get();

        return ApiResponse::success(['courses' => $courses->map(fn (Course $c) => $this->courseCard($c))->values()]);
    }

    public function course(string $id): JsonResponse
    {
        $course = $this->listedCourses()->with(['teacher.user', 'modules'])->findOrFail($id);

        return ApiResponse::success(['course' => $this->courseCard($course) + [
            'description' => $course->description,
            'modules' => $course->modules->map(fn ($m) => ['title' => $m->title])->values(),
            'lesson_count' => $course->lessons()->count(),
        ]]);
    }

    public function teachers(): JsonResponse
    {
        $teachers = $this->listedTeachers()->with('user')->withCount([
            'courses as public_courses_count' => fn ($q) => $q->where('status', 'published')->where('is_public', true),
        ])->get();

        return ApiResponse::success(['teachers' => $teachers->map(fn (Staff $s) => $this->teacherCard($s))->values()]);
    }

    public function teacher(string $id): JsonResponse
    {
        $teacher = $this->listedTeachers()->with('user')->findOrFail($id);
        $courses = $this->listedCourses()->where('teacher_staff_id', $teacher->id)->with('teacher.user')->get();

        return ApiResponse::success(['teacher' => $this->teacherCard($teacher) + [
            'bio' => $teacher->public_bio,
            'courses' => $courses->map(fn (Course $c) => $this->courseCard($c))->values(),
        ]]);
    }

    public function courseImage(string $id)
    {
        return $this->image($this->listedCourses()->findOrFail($id)->cover_path);
    }

    public function teacherImage(string $id)
    {
        return $this->image($this->listedTeachers()->findOrFail($id)->photo_path);
    }

    public function logo()
    {
        $tenant = $this->context->getTenantOrFail();
        $logoPath = $tenant->brand_settings['logo_path'] ?? null;

        return $this->image($logoPath);
    }

    protected function image(?string $path)
    {
        $response = $this->images->response($path, $this->context->getTenantOrFail()->slug);

        return $response ?? ApiResponse::error('IMAGE_NOT_FOUND', 'No image.', Response::HTTP_NOT_FOUND);
    }

    protected function listedCourses()
    {
        return Course::query()->where('status', 'published')->where('is_public', true);
    }

    protected function listedTeachers()
    {
        return Staff::query()->where('is_public', true)->where('status', 'active');
    }

    protected function courseCard(Course $c): array
    {
        $v = $c->cover_path ? substr(md5($c->cover_path), 0, 8) : null;

        return [
            'id' => $c->id,
            'title' => $c->title,
            'level' => $c->level,
            'is_free' => (bool) $c->is_free,
            'summary' => str($c->description ?? '')->limit(160)->toString(),
            'image_url' => $c->cover_path
                ? "/public/academy/courses/{$c->id}/image?tenant=".$this->context->getTenantOrFail()->slug.($v ? "&v={$v}" : '')
                : null,
            'teacher' => $c->teacher && $c->teacher->is_public
                ? ['id' => $c->teacher->id, 'name' => $c->teacher->user?->name]
                : null,
        ];
    }

    protected function teacherCard(Staff $s): array
    {
        $v = $s->photo_path ? substr(md5($s->photo_path), 0, 8) : null;

        return [
            'id' => $s->id,
            'name' => $s->user?->name,
            'headline' => $s->headline,
            'image_url' => $s->photo_path
                ? "/public/academy/teachers/{$s->id}/image?tenant=".$this->context->getTenantOrFail()->slug.($v ? "&v={$v}" : '')
                : null,
            'courses_count' => (int) ($s->public_courses_count ?? 0),
        ];
    }
}
