<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\ClassSession;
use App\Models\OfflineHomeworkCheck;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OfflineHomeworkCheckController extends Controller
{
    /**
     * List homework checks for a specific session.
     */
    public function index(Request $request, string $sessionId): JsonResponse
    {
        $session = ClassSession::with('schoolClass')->findOrFail($sessionId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('sessions.view')) {
            throw new AuthorizationException('You do not have permission to view session details.');
        }

        if (! ScopeResolver::canAccess($user, 'sessions.view', $session)) {
            throw new AuthorizationException('You are not authorized to view homework checks for this session.');
        }

        $checks = OfflineHomeworkCheck::with(['student.user', 'checkedByStaff.user'])
            ->where('session_id', $session->id)
            ->get();

        return ApiResponse::success([
            'session_id' => $session->id,
            'checks' => $checks,
        ]);
    }

    /**
     * Record or update homework check for a single student.
     */
    public function store(Request $request, string $sessionId): JsonResponse
    {
        $session = ClassSession::with('schoolClass')->findOrFail($sessionId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('homework_checks.record')) {
            throw new AuthorizationException('You do not have permission to record homework checks.');
        }

        if (! ScopeResolver::canAccess($user, 'homework_checks.record', $session)) {
            throw new AuthorizationException('You can only record homework checks for sessions in your assigned classes.');
        }

        $validated = $request->validate([
            'student_id' => 'required|uuid|exists:tenant.students,id',
            'status' => 'required|string|in:done,partial,not_done,absent',
            'note' => 'nullable|string|max:500',
        ]);

        // Verify student is enrolled in the session's class
        $isEnrolled = $session->schoolClass->students()
            ->where('students.id', $validated['student_id'])
            ->exists();

        if (! $isEnrolled) {
            return ApiResponse::error(
                'STUDENT_NOT_IN_CLASS',
                'الطالب غير مسجل في هذه المجموعة/الفصل الدراسي.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $check = OfflineHomeworkCheck::updateOrCreate(
            [
                'session_id' => $session->id,
                'student_id' => $validated['student_id'],
            ],
            [
                'status' => $validated['status'],
                'note' => $validated['note'] ?? null,
                'checked_by_staff_id' => $user->staff?->id,
                'checked_at' => now(),
            ]
        );

        AuditLogger::log(
            action: 'homework_check.recorded',
            entityType: 'OfflineHomeworkCheck',
            entityId: $check->id,
            payload: [
                'session_id' => $session->id,
                'student_id' => $validated['student_id'],
                'status' => $validated['status'],
                'note' => $validated['note'] ?? null,
            ]
        );

        return ApiResponse::success([
            'check' => $check->load(['student.user', 'checkedByStaff.user']),
        ], Response::HTTP_OK);
    }

    /**
     * Bulk record or update homework checks for multiple students.
     */
    public function bulk(Request $request, string $sessionId): JsonResponse
    {
        $session = ClassSession::with('schoolClass')->findOrFail($sessionId);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('homework_checks.record')) {
            throw new AuthorizationException('You do not have permission to record homework checks.');
        }

        if (! ScopeResolver::canAccess($user, 'homework_checks.record', $session)) {
            throw new AuthorizationException('You can only record homework checks for sessions in your assigned classes.');
        }

        $validated = $request->validate([
            'checks' => 'required|array|min:1',
            'checks.*.student_id' => 'required|uuid|exists:tenant.students,id',
            'checks.*.status' => 'required|string|in:done,partial,not_done,absent',
            'checks.*.note' => 'nullable|string|max:500',
        ]);

        $recordedChecks = [];

        foreach ($validated['checks'] as $item) {
            $isEnrolled = $session->schoolClass->students()
                ->where('students.id', $item['student_id'])
                ->exists();

            if (! $isEnrolled) {
                continue;
            }

            $check = OfflineHomeworkCheck::updateOrCreate(
                [
                    'session_id' => $session->id,
                    'student_id' => $item['student_id'],
                ],
                [
                    'status' => $item['status'],
                    'note' => $item['note'] ?? null,
                    'checked_by_staff_id' => $user->staff?->id,
                    'checked_at' => now(),
                ]
            );

            $recordedChecks[] = $check;
        }

        AuditLogger::log(
            action: 'homework_check.bulk_recorded',
            entityType: 'ClassSession',
            entityId: $session->id,
            payload: [
                'count' => count($recordedChecks),
            ]
        );

        return ApiResponse::success([
            'count' => count($recordedChecks),
            'checks' => $recordedChecks,
        ], Response::HTTP_OK);
    }
}
