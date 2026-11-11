<?php

namespace App\Domain\Assessment\Services;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\TenantUser;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Staff overview of assignments: every row carries its submission and result counters, computed by SQL in a
 * fixed number of queries (never one query per assignment). Scores use each student's best submission.
 */
class AssignmentOverviewService
{
    /** @param  array<string, mixed>  $filters */
    public function list(TenantUser $user, array $filters, int $perPage): LengthAwarePaginator
    {
        $query = $this->applyNarrowingFilters($this->scoped($user, $filters), $filters);
        $this->withCounters($query);
        $this->applySort($query, $filters['sort'] ?? 'newest');

        $page = $query->with('course:id,title,code')->paginate($perPage);
        $scores = $this->scoresFor($page->getCollection()->pluck('id'));
        $page->setCollection($page->getCollection()->map(fn (Assignment $a) => $this->present($a, $scores->get($a->id))));

        return $page;
    }

    /**
     * KPI totals for the same search/course/date selection, ignoring the status and "needs" filters. One query.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, int|float|null>
     */
    public function summary(TenantUser $user, array $filters): array
    {
        $scoped = $this->scoped($user, $filters);
        $ids = fn () => (clone $scoped)->select('assignments.id');
        $submissions = fn () => AssignmentSubmission::query()->whereIn('assignment_id', $ids());
        $count = fn (Builder $q) => $q->toBase()->selectRaw('count(*)');

        $row = DB::connection('tenant')->query()
            ->selectSub($count(clone $scoped), 'total')
            ->selectSub($count((clone $scoped)->where('status', 'draft')), 'draft')
            ->selectSub($count((clone $scoped)->where('status', 'published')), 'published')
            ->selectSub($count((clone $scoped)->where('status', 'archived')), 'archived')
            ->selectSub($count((clone $scoped)->where('status', 'published')->where('due_at', '<', now())->whereExists($this->missingStudents()->selectRaw('1'))), 'past_due_missing')
            ->selectSub($submissions()->toBase()->selectRaw('count(*)'), 'submitted')
            ->selectSub($submissions()->where('is_late', true)->toBase()->selectRaw('count(*)'), 'late')
            ->selectSub($submissions()->pendingGrading()->toBase()->selectRaw('count(*)'), 'pending_grading')
            ->selectSub(
                AssignmentSubmission::query()
                    ->join('assignments', 'assignments.id', '=', 'assignment_submissions.assignment_id')
                    ->whereIn('assignment_id', $ids())
                    ->whereNotNull('score')
                    ->where('assignments.points_possible', '>', 0)
                    ->toBase()
                    ->selectRaw('avg(score * 100.0 / assignments.points_possible)'),
                'average_percent'
            )
            ->first();

        return [
            'total' => (int) $row->total,
            'draft' => (int) $row->draft,
            'published' => (int) $row->published,
            'archived' => (int) $row->archived,
            'past_due_missing' => (int) $row->past_due_missing,
            'submitted' => (int) $row->submitted,
            'late' => (int) $row->late,
            'pending_grading' => (int) $row->pending_grading,
            'average_percent' => $row->average_percent === null ? null : round((float) $row->average_percent, 1),
        ];
    }

    /** @param  array<string, mixed>  $filters */
    private function scoped(TenantUser $user, array $filters): Builder
    {
        $courses = ScopeResolver::scopeCourses(Course::query(), $user, 'assignments.view')->select('courses.id');
        $query = Assignment::query()->whereIn('assignments.course_id', $courses);

        if (! empty($filters['course_id'])) {
            $query->where('assignments.course_id', $filters['course_id']);
        }
        if (! empty($filters['search'])) {
            $term = '%'.mb_strtolower($filters['search']).'%';
            $query->where(function (Builder $q) use ($term) {
                $q->whereRaw('lower(assignments.title) like ?', [$term])
                    ->orWhereHas('course', fn (Builder $c) => $c->whereRaw('lower(title) like ?', [$term])->orWhereRaw('lower(code) like ?', [$term]));
            });
        }
        if (! empty($filters['date_from'])) {
            $query->whereRaw('coalesce(assignments.due_at, assignments.created_at) >= ?', [$filters['date_from'].' 00:00:00']);
        }
        if (! empty($filters['date_to'])) {
            $query->whereRaw('coalesce(assignments.due_at, assignments.created_at) <= ?', [$filters['date_to'].' 23:59:59']);
        }

        return $query;
    }

    /** @param  array<string, mixed>  $filters */
    private function applyNarrowingFilters(Builder $query, array $filters): Builder
    {
        if (! empty($filters['status'])) {
            $query->where('assignments.status', $filters['status']);
        }

        $now = now();
        match ($filters['needs'] ?? null) {
            'pending_grading' => $query->whereHas('submissions', fn (Builder $q) => $q->pendingGrading()),
            'no_submissions' => $query->where('assignments.status', 'published')->whereDoesntHave('submissions'),
            'open_now' => $query->where('assignments.status', 'published')
                ->where(fn (Builder $q) => $q->whereNull('assignments.due_at')->orWhere('assignments.due_at', '>=', $now)),
            'past_due_missing' => $query->where('assignments.status', 'published')
                ->where('assignments.due_at', '<', $now)
                ->whereExists($this->missingStudents()->selectRaw('1')),
            'late' => $query->whereHas('submissions', fn (Builder $q) => $q->where('is_late', true)),
            'grades_unpublished' => $query->whereHas('submissions', fn (Builder $q) => $q->whereNotNull('score')->where('is_grade_published', false)),
            default => null,
        };

        return $query;
    }

    private function withCounters(Builder $query): void
    {
        $distinct = fn (Builder $q) => $q->select(DB::raw('count(distinct student_id)'));

        $query->withCount([
            'questions',
            'submissions as submitted_count' => $distinct,
            'submissions as late_count' => fn (Builder $q) => $distinct($q->where('is_late', true)),
            'submissions as with_file_count' => fn (Builder $q) => $distinct($q->whereNotNull('file_path')),
            'submissions as pending_grading_count' => fn (Builder $q) => $q->pendingGrading(),
            'submissions as graded_count' => fn (Builder $q) => $distinct($q->whereNotNull('score')),
            'submissions as grades_published_count' => fn (Builder $q) => $distinct($q->whereNotNull('score')->where('is_grade_published', true)),
        ]);

        $query->addSelect([
            'enrolled_count' => Enrollment::query()
                ->selectRaw('count(*)')
                ->whereColumn('enrollments.course_id', 'assignments.course_id')
                ->where('enrollments.status', 'active'),
            'not_submitted_count' => $this->missingStudents()->selectRaw('count(*)'),
        ]);
    }

    /** Actively enrolled students of the assignment's course who have not submitted it. */
    private function missingStudents(): Builder
    {
        return Enrollment::query()
            ->whereColumn('enrollments.course_id', 'assignments.course_id')
            ->where('enrollments.status', 'active')
            ->whereNotExists(function ($q) {
                $q->selectRaw('1')
                    ->from('assignment_submissions')
                    ->whereColumn('assignment_submissions.assignment_id', 'assignments.id')
                    ->whereColumn('assignment_submissions.student_id', 'enrollments.student_id');
            });
    }

    private function applySort(Builder $query, string $sort): void
    {
        match ($sort) {
            'oldest' => $query->orderBy('assignments.created_at'),
            'title' => $query->orderBy('assignments.title'),
            'pending' => $query->orderByDesc('pending_grading_count')->orderByDesc('assignments.created_at'),
            'participation' => $query->orderByDesc('submitted_count')->orderByDesc('assignments.created_at'),
            'due_soon' => $query->orderByRaw('case when assignments.due_at is null then 1 else 0 end')->orderBy('assignments.due_at'),
            default => $query->orderByDesc('assignments.created_at'),
        };
        $query->orderBy('assignments.id');
    }

    /**
     * Best score per student, then the aggregates per assignment, for one page of assignments.
     *
     * @param  Collection<int, string>  $assignmentIds
     * @return Collection<string, object>
     */
    private function scoresFor(Collection $assignmentIds): Collection
    {
        if ($assignmentIds->isEmpty()) {
            return collect();
        }

        $best = AssignmentSubmission::query()
            ->select('assignment_id', 'student_id')
            ->selectRaw('max(score) as best')
            ->whereIn('assignment_id', $assignmentIds)
            ->whereNotNull('score')
            ->groupBy('assignment_id', 'student_id');

        return DB::connection('tenant')->query()
            ->fromSub($best, 'b')
            ->groupBy('b.assignment_id')
            ->select('b.assignment_id')
            ->selectRaw('avg(b.best) as average, max(b.best) as highest, min(b.best) as lowest')
            ->get()
            ->keyBy('assignment_id');
    }

    /** @return array<string, mixed> */
    private function present(Assignment $assignment, ?object $scores): array
    {
        $number = fn ($value) => $value === null ? null : round((float) $value, 2);
        $notSubmitted = (int) $assignment->not_submitted_count;

        return [
            'id' => $assignment->id,
            'course_id' => $assignment->course_id,
            'course' => $assignment->course ? ['id' => $assignment->course->id, 'title' => $assignment->course->title, 'code' => $assignment->course->code] : null,
            'title' => $assignment->title,
            'status' => $assignment->status,
            'due_at' => $assignment->due_at,
            'is_past_due' => $assignment->isPastDue(),
            'allow_late' => (bool) $assignment->allow_late,
            'allow_resubmission' => (bool) $assignment->allow_resubmission,
            'late_penalty_percent' => (int) $assignment->late_penalty_percent,
            'points_possible' => $number($assignment->points_possible),
            'created_at' => $assignment->created_at,
            'questions_count' => (int) $assignment->questions_count,
            'stats' => [
                'enrolled' => (int) $assignment->enrolled_count,
                'submitted' => (int) $assignment->submitted_count,
                'not_submitted' => $notSubmitted,
                'late' => (int) $assignment->late_count,
                'with_file' => (int) $assignment->with_file_count,
                'pending_grading' => (int) $assignment->pending_grading_count,
                'graded' => (int) $assignment->graded_count,
                'grades_published' => (int) $assignment->grades_published_count,
                'average_score' => $number($scores?->average),
                'highest_score' => $number($scores?->highest),
                'lowest_score' => $number($scores?->lowest),
            ],
        ];
    }
}
