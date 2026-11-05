<?php

namespace App\Http\Controllers\Api\Me;

use App\Domain\Attendance\Services\StudentQrService;
use App\Http\Controllers\Controller;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MyResourceController (R1-A8)
 *
 * Provides dedicated scoped endpoints for the authenticated user's resources:
 *  - GET /me/children (Parent)
 *  - GET /me/courses  (Staff / Student / Parent)
 *  - GET /me/classes  (Staff / Student / Parent)
 *  - GET /me/students (Staff)
 *  - GET /me/sessions (with date filtering)
 */
class MyResourceController extends Controller
{
    /**
     * GET /me/children
     * Returns children linked to authenticated user's parent profile.
     */
    public function children(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $user->loadMissing('parentProfile.students.user');

        if (! $user->parentProfile) {
            return ApiResponse::error(
                'NOT_A_PARENT',
                'The authenticated user does not have a parent profile.',
                Response::HTTP_FORBIDDEN
            );
        }

        $children = $user->parentProfile->students->map(function (Student $student) {
            return [
                'id' => $student->id,
                'student_code' => $student->student_code,
                'grade_level' => $student->grade_level,
                'status' => $student->status,
                'relation' => $student->pivot->relation_type ?? 'guardian',
                'user' => [
                    'id' => $student->user->id,
                    'name' => $student->user->name,
                    'email' => $student->user->email,
                    'phone' => $student->user->phone,
                ],
            ];
        });

        return ApiResponse::success($children);
    }

    /**
     * GET /me/courses
     * Returns courses accessible to authenticated user according to their role and scope.
     */
    public function courses(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $query = Course::query()->with('teacher.user');

        $courses = ScopeResolver::scopeCourses($query, $user, 'courses.view')
            ->orderBy('title')
            ->get();

        return ApiResponse::success($courses);
    }

    /**
     * GET /me/classes
     * Returns classes accessible to authenticated user according to their role and scope.
     */
    public function classes(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $query = SchoolClass::query()->with('teacher.user');

        $classes = ScopeResolver::scopeClasses($query, $user, 'classes.view')
            ->orderBy('name')
            ->get();

        return ApiResponse::success($classes);
    }

    /**
     * GET /me/students
     * Returns students assigned to or taught by the authenticated staff member.
     */
    public function students(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $query = Student::query()->with('user');

        $students = ScopeResolver::scopeStudents($query, $user, 'students.view')
            ->get();

        return ApiResponse::success($students);
    }

    /**
     * GET /me/sessions
     * Returns class sessions for the authenticated user with optional `from` and `to` date filters.
     */
    public function sessions(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();
        $query = ClassSession::query()->with(['schoolClass', 'classroom']);

        $query = ScopeResolver::scopeSessions($query, $user, 'classes.view');

        if ($request->query('date') === 'today') {
            $query->whereDate('starts_at', today());
        } elseif ($request->filled('date')) {
            $query->whereDate('starts_at', $request->query('date'));
        }

        if ($request->filled('from')) {
            $query->where('starts_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->where('starts_at', '<=', $request->query('to'));
        }

        $sessions = $query->orderBy('starts_at', 'asc')->get();

        return ApiResponse::success($sessions);
    }

    /**
     * GET /me/subscriptions (R3-4)
     * Returns subscriptions for the authenticated student.
     */
    public function subscriptions(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only student accounts have subscriptions.',
                Response::HTTP_FORBIDDEN
            );
        }

        $subscriptions = $user->student->subscriptions()
            ->with(['package.entitlements', 'entitlements'])
            ->orderBy('created_at', 'desc')
            ->get();

        return ApiResponse::success(['subscriptions' => $subscriptions]);
    }

    /**
     * GET /me/entitlements (R3-4)
     * Returns valid entitlements for the authenticated student.
     */
    public function entitlements(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only student accounts have entitlements.',
                Response::HTTP_FORBIDDEN
            );
        }

        $entitlements = $user->student->entitlements()
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->get();

        return ApiResponse::success(['entitlements' => $entitlements]);
    }

    /**
     * GET /me/attendance-qr (R5-1)
     * Generate dynamic secure QR token for student attendance.
     */
    public function attendanceQr(Request $request, TenantContext $context, StudentQrService $qrService): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only student accounts have attendance QR tokens.',
                Response::HTTP_FORBIDDEN
            );
        }

        $tenant = $context->getTenantOrFail();
        $student = $user->student;

        // Check if tenant uses coupon/credential mode
        $credentialId = null;
        if ($tenant->auth_mode === 'coupon') {
            $cred = $student->deviceCredentials()->where('status', 'active')->first();
            if (! $cred) {
                return ApiResponse::error(
                    'CREDENTIAL_REQUIRED',
                    'Active credential/coupon required for this institution.',
                    Response::HTTP_FORBIDDEN
                );
            }
            $credentialId = $cred->id;
        }

        try {
            $tokenData = $qrService->generateToken($student, $tenant, $credentialId);
        } catch (\Throwable $e) {
            return ApiResponse::error(
                'QR_GENERATION_FAILED',
                $e->getMessage(),
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        return ApiResponse::success([
            'token' => $tokenData['token'],
            'expires_at' => $tokenData['expires_at'],
            'expires_in_seconds' => $tokenData['expires_in_seconds'],
            'student' => [
                'id' => $student->id,
                'name' => $user->name,
                'student_code' => $student->student_code,
                'grade_level' => $student->grade_level,
                'photo_initial' => mb_substr($user->name, 0, 1),
            ],
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'logo_url' => $tenant->logo_url,
                'primary_color' => $tenant->primary_color,
            ],
        ]);
    }

    /**
     * GET /me/attendance (R5-7)
     * Return attendance history and per-class stats for authenticated student.
     */
    public function attendance(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->student) {
            return ApiResponse::error(
                'NOT_A_STUDENT',
                'Only student accounts have attendance records.',
                Response::HTTP_FORBIDDEN
            );
        }

        $student = $user->student;

        // Enrolled classes
        $classes = $student->classes()->with(['teacher.user', 'branch'])->get();

        // Attendance records
        $records = $student->attendanceRecords()
            ->with(['session.schoolClass', 'session.classroom', 'recordedBy'])
            ->orderBy('recorded_at', 'desc')
            ->get();

        $totalRecords = $records->count();
        $presentCount = $records->where('status', 'present')->count();
        $absentCount = $records->where('status', 'absent')->count();
        $lateCount = $records->where('status', 'late')->count();
        $excusedCount = $records->where('status', 'excused')->count();

        $overallRate = $totalRecords > 0
            ? (int) round(($presentCount / $totalRecords) * 100)
            : 100;

        // Group stats per class
        $classStats = $classes->map(function ($cls) use ($records) {
            $classRecords = $records->filter(fn ($r) => $r->session?->class_id === $cls->id);
            $cTotal = $classRecords->count();
            $cPresent = $classRecords->where('status', 'present')->count();
            $cRate = $cTotal > 0 ? (int) round(($cPresent / $cTotal) * 100) : 100;

            return [
                'class_id' => $cls->id,
                'class_name' => $cls->name,
                'code' => $cls->code,
                'total_sessions' => $cTotal,
                'present' => $cPresent,
                'absent' => $classRecords->where('status', 'absent')->count(),
                'late' => $classRecords->where('status', 'late')->count(),
                'attendance_rate' => $cRate,
            ];
        });

        return ApiResponse::success([
            'summary' => [
                'total_records' => $totalRecords,
                'present' => $presentCount,
                'absent' => $absentCount,
                'late' => $lateCount,
                'excused' => $excusedCount,
                'attendance_rate' => $overallRate,
            ],
            'classes' => $classStats,
            'records' => $records,
        ]);
    }
}
