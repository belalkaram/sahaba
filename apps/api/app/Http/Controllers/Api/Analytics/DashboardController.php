<?php

namespace App\Http\Controllers\Api\Analytics;

use App\Domain\Analytics\Services\AnalyticsCalculationService;
use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\StudentAnalyticsSnapshot;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Fast student performance dashboard served from pre-aggregated read models.
     * Enforces the invariant: no synchronous heavy calculation on dashboard.
     */
    public function studentDashboard(Request $request, string $studentId): JsonResponse
    {
        $student = Student::findOrFail($studentId);

        /** @var TenantUser $user */
        $user = $request->user();
        $isSelf = $user->student && $user->student->id === $student->id;
        $isParent = $user->parentProfile && $user->parentProfile->students()->where('students.id', $student->id)->exists();
        $canView = ScopeResolver::canAccess($user, 'analytics.view', $student);

        if (! $isSelf && ! $isParent && ! $canView) {
            throw new AuthorizationException('You are not authorized to view this student analytics dashboard.');
        }

        // Pre-computed read model only (no live table scanning).
        $snapshot = StudentAnalyticsSnapshot::where('student_id', $student->id)->whereNull('course_id')->first();

        return ApiResponse::success([
            'student_id' => $student->id,
            'status' => $snapshot ? 'computed' : 'not_computed',
            'dashboard' => $snapshot,
        ]);
    }

    /**
     * Trigger background/on-demand recalculation of student analytics snapshots and measurements.
     */
    public function refresh(string $studentId, AnalyticsCalculationService $service): JsonResponse
    {
        $student = Student::findOrFail($studentId);

        $snapshot = $service->computeStudentSnapshot($student);

        return ApiResponse::success([
            'snapshot' => $snapshot,
            'message' => 'Student analytics snapshot recomputed and refreshed.',
        ]);
    }
}
