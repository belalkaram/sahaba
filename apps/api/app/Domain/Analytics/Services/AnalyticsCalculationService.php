<?php

namespace App\Domain\Analytics\Services;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\AttendanceRecord;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\Grade;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\MetricDefinition;
use App\Models\MetricMeasurement;
use App\Models\MetricVersion;
use App\Models\Student;
use App\Models\StudentAnalyticsSnapshot;
use Illuminate\Support\Collection;

class AnalyticsCalculationService
{
    /** Overall score weights; metrics with no data are left out and the rest re-normalized. */
    private const WEIGHTS = [
        'exam_average' => 0.40,
        'assignment_completion_rate' => 0.35,
        'attendance_rate' => 0.25,
    ];

    /**
     * Compute and record an analytics snapshot for a student, overall or for one course.
     * R8-4: a metric with no underlying data is null, never a made-up value.
     */
    public function computeStudentSnapshot(Student $student, ?Course $course = null): StudentAnalyticsSnapshot
    {
        $courseIds = $course
            ? collect([$course->id])
            : Enrollment::where('student_id', $student->id)->where('status', 'active')->pluck('course_id');

        $metrics = [
            'attendance_rate' => $this->attendanceRate($student, $course),
            'assignment_completion_rate' => $this->assignmentCompletionRate($student, $courseIds),
            'exam_average' => $this->examAverage($student, $course),
        ];

        $values = [
            ...$metrics,
            'lesson_completion_rate' => $this->lessonCompletionRate($student, $courseIds),
            'overall_score' => $this->overallScore($metrics),
            'last_activity_at' => $this->lastActivity($student),
            'last_calculated_at' => now(),
        ];

        if (! $course) {
            $this->recordMeasurement($student, 'attendance_rate', $metrics['attendance_rate'], 'Attendance Rate', 'attendance');
            $this->recordMeasurement($student, 'assignment_completion', $metrics['assignment_completion_rate'], 'Assignment Completion', 'academic');
            $this->recordMeasurement($student, 'exam_average', $metrics['exam_average'], 'Exam Average', 'academic');
            $this->recordMeasurement($student, 'lesson_completion', $values['lesson_completion_rate'], 'Lesson Completion', 'academic');
        }

        return StudentAnalyticsSnapshot::updateOrCreate(
            ['student_id' => $student->id, 'course_id' => $course?->id],
            $values
        );
    }

    /**
     * Overall snapshot plus one snapshot per active enrollment.
     */
    public function computeAllForStudent(Student $student): void
    {
        $this->computeStudentSnapshot($student);

        Course::whereIn('id', Enrollment::where('student_id', $student->id)->where('status', 'active')->pluck('course_id'))
            ->get()
            ->each(fn (Course $course) => $this->computeStudentSnapshot($student, $course));
    }

    private function attendanceRate(Student $student, ?Course $course): ?float
    {
        $query = AttendanceRecord::where('student_id', $student->id);
        if ($course) {
            $query->whereHas('session.schoolClass', fn ($q) => $q->where('course_id', $course->id));
        }

        $total = (clone $query)->count();
        if ($total === 0) {
            return null;
        }

        return round(((clone $query)->whereIn('status', ['present', 'late'])->count() / $total) * 100, 2);
    }

    private function assignmentCompletionRate(Student $student, Collection $courseIds): ?float
    {
        $assignmentIds = Assignment::whereIn('course_id', $courseIds)->where('status', 'published')->pluck('id');
        if ($assignmentIds->isEmpty()) {
            return null;
        }

        $submitted = AssignmentSubmission::where('student_id', $student->id)
            ->whereIn('assignment_id', $assignmentIds)
            ->distinct('assignment_id')
            ->count('assignment_id');

        return round(($submitted / $assignmentIds->count()) * 100, 2);
    }

    private function examAverage(Student $student, ?Course $course): ?float
    {
        $query = Grade::where('student_id', $student->id)->where('is_published', true);

        if ($course) {
            $query->where(function ($q) use ($course) {
                $q->where(function ($exam) use ($course) {
                    $exam->where('gradable_type', 'exam')
                        ->whereIn('gradable_id', Exam::where('course_id', $course->id)->pluck('id'));
                })->orWhere(function ($assignment) use ($course) {
                    $assignment->where('gradable_type', 'assignment')
                        ->whereIn('gradable_id', Assignment::where('course_id', $course->id)->pluck('id'));
                });
            });
        }

        $average = $query->avg('percentage');

        return $average === null ? null : round((float) $average, 2);
    }

    private function lessonCompletionRate(Student $student, Collection $courseIds): ?float
    {
        $lessonIds = Lesson::whereIn('course_id', $courseIds)->where('status', 'published')->pluck('id');
        if ($lessonIds->isEmpty()) {
            return null;
        }

        $completed = LessonProgress::where('student_id', $student->id)
            ->whereIn('lesson_id', $lessonIds)
            ->whereNotNull('completed_at')
            ->count();

        return round(($completed / $lessonIds->count()) * 100, 2);
    }

    /**
     * @param  array<string, float|null>  $metrics
     */
    private function overallScore(array $metrics): ?float
    {
        $weightSum = 0.0;
        $score = 0.0;

        foreach (self::WEIGHTS as $key => $weight) {
            if ($metrics[$key] !== null) {
                $score += $metrics[$key] * $weight;
                $weightSum += $weight;
            }
        }

        return $weightSum > 0 ? round($score / $weightSum, 2) : null;
    }

    private function lastActivity(Student $student): ?string
    {
        return collect([
            LessonProgress::where('student_id', $student->id)->max('updated_at'),
            AttendanceRecord::where('student_id', $student->id)->max('updated_at'),
            AssignmentSubmission::where('student_id', $student->id)->max('updated_at'),
        ])->filter()->max();
    }

    /**
     * Record an individual measurement with accurate metric definition and version.
     */
    protected function recordMeasurement(
        Student $student,
        string $metricKey,
        ?float $value,
        string $name,
        string $category
    ): ?MetricMeasurement {
        if ($value === null) {
            return null;
        }

        $definition = MetricDefinition::firstOrCreate(
            ['key' => $metricKey],
            [
                'name' => $name,
                'category' => $category,
                'current_version' => 1,
            ]
        );

        $version = MetricVersion::firstOrCreate(
            [
                'metric_definition_id' => $definition->id,
                'version' => $definition->current_version,
            ],
            [
                'effective_from' => now(),
                'changelog' => 'Initial metric version',
            ]
        );

        return MetricMeasurement::create([
            'student_id' => $student->id,
            'metric_definition_id' => $definition->id,
            'metric_version_id' => $version->id,
            'value' => $value,
            'recorded_at' => now(),
        ]);
    }
}
