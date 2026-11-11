<?php

namespace App\Http\Controllers\Api\Assessment;

use App\Domain\Assessment\Services\AssignmentOverviewService;
use App\Domain\Assessment\Services\ExamOverviewService;
use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Staff list pages for exams and assignments with participation and result counters on every row.
 * Holding exams.view / assignments.view is not enough: students and parents have them too, with the
 * "self" / "linked" scopes, and class-wide numbers are staff data.
 */
class AssessmentOverviewController extends Controller
{
    private const EXAM_NEEDS = ['pending_grading', 'in_progress', 'open_now', 'no_participation', 'grades_unpublished', 'violations'];

    private const ASSIGNMENT_NEEDS = ['pending_grading', 'no_submissions', 'open_now', 'past_due_missing', 'late', 'grades_unpublished'];

    public function exams(Request $request, ExamOverviewService $service): JsonResponse
    {
        $user = $this->staffOrFail($request, 'exams.view');
        $filters = $this->filters($request, ['draft', 'published', 'closed', 'archived'], self::EXAM_NEEDS, ['newest', 'oldest', 'title', 'pending', 'participation']);
        $page = $service->list($user, $filters, $this->perPage($request));

        return ApiResponse::success([
            'exams' => $page->items(),
            'summary' => $service->summary($user, $filters),
            'courses' => $this->courseOptions($user, 'exams.view'),
        ], 200, ['pagination' => $this->pagination($page)]);
    }

    public function assignments(Request $request, AssignmentOverviewService $service): JsonResponse
    {
        $user = $this->staffOrFail($request, 'assignments.view');
        $filters = $this->filters($request, ['draft', 'published', 'archived'], self::ASSIGNMENT_NEEDS, ['newest', 'oldest', 'title', 'pending', 'participation', 'due_soon']);
        $page = $service->list($user, $filters, $this->perPage($request));

        return ApiResponse::success([
            'assignments' => $page->items(),
            'summary' => $service->summary($user, $filters),
            'courses' => $this->courseOptions($user, 'assignments.view'),
        ], 200, ['pagination' => $this->pagination($page)]);
    }

    private function staffOrFail(Request $request, string $permission): TenantUser
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (in_array($user->permissionScope($permission), [null, 'self', 'linked'], true)) {
            throw new AuthorizationException('This overview is available to staff only.');
        }

        return $user;
    }

    /**
     * @param  list<string>  $statuses
     * @param  list<string>  $needs
     * @param  list<string>  $sorts
     * @return array<string, mixed>
     */
    private function filters(Request $request, array $statuses, array $needs, array $sorts): array
    {
        return $request->validate([
            'search' => 'nullable|string|max:100',
            'course_id' => 'nullable|uuid',
            'status' => ['nullable', Rule::in($statuses)],
            'needs' => ['nullable', Rule::in($needs)],
            'sort' => ['nullable', Rule::in($sorts)],
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d|after_or_equal:date_from',
        ]);
    }

    private function perPage(Request $request): int
    {
        return max(1, min(50, (int) $request->input('per_page', 12)));
    }

    /** @return array<int, array<string, mixed>> */
    private function courseOptions(TenantUser $user, string $permission): array
    {
        return ScopeResolver::scopeCourses(Course::query(), $user, $permission)
            ->orderBy('title')
            ->get(['id', 'title', 'code'])
            ->map(fn (Course $c) => ['id' => $c->id, 'title' => $c->title, 'code' => $c->code])
            ->all();
    }

    /** @return array<string, int> */
    private function pagination($page): array
    {
        return [
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'last_page' => $page->lastPage(),
        ];
    }
}
