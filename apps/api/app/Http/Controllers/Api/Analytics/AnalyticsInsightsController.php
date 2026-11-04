<?php

namespace App\Http\Controllers\Api\Analytics;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Course;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\StudentAnalyticsSnapshot;
use App\Models\TenantSetting;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * R8-4: staff analytics read from pre-computed snapshots. Scope is enforced per resource.
 */
class AnalyticsInsightsController extends Controller
{
    /**
     * GET /analytics/courses/{id}
     */
    public function course(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);
        $this->authorizeResource($request->user(), $course);

        $snapshots = StudentAnalyticsSnapshot::with('student.user')->where('course_id', $course->id)->get();

        return ApiResponse::success([
            'course_id' => $course->id,
            'title' => $course->title,
            'students_enrolled' => $course->enrollments()->where('status', 'active')->count(),
            'students_computed' => $snapshots->count(),
            'averages' => [
                'attendance_rate' => $this->average($snapshots, 'attendance_rate'),
                'assignment_completion_rate' => $this->average($snapshots, 'assignment_completion_rate'),
                'exam_average' => $this->average($snapshots, 'exam_average'),
                'lesson_completion_rate' => $this->average($snapshots, 'lesson_completion_rate'),
            ],
            'students' => $snapshots->map(fn (StudentAnalyticsSnapshot $s) => $this->row($s))->values(),
        ]);
    }

    /**
     * GET /analytics/classes/{id}
     */
    public function schoolClass(Request $request, string $id): JsonResponse
    {
        $class = SchoolClass::findOrFail($id);
        $this->authorizeResource($request->user(), $class);

        $records = AttendanceRecord::whereHas('session', fn ($q) => $q->where('class_id', $class->id))->get()->groupBy('student_id');

        $students = $class->students()->with('user')->get()->map(function (Student $student) use ($records) {
            $own = $records->get($student->id, collect());
            $attended = $own->whereIn('status', ['present', 'late'])->count();

            return [
                'student_id' => $student->id,
                'name' => $student->user?->name,
                'sessions_recorded' => $own->count(),
                'sessions_attended' => $attended,
                'attendance_rate' => $own->isEmpty() ? null : round(($attended / $own->count()) * 100, 2),
            ];
        });

        return ApiResponse::success([
            'class_id' => $class->id,
            'name' => $class->name,
            'students' => $students->values(),
        ]);
    }

    /**
     * GET /analytics/at-risk
     * Thresholds are tenant settings; students with no computed data are never flagged.
     */
    public function atRisk(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $attendanceBelow = (float) TenantSetting::getValue(TenantSetting::AT_RISK_ATTENDANCE_BELOW, 75);
        $scoreBelow = (float) TenantSetting::getValue(TenantSetting::AT_RISK_SCORE_BELOW, 60);

        $students = StudentAnalyticsSnapshot::with('student.user')
            ->whereNull('course_id')
            ->where(function ($q) use ($attendanceBelow, $scoreBelow) {
                $q->where('attendance_rate', '<', $attendanceBelow)->orWhere('overall_score', '<', $scoreBelow);
            })
            ->orderBy('overall_score')
            ->limit(200)
            ->get()
            ->filter(fn (StudentAnalyticsSnapshot $s) => $s->student && ScopeResolver::canAccess($user, 'analytics.view', $s->student))
            ->map(fn (StudentAnalyticsSnapshot $s) => $this->row($s))
            ->values();

        return ApiResponse::success([
            'thresholds' => ['attendance_below' => $attendanceBelow, 'score_below' => $scoreBelow],
            'students' => $students,
        ]);
    }

    private function authorizeResource(TenantUser $user, Course|SchoolClass $resource): void
    {
        if (! ScopeResolver::canAccess($user, 'analytics.view', $resource)) {
            throw new AuthorizationException('You are not authorized to view these analytics.');
        }
    }

    private function average($snapshots, string $column): ?float
    {
        $values = $snapshots->pluck($column)->filter(fn ($v) => $v !== null);

        return $values->isEmpty() ? null : round((float) $values->avg(), 2);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(StudentAnalyticsSnapshot $snapshot): array
    {
        return [
            'student_id' => $snapshot->student_id,
            'name' => $snapshot->student?->user?->name,
            'student_code' => $snapshot->student?->student_code,
            'attendance_rate' => $snapshot->attendance_rate,
            'assignment_completion_rate' => $snapshot->assignment_completion_rate,
            'exam_average' => $snapshot->exam_average,
            'lesson_completion_rate' => $snapshot->lesson_completion_rate,
            'overall_score' => $snapshot->overall_score,
            'last_activity_at' => $snapshot->last_activity_at,
            'last_calculated_at' => $snapshot->last_calculated_at,
        ];
    }
}
