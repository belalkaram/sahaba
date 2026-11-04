<?php

namespace App\Http\Controllers\Api\Education;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Entitlement;
use App\Models\Student;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnrollmentController extends Controller
{
    /**
     * Enroll in a course (self-enrollment for free/entitled courses, or staff with enrollments.create).
     */
    public function enroll(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        /** @var TenantUser $user */
        $user = $request->user();

        if ($request->has('student_id')) {
            // Enrolling on behalf of someone requires enrollments.create
            if (! $user->hasPermissionTo('enrollments.create')) {
                throw new AuthorizationException('Forbidden. Missing required permission [enrollments.create].');
            }

            $validated = $request->validate([
                'student_id' => 'required|uuid|exists:tenant.students,id',
            ]);

            $studentId = $validated['student_id'];
        } else {
            // Self-enrollment (R3-2 / OD-15)
            if (! $user->student) {
                return ApiResponse::error(
                    'INVALID_ENROLLMENT',
                    'Authenticated user does not have a student profile.',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            if (! $course->is_free) {
                // Check if student has valid entitlement covering this course
                $hasEntitlement = Entitlement::where('student_id', $user->student->id)
                    ->whereIn('entitlement_key', ['course:'.$course->id, 'all_courses', 'ONLINE_ACCESS'])
                    ->where('is_active', true)
                    ->where(function ($query) {
                        $query->whereNull('expires_at')->orWhere('expires_at', '>=', now());
                    })
                    ->exists();

                if (! $hasEntitlement) {
                    return ApiResponse::error(
                        'ENROLLMENT_REQUIRES_PAYMENT',
                        'This course requires an active subscription or package purchase to enroll.',
                        Response::HTTP_FORBIDDEN
                    );
                }
            }

            $studentId = $user->student->id;
        }

        $enrollment = Enrollment::firstOrCreate(
            [
                'course_id' => $course->id,
                'student_id' => $studentId,
            ],
            [
                'status' => 'active',
                'enrolled_at' => now(),
            ]
        );

        return ApiResponse::success([
            'enrollment' => $enrollment->load(['student.user', 'course']),
        ], Response::HTTP_CREATED);
    }

    /**
     * List enrollments for a course (requires enrollments.view permission).
     */
    public function index(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);

        $enrollments = $course->enrollments()->with('student.user')->get();

        return ApiResponse::success(['enrollments' => $enrollments]);
    }

    /**
     * View enrollments for a specific student.
     * Enforces:
     * - The student themselves can view their enrollments.
     * - Staff with 'students.view' can view.
     * - Assistants/staff WITHOUT 'students.view' are forbidden (403).
     */
    public function studentEnrollments(Request $request, string $studentId): JsonResponse
    {
        $student = Student::findOrFail($studentId);

        /** @var TenantUser $user */
        $user = $request->user();

        $isSelf = $user->student && $user->student->id === $student->id;

        if (! $isSelf && ! ScopeResolver::canAccess($user, 'students.view', $student)) {
            throw new AuthorizationException('You are not authorized to view student enrollment data.');
        }

        $enrollments = $student->enrollments()->with('course')->get();

        return ApiResponse::success(['enrollments' => $enrollments]);
    }
}
