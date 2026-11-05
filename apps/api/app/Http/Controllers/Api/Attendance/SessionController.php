<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\SchoolClass;
use App\Models\TenantSetting;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\ScopeResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SessionController extends Controller
{
    /**
     * List all sessions accessible to authenticated staff.
     */
    public function indexAll(Request $request): JsonResponse
    {
        /** @var TenantUser $user */
        $user = $request->user();

        $query = ClassSession::with(['schoolClass.teacher.user', 'classroom']);
        $query = ScopeResolver::scopeSessions($query, $user, 'sessions.create');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('from')) {
            $query->where('starts_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->where('starts_at', '<=', $request->query('to'));
        }

        $sessions = $query->orderBy('starts_at', 'desc')->get();

        return ApiResponse::success(['sessions' => $sessions]);
    }

    /**
     * List sessions of a class.
     */
    public function index(string $classId): JsonResponse
    {
        $class = SchoolClass::findOrFail($classId);
        $sessions = $class->sessions()->with('classroom')->orderBy('starts_at', 'desc')->get();

        return ApiResponse::success(['sessions' => $sessions]);
    }

    /**
     * Create a session for a class.
     */
    public function store(Request $request, string $classId): JsonResponse
    {
        $class = SchoolClass::findOrFail($classId);

        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'classroom_id' => 'nullable|uuid|exists:tenant.classrooms,id',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'attendance_mode' => 'nullable|string|in:manual,qr,both',
            'timing_mode' => 'nullable|string|in:scheduled,open',
            'grace_period_minutes' => 'nullable|integer|min:0|max:300',
            'status' => 'nullable|string|in:scheduled,in_progress,completed,cancelled',
        ]);

        $session = $class->sessions()->create([
            'classroom_id' => $validated['classroom_id'] ?? null,
            'title' => $validated['title'] ?? 'Session',
            'starts_at' => $validated['starts_at'] ?? now(),
            'ends_at' => $validated['ends_at'] ?? null,
            'attendance_mode' => $validated['attendance_mode'] ?? 'both',
            'timing_mode' => $validated['timing_mode'] ?? 'scheduled',
            'grace_period_minutes' => $validated['grace_period_minutes'] ?? 30,
            'status' => $validated['status'] ?? 'scheduled',
        ]);

        if ($session->status === 'scheduled') {
            $this->notifyClass(NotificationCatalog::SESSION_SCHEDULED, $class, [
                'title' => $session->title,
                'date' => NotificationCatalog::date($session->starts_at),
            ]);
        }

        return ApiResponse::success(['session' => $session->load(['classroom', 'schoolClass'])], Response::HTTP_CREATED);
    }

    /**
     * Show session details within a class.
     */
    public function show(string $classId, string $id): JsonResponse
    {
        $session = ClassSession::with([
            'classroom',
            'schoolClass.teacher.user',
            'schoolClass.students.user',
            'attendanceRecords.student.user',
            'attendanceRecords.recordedBy',
            'attendanceRecords.changes.changedBy',
        ])
            ->where('class_id', $classId)
            ->findOrFail($id);

        return ApiResponse::success(['session' => $session]);
    }

    /**
     * Standalone session lookup by ID (for scanner & live roster).
     */
    public function showById(string $id): JsonResponse
    {
        $session = ClassSession::with([
            'classroom',
            'schoolClass.teacher.user',
            'schoolClass.students.user',
            'attendanceRecords.student.user',
            'attendanceRecords.recordedBy',
            'attendanceRecords.changes.changedBy',
        ])->findOrFail($id);

        return ApiResponse::success(['session' => $session]);
    }

    /**
     * Start session (R5-4).
     */
    public function start(Request $request, string $id): JsonResponse
    {
        $session = ClassSession::findOrFail($id);
        $session->update([
            'status' => 'in_progress',
        ]);

        AuditLogger::log(action: 'session.started', entityType: 'ClassSession', entityId: $session->id, payload: ['status' => 'in_progress']);

        return ApiResponse::success([
            'message' => 'تم بدء الجلسة بنجاح.',
            'session' => $session->fresh()->load(['classroom', 'schoolClass']),
        ]);
    }

    /**
     * End session (R5-4).
     */
    public function end(Request $request, string $id): JsonResponse
    {
        $session = ClassSession::with('schoolClass.students.user')->findOrFail($id);
        $session->update([
            'status' => 'completed',
            'ends_at' => $session->ends_at ?? now(),
        ]);

        $markedAbsentCount = 0;
        if ($request->boolean('mark_absent_remaining') && $session->schoolClass) {
            $existingStudentIds = AttendanceRecord::where('session_id', $session->id)
                ->pluck('student_id')
                ->all();

            $unrecordedStudents = $session->schoolClass->students()
                ->whereNotIn('students.id', $existingStudentIds)
                ->get();

            foreach ($unrecordedStudents as $student) {
                AttendanceRecord::create([
                    'session_id' => $session->id,
                    'student_id' => $student->id,
                    'recorded_by_user_id' => $request->user()?->id ?? $session->schoolClass->teacher_staff_id,
                    'status' => 'absent',
                    'attendance_mode' => 'system',
                    'notes' => 'تغيب تلقائي عند إنهاء الجلسة',
                    'recorded_at' => now(),
                ]);
                $markedAbsentCount++;

                // Notification to parent if enabled (OD-33 / P9)
                if (TenantSetting::getValue(TenantSetting::NOTIFY_PARENTS_ON_ABSENCE, true)) {
                    $notifier = app(NotificationService::class);
                    $notifier->send(
                        NotificationCatalog::ATTENDANCE_ABSENT,
                        $notifier->parentUsers($student),
                        ['student' => $student->user?->name, 'title' => $session->title],
                        '/parent/dashboard'
                    );
                }
            }
        }

        AuditLogger::log(
            action: 'session.ended',
            entityType: 'ClassSession',
            entityId: $session->id,
            payload: [
                'status' => 'completed',
                'marked_absent_count' => $markedAbsentCount,
            ]
        );

        return ApiResponse::success([
            'message' => 'تم إنهاء الجلسة بنجاح.'.($markedAbsentCount > 0 ? " ورصد {$markedAbsentCount} طالب كغائب." : ''),
            'marked_absent_count' => $markedAbsentCount,
            'session' => $session->fresh()->load(['classroom', 'schoolClass']),
        ]);
    }

    /**
     * Cancel session (R5-4).
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        $session = ClassSession::findOrFail($id);
        $session->update([
            'status' => 'cancelled',
        ]);

        AuditLogger::log(action: 'session.cancelled', entityType: 'ClassSession', entityId: $session->id, payload: ['status' => 'cancelled']);

        if ($session->schoolClass) {
            $this->notifyClass(NotificationCatalog::SESSION_CANCELLED, $session->schoolClass, ['title' => $session->title]);
        }

        return ApiResponse::success([
            'message' => 'تم إلغاء الجلسة.',
            'session' => $session->fresh()->load(['classroom', 'schoolClass']),
        ]);
    }

    /**
     * @param  array<string, scalar|null>  $params
     */
    private function notifyClass(string $event, SchoolClass $class, array $params): void
    {
        $users = $class->students()->with('user')->get()->map(fn ($student) => $student->user);

        app(NotificationService::class)->send($event, $users, $params, '/student/attendance');
    }
}
