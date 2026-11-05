<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Exceptions\AttendanceScanException;
use App\Domain\Attendance\Services\StudentQrService;
use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Http\Controllers\Controller;
use App\Jobs\ComputeStudentAnalytics;
use App\Models\AccessCredential;
use App\Models\AttendanceRecord;
use App\Models\AttendanceRecordChange;
use App\Models\ClassSession;
use App\Models\Student;
use App\Models\TenantSetting;
use App\Models\TenantUser;
use App\Support\ApiResponse;
use App\Support\Audit\AuditLogger;
use App\Support\Authorization\ScopeResolver;
use App\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AttendanceController extends Controller
{
    /**
     * Record manual attendance for a student in a session (R5-4).
     */
    public function record(Request $request, string $sessionId): JsonResponse
    {
        $session = ClassSession::with('schoolClass')->findOrFail($sessionId);

        /** @var TenantUser $user */
        $user = $request->user();

        // 1. Scanner / Recorder Authorization Scope
        if (! $user->hasPermissionTo('attendance.record')) {
            throw new AuthorizationException('You do not have permission to record attendance.');
        }

        $scope = ScopeResolver::resolveScope($user, 'attendance.record');
        if ($scope === 'own' && $session->schoolClass) {
            if (! $user->staff || $session->schoolClass->teacher_staff_id !== $user->staff->id) {
                throw new AuthorizationException('You can only record attendance for your own classes.');
            }
        }

        // 2. Session Status Check
        if (in_array($session->status, ['completed', 'cancelled'], true)) {
            return ApiResponse::error(
                'SESSION_CLOSED',
                'الجلسة منتهية أو ملغاة ولا يمكن تسجيل الحضور بها.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // 3. Attendance Mode Check
        if ($session->attendance_mode === 'qr') {
            return ApiResponse::error(
                'MANUAL_ATTENDANCE_DISABLED',
                'التسجيل اليدوي غير مفعل لهذه الجلسة (وضع الـ QR فقط).',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $validated = $request->validate([
            'student_id' => 'required|uuid|exists:tenant.students,id',
            'status' => 'required|string|in:present,absent,late,excused',
            'notes' => 'nullable|string|max:500',
        ]);

        // 4. Verify Student Enrolled in Class
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

        $record = AttendanceRecord::updateOrCreate(
            [
                'session_id' => $session->id,
                'student_id' => $validated['student_id'],
            ],
            [
                'recorded_by_user_id' => $user->id,
                'status' => $validated['status'],
                'attendance_mode' => 'manual',
                'notes' => $validated['notes'] ?? null,
                'recorded_at' => now(),
            ]
        );

        AuditLogger::log(
            action: 'attendance.recorded',
            entityType: 'AttendanceRecord',
            entityId: $record->id,
            payload: [
                'session_id' => $session->id,
                'student_id' => $validated['student_id'],
                'status' => $validated['status'],
                'mode' => 'manual',
            ]
        );

        $this->afterManualRecord($session, $record);

        return ApiResponse::success([
            'record' => $record->load(['student.user', 'recordedBy']),
        ], Response::HTTP_OK);
    }

    /**
     * Record attendance via QR code scan with full validation (R5-2).
     */
    public function qrScan(
        Request $request,
        string $sessionId,
        TenantContext $context,
        StudentQrService $qrService
    ): JsonResponse {
        $session = ClassSession::with(['schoolClass.students.user'])->findOrFail($sessionId);

        /** @var TenantUser $user */
        $user = $request->user();

        // 1. Scanner Authorization Check
        if (! $user->hasPermissionTo('attendance.scan') && ! $user->hasPermissionTo('attendance.record')) {
            throw new AuthorizationException('You do not have permission to scan attendance.');
        }

        $scope = ScopeResolver::resolveScope($user, 'attendance.record')
            ?? ScopeResolver::resolveScope($user, 'attendance.scan');

        if ($scope === 'own' && $session->schoolClass) {
            if (! $user->staff || $session->schoolClass->teacher_staff_id !== $user->staff->id) {
                throw new AuthorizationException('You can only scan attendance for your own classes.');
            }
        }

        // 2. Session Status Check
        if (in_array($session->status, ['completed', 'cancelled'], true)) {
            return ApiResponse::error(
                'SESSION_CLOSED',
                'الجلسة منتهية أو ملغاة ولا يمكن تسجيل الحضور بها.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // 3. Attendance Mode Check
        if ($session->attendance_mode === 'manual') {
            return ApiResponse::error(
                'QR_SCAN_DISABLED',
                'مسح الـ QR غير متاح لهذه الجلسة (وضع التسجيل اليدوي فقط).',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // 4. Timing Mode & Window Check (scheduled mode)
        $tenant = $context->getTenantOrFail();
        $timingMode = $session->timing_mode ?? 'scheduled';

        if ($timingMode === 'scheduled' && $session->starts_at) {
            $grace = $session->grace_period_minutes ?? (int) ($tenant->brand_settings['attendance_grace_minutes'] ?? 30);
            $windowStart = $session->starts_at->clone()->subMinutes($grace);
            $windowEnd = $session->ends_at
                ? $session->ends_at->clone()->addMinutes($grace)
                : $session->starts_at->clone()->addHours(4);

            $now = now();
            if ($now->lt($windowStart) || $now->gt($windowEnd)) {
                return ApiResponse::error(
                    'SESSION_OUTSIDE_WINDOW',
                    'الوقت الحالي خارج نافذة تسجيل حضور هذه الجلسة.',
                    Response::HTTP_UNPROCESSABLE_ENTITY,
                    [
                        'window_start' => $windowStart->toIso8601String(),
                        'window_end' => $windowEnd->toIso8601String(),
                    ]
                );
            }
        }

        // 5. Resolve Student from Static AccessCredential (OD-32), Dynamic Token, or Legacy qr_data
        $student = null;
        $rawScan = trim((string) ($request->input('token') ?? $request->input('qr_data')));

        // Check if raw scan matches a printed card AccessCredential (OD-32)
        if ($rawScan !== '') {
            $credential = AccessCredential::where('credential_code', $rawScan)->first();
            if ($credential) {
                if ($credential->status === 'revoked') {
                    return ApiResponse::error(
                        'CREDENTIAL_REVOKED',
                        'بطاقة الدخول ملغاة وغير صالحة للاستخدام.',
                        Response::HTTP_UNPROCESSABLE_ENTITY
                    );
                }
                if ($credential->expires_at && $credential->expires_at->isPast()) {
                    return ApiResponse::error(
                        'CREDENTIAL_EXPIRED',
                        'بطاقة الدخول منتهية الصلاحية.',
                        Response::HTTP_UNPROCESSABLE_ENTITY
                    );
                }
                if ($credential->status !== 'active') {
                    return ApiResponse::error(
                        'CREDENTIAL_INACTIVE',
                        'بطاقة الدخول غير مفعلة.',
                        Response::HTTP_UNPROCESSABLE_ENTITY
                    );
                }
                $student = $credential->student()->with('user')->first();
            }
        }

        if (! $student && $request->filled('token')) {
            try {
                $verified = $qrService->verifyToken((string) $request->input('token'), $tenant);
                $student = $verified['student'];
            } catch (AttendanceScanException $e) {
                return ApiResponse::error(
                    $e->getErrorCode(),
                    $e->getMessage(),
                    Response::HTTP_UNPROCESSABLE_ENTITY,
                    $e->getExtra()
                );
            }
        } elseif (! $student && $request->filled('qr_data')) {
            // Legacy / barcode card scan path
            $allowStatic = (bool) ($tenant->brand_settings['allow_static_student_code_scan'] ?? false);
            if (! $allowStatic) {
                return ApiResponse::error(
                    'STATIC_SCAN_NOT_ALLOWED',
                    'مسح كود الطالب الثابت غير مسموح به في هذه المؤسسة. يرجى مسح رمز الـ QR الديناميكي للبطاقة.',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $qrData = trim((string) $request->input('qr_data'));
            if (Str::isUuid($qrData)) {
                $student = Student::with('user')->find($qrData);
            }
            if (! $student) {
                $student = Student::with('user')->where('student_code', $qrData)->first();
            }

            if (! $student) {
                return ApiResponse::error(
                    'INVALID_QR_CREDENTIAL',
                    'لم يتم العثور على طالب مطابق لكود البطاقة الممسوح.',
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }
        } elseif (! $student) {
            return ApiResponse::error(
                'MISSING_SCAN_DATA',
                'يرجى إرسال رمز الـ QR (token).',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // 6. Verify Student Active
        if ($student->status !== 'active') {
            return ApiResponse::error(
                'STUDENT_INACTIVE',
                'حساب الطالب غير نشط أو معلق.',
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        // 7. Verify Student Enrolled in Class
        $isEnrolled = $session->schoolClass->students()
            ->where('students.id', $student->id)
            ->exists();

        if (! $isEnrolled) {
            return ApiResponse::error(
                'STUDENT_NOT_IN_CLASS',
                'الطالب غير مسجل في هذه المجموعة/الفصل الدراسي.',
                Response::HTTP_UNPROCESSABLE_ENTITY,
                [
                    'student_name' => $student->user?->name,
                    'student_code' => $student->student_code,
                    'class_name' => $session->schoolClass->name,
                ]
            );
        }

        // 8. Deterministic Duplicates (Second scan returns 200 with already_recorded: true)
        $existingRecord = AttendanceRecord::where('session_id', $session->id)
            ->where('student_id', $student->id)
            ->first();

        $studentPayload = [
            'id' => $student->id,
            'name' => $student->user?->name,
            'student_code' => $student->student_code,
            'photo_initial' => mb_substr($student->user?->name ?? 'ط', 0, 1),
        ];

        if ($existingRecord) {
            return ApiResponse::success([
                'already_recorded' => true,
                'record' => $existingRecord->load(['student.user', 'recordedBy']),
                'student' => array_merge($studentPayload, ['status' => $existingRecord->status]),
                'message' => 'مسجل مسبقاً في هذه الجلسة',
            ], Response::HTTP_OK);
        }

        // 9. Check Late Status (OD-29 / P6: late_after_minutes setting, default 15 min)
        $lateThreshold = (int) ($tenant->brand_settings['late_after_minutes'] ?? 15);
        $isLate = false;
        if ($session->starts_at && now()->gt($session->starts_at->clone()->addMinutes($lateThreshold))) {
            $isLate = true;
        }
        $status = $isLate ? 'late' : 'present';

        // 10. Record New Attendance
        $record = AttendanceRecord::create([
            'session_id' => $session->id,
            'student_id' => $student->id,
            'recorded_by_user_id' => $user->id,
            'status' => $status,
            'attendance_mode' => 'qr',
            'notes' => $isLate ? 'Recorded as late via dynamic QR scan.' : 'Recorded via secure dynamic QR scan.',
            'recorded_at' => now(),
        ]);

        AuditLogger::log(
            action: 'attendance.scanned',
            entityType: 'AttendanceRecord',
            entityId: $record->id,
            payload: [
                'session_id' => $session->id,
                'student_id' => $student->id,
                'status' => $status,
                'mode' => 'qr',
            ]
        );

        return ApiResponse::success([
            'already_recorded' => false,
            'record' => $record->load(['student.user', 'recordedBy']),
            'student' => array_merge($studentPayload, ['status' => $status]),
            'message' => $isLate ? 'تم تسجيل حضور الطالب (متأخر)' : 'تم تسجيل الحضور بنجاح',
        ], Response::HTTP_OK);
    }

    /**
     * Correct an attendance record with mandatory reason & audit history (R5-4).
     */
    public function correct(Request $request, string $id): JsonResponse
    {
        $record = AttendanceRecord::with(['session.schoolClass'])->findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('attendance.correct') && ! $user->hasPermissionTo('attendance.record')) {
            throw new AuthorizationException('You do not have permission to correct attendance.');
        }

        $validated = $request->validate([
            'status' => 'required|string|in:present,absent,late,excused',
            'reason' => 'required|string|min:3|max:500',
        ]);

        $oldStatus = $record->status;
        $newStatus = $validated['status'];
        $reason = trim($validated['reason']);

        // Record history change
        AttendanceRecordChange::create([
            'attendance_record_id' => $record->id,
            'changed_by_user_id' => $user->id,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'reason' => $reason,
            'created_at' => now(),
        ]);

        $record->update([
            'status' => $newStatus,
            'notes' => $reason,
        ]);

        AuditLogger::log(
            action: 'attendance.corrected',
            entityType: 'AttendanceRecord',
            entityId: $record->id,
            payload: [
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'reason' => $reason,
            ]
        );

        return ApiResponse::success([
            'message' => 'تم تعديل حالة الحضور بنجاح.',
            'record' => $record->fresh()->load(['student.user', 'recordedBy', 'changes.changedBy']),
        ]);
    }

    /**
     * Delete an attendance record (e.g. quick undo of scan error within 30 seconds) (P6.6).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $record = AttendanceRecord::findOrFail($id);

        /** @var TenantUser $user */
        $user = $request->user();

        if (! $user->hasPermissionTo('attendance.correct') && ! $user->hasPermissionTo('attendance.record')) {
            throw new AuthorizationException('You do not have permission to delete attendance records.');
        }

        AuditLogger::log(
            action: 'attendance.deleted',
            entityType: 'AttendanceRecord',
            entityId: $record->id,
            payload: [
                'session_id' => $record->session_id,
                'student_id' => $record->student_id,
                'status' => $record->status,
                'reason' => $request->input('reason', 'تراجع فوري عن المسح'),
            ]
        );

        $record->delete();

        return ApiResponse::success([
            'message' => 'تم التراجع عن تسجيل الحضور بنجاح.',
        ]);
    }

    /**
     * Generate attendance report for a session.
     */
    public function report(string $sessionId): JsonResponse
    {
        $session = ClassSession::with([
            'schoolClass.students.user',
            'attendanceRecords.student.user',
            'attendanceRecords.recordedBy',
            'attendanceRecords.changes.changedBy',
        ])->findOrFail($sessionId);

        $enrolledStudents = $session->schoolClass ? $session->schoolClass->students : collect();
        $totalEnrolled = $enrolledStudents->count();

        $records = $session->attendanceRecords;
        $presentCount = $records->where('status', 'present')->count();
        $absentCount = $records->where('status', 'absent')->count();
        $lateCount = $records->where('status', 'late')->count();
        $excusedCount = $records->where('status', 'excused')->count();

        $attendanceRate = $totalEnrolled > 0
            ? round(($presentCount / $totalEnrolled) * 100, 2)
            : 0;

        return ApiResponse::success([
            'session' => [
                'id' => $session->id,
                'title' => $session->title,
                'starts_at' => $session->starts_at,
                'ends_at' => $session->ends_at,
                'status' => $session->status,
                'attendance_mode' => $session->attendance_mode,
                'timing_mode' => $session->timing_mode,
                'class' => $session->schoolClass ? [
                    'id' => $session->schoolClass->id,
                    'name' => $session->schoolClass->name,
                ] : null,
            ],
            'summary' => [
                'total_enrolled' => $totalEnrolled,
                'present' => $presentCount,
                'absent' => $absentCount,
                'late' => $lateCount,
                'excused' => $excusedCount,
                'attendance_rate_percentage' => $attendanceRate,
            ],
            'records' => $records,
        ]);
    }

    /**
     * Parents hear about absences (tenant setting, on by default); analytics refresh (debounced).
     */
    private function afterManualRecord(ClassSession $session, AttendanceRecord $record): void
    {
        $tenantId = app(TenantContext::class)->getTenantId();
        if ($tenantId) {
            ComputeStudentAnalytics::dispatch($tenantId, $record->student_id);
        }

        if (! in_array($record->status, ['absent', 'late'], true) || ! TenantSetting::getValue(TenantSetting::NOTIFY_PARENTS_ON_ABSENCE, true)) {
            return;
        }

        $student = Student::with('user', 'parents.user')->find($record->student_id);
        if ($student) {
            $event = $record->status === 'late' ? NotificationCatalog::ATTENDANCE_LATE : NotificationCatalog::ATTENDANCE_ABSENT;
            $notifier = app(NotificationService::class);
            $notifier->send(
                $event,
                $notifier->parentUsers($student),
                ['student' => $student->user?->name, 'title' => $session->title],
                '/parent/dashboard'
            );
        }
    }
}
