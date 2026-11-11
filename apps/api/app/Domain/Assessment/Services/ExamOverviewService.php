<?php

namespace App\Domain\Assessment\Services;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\TenantUser;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Staff overview of exams: every row carries its participation and result counters, computed by SQL in a
 * fixed number of queries (never one query per exam). Scores use each student's best attempt.
 */
class ExamOverviewService
{
    /** @param  array<string, mixed>  $filters */
    public function list(TenantUser $user, array $filters, int $perPage): LengthAwarePaginator
    {
        $query = $this->applyNarrowingFilters($this->scoped($user, $filters), $filters);
        $this->withCounters($query);
        $this->applySort($query, $filters['sort'] ?? 'newest');

        $page = $query->with('course:id,title,code')->paginate($perPage);
        $scores = $this->scoresFor($page->getCollection()->pluck('id'));
        $page->setCollection($page->getCollection()->map(fn (Exam $exam) => $this->present($exam, $scores->get($exam->id))));

        return $page;
    }

    /**
     * KPI totals for the same search/course/date selection, ignoring the status and "needs" filters so the
     * cards still show the whole picture once one of them is applied. One query.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, int|float|null>
     */
    public function summary(TenantUser $user, array $filters): array
    {
        $scoped = $this->scoped($user, $filters);
        $ids = fn () => (clone $scoped)->select('exams.id');
        $attempts = fn () => ExamAttempt::query()->whereIn('exam_id', $ids());
        $count = fn (Builder $q) => $q->toBase()->selectRaw('count(*)');

        $row = DB::connection('tenant')->query()
            ->selectSub($count(clone $scoped), 'total')
            ->selectSub($count((clone $scoped)->where('status', 'draft')), 'draft')
            ->selectSub($count((clone $scoped)->where('status', 'published')), 'published')
            ->selectSub($count((clone $scoped)->whereIn('status', ['closed', 'completed'])), 'closed')
            ->selectSub($count((clone $scoped)->where('status', 'archived')), 'archived')
            ->selectSub(
                $this->live(ExamAttempt::query()->join('exams', 'exams.id', '=', 'exam_attempts.exam_id')->whereIn('exam_id', $ids()), now())
                    ->toBase()
                    ->selectRaw('count(distinct student_id)'),
                'in_progress'
            )
            ->selectSub($attempts()->whereIn('status', ['submitted', 'graded'])->toBase()->selectRaw('count(*)'), 'submitted')
            ->selectSub($attempts()->pendingGrading()->toBase()->selectRaw('count(*)'), 'pending_grading')
            ->selectSub(
                ExamAttempt::query()
                    ->join('exams', 'exams.id', '=', 'exam_attempts.exam_id')
                    ->whereIn('exam_id', $ids())
                    ->whereNotNull('score')
                    ->where('exams.total_points', '>', 0)
                    ->toBase()
                    ->selectRaw('avg(score * 100.0 / exams.total_points)'),
                'average_percent'
            )
            ->first();

        return [
            'total' => (int) $row->total,
            'draft' => (int) $row->draft,
            'published' => (int) $row->published,
            'closed' => (int) $row->closed,
            'archived' => (int) $row->archived,
            'in_progress' => (int) $row->in_progress,
            'submitted' => (int) $row->submitted,
            'pending_grading' => (int) $row->pending_grading,
            'average_percent' => $row->average_percent === null ? null : round((float) $row->average_percent, 1),
        ];
    }

    /** @param  array<string, mixed>  $filters */
    private function scoped(TenantUser $user, array $filters): Builder
    {
        $courses = ScopeResolver::scopeCourses(Course::query(), $user, 'exams.view')->select('courses.id');
        $query = Exam::query()->whereIn('exams.course_id', $courses);

        if (! empty($filters['course_id'])) {
            $query->where('exams.course_id', $filters['course_id']);
        }
        if (! empty($filters['search'])) {
            $term = '%'.mb_strtolower($filters['search']).'%';
            $query->where(function (Builder $q) use ($term) {
                $q->whereRaw('lower(exams.title) like ?', [$term])
                    ->orWhereHas('course', fn (Builder $c) => $c->whereRaw('lower(title) like ?', [$term])->orWhereRaw('lower(code) like ?', [$term]));
            });
        }
        if (! empty($filters['date_from'])) {
            $query->whereRaw('coalesce(exams.opens_at, exams.created_at) >= ?', [$filters['date_from'].' 00:00:00']);
        }
        if (! empty($filters['date_to'])) {
            $query->whereRaw('coalesce(exams.opens_at, exams.created_at) <= ?', [$filters['date_to'].' 23:59:59']);
        }

        return $query;
    }

    /** @param  array<string, mixed>  $filters */
    private function applyNarrowingFilters(Builder $query, array $filters): Builder
    {
        if (! empty($filters['status'])) {
            $filters['status'] === 'closed'
                ? $query->whereIn('exams.status', ['closed', 'completed'])
                : $query->where('exams.status', $filters['status']);
        }

        $now = now();
        match ($filters['needs'] ?? null) {
            'pending_grading' => $query->whereHas('attempts', fn (Builder $q) => $q->pendingGrading()),
            'in_progress' => $query->whereHas('attempts', fn (Builder $q) => $this->live($q, $now)),
            'open_now' => $query->where('exams.status', 'published')
                ->where(fn (Builder $q) => $q->whereNull('exams.opens_at')->orWhere('exams.opens_at', '<=', $now))
                ->where(fn (Builder $q) => $q->whereNull('exams.closes_at')->orWhere('exams.closes_at', '>=', $now)),
            'no_participation' => $query->where('exams.status', 'published')->whereDoesntHave('attempts'),
            'grades_unpublished' => $query->where('exams.is_grades_published', false)
                ->whereHas('attempts', fn (Builder $q) => $q->whereIn('status', ['submitted', 'graded'])),
            'violations' => $query->whereHas('attempts', fn (Builder $q) => $q->where('violation_count', '>', 0)),
            default => null,
        };

        return $query;
    }

    private function withCounters(Builder $query): void
    {
        $now = now();
        $distinct = fn (Builder $q) => $q->select(DB::raw('count(distinct student_id)'));

        $query->withCount([
            'questions',
            'attempts as started_count' => $distinct,
            'attempts as in_progress_count' => fn (Builder $q) => $distinct($this->live($q, $now)),
            'attempts as timed_out_count' => fn (Builder $q) => $distinct(
                $q->where('status', 'in_progress')->where('expires_at', '<=', $now)->where('exams.allow_split_sessions', false)
            ),
            'attempts as completed_count' => fn (Builder $q) => $distinct($q->whereIn('status', ['submitted', 'graded'])),
            'attempts as finished_attempts_count' => fn (Builder $q) => $q->whereIn('status', ['submitted', 'graded']),
            'attempts as pending_grading_count' => fn (Builder $q) => $q->pendingGrading(),
            'attempts as violators_count' => fn (Builder $q) => $distinct($q->where('violation_count', '>', 0)),
        ]);

        $enrolled = fn () => Enrollment::query()
            ->selectRaw('count(*)')
            ->whereColumn('enrollments.course_id', 'exams.course_id')
            ->where('enrollments.status', 'active');

        $query->addSelect([
            'enrolled_count' => $enrolled(),
            'not_started_count' => $enrolled()->whereNotExists(function ($q) {
                $q->selectRaw('1')
                    ->from('exam_attempts')
                    ->whereColumn('exam_attempts.exam_id', 'exams.id')
                    ->whereColumn('exam_attempts.student_id', 'enrollments.student_id');
            }),
        ]);
    }

    /** Attempts still running: a split-session exam may resume, so only its budget (not expires_at) ends it. */
    private function live(Builder $attempts, mixed $now): Builder
    {
        return $attempts->where('exam_attempts.status', 'in_progress')->where(function (Builder $q) use ($now) {
            $q->whereNull('expires_at')->orWhere('expires_at', '>', $now)->orWhere('exams.allow_split_sessions', true);
        });
    }

    private function applySort(Builder $query, string $sort): void
    {
        match ($sort) {
            'oldest' => $query->orderBy('exams.created_at'),
            'title' => $query->orderBy('exams.title'),
            'pending' => $query->orderByDesc('pending_grading_count')->orderByDesc('exams.created_at'),
            'participation' => $query->orderByDesc('completed_count')->orderByDesc('exams.created_at'),
            default => $query->orderByDesc('exams.created_at'),
        };
        $query->orderBy('exams.id');
    }

    /**
     * Best score per student, then the aggregates per exam, for one page of exams.
     *
     * @param  Collection<int, string>  $examIds
     * @return Collection<string, object>
     */
    private function scoresFor(Collection $examIds): Collection
    {
        if ($examIds->isEmpty()) {
            return collect();
        }

        $best = ExamAttempt::query()
            ->select('exam_id', 'student_id')
            ->selectRaw('max(score) as best')
            ->whereIn('exam_id', $examIds)
            ->whereNotNull('score')
            ->groupBy('exam_id', 'student_id');

        return DB::connection('tenant')->query()
            ->fromSub($best, 'b')
            ->join('exams', 'exams.id', '=', 'b.exam_id')
            ->groupBy('b.exam_id')
            ->select('b.exam_id')
            ->selectRaw('avg(b.best) as average, max(b.best) as highest, min(b.best) as lowest')
            ->selectRaw('sum(case when exams.passing_score is not null and b.best >= exams.passing_score then 1 else 0 end) as passed')
            ->selectRaw('sum(case when exams.passing_score is not null and b.best < exams.passing_score then 1 else 0 end) as failed')
            ->get()
            ->keyBy('exam_id');
    }

    /** @return array<string, mixed> */
    private function present(Exam $exam, ?object $scores): array
    {
        $number = fn ($value) => $value === null ? null : round((float) $value, 2);

        return [
            'id' => $exam->id,
            'course_id' => $exam->course_id,
            'course' => $exam->course ? ['id' => $exam->course->id, 'title' => $exam->course->title, 'code' => $exam->course->code] : null,
            'title' => $exam->title,
            'status' => $exam->status,
            'is_open' => $exam->isOpen(),
            'is_grades_published' => (bool) $exam->is_grades_published,
            'opens_at' => $exam->opens_at,
            'closes_at' => $exam->closes_at,
            'duration_minutes' => $exam->duration_minutes,
            'max_attempts' => $exam->max_attempts,
            'total_points' => $number($exam->total_points),
            'passing_score' => $number($exam->passing_score),
            'allow_split_sessions' => (bool) $exam->allow_split_sessions,
            'created_at' => $exam->created_at,
            'questions_count' => (int) $exam->questions_count,
            'stats' => [
                'enrolled' => (int) $exam->enrolled_count,
                'started' => (int) $exam->started_count,
                'not_started' => (int) $exam->not_started_count,
                'in_progress' => (int) $exam->in_progress_count,
                'timed_out' => (int) $exam->timed_out_count,
                'completed' => (int) $exam->completed_count,
                'pending_grading' => (int) $exam->pending_grading_count,
                'graded' => max(0, (int) $exam->finished_attempts_count - (int) $exam->pending_grading_count),
                'violators' => (int) $exam->violators_count,
                'average_score' => $number($scores?->average),
                'highest_score' => $number($scores?->highest),
                'lowest_score' => $number($scores?->lowest),
                'passed' => (int) ($scores?->passed ?? 0),
                'failed' => (int) ($scores?->failed ?? 0),
            ],
        ];
    }
}
