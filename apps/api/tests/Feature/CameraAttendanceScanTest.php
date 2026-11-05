<?php

namespace Tests\Feature;

use App\Domain\Attendance\Services\StudentQrService;
use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Classroom;
use App\Models\ClassSession;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CameraAttendanceScanTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected TenantUser $assistantUser;

    protected TenantUser $student1User;

    protected TenantUser $student2User;

    protected Student $student1;

    protected Student $student2;

    protected SchoolClass $class;

    protected ClassSession $session;

    protected string $assistantToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cleanupTenantDbs();

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $this->tenant = Tenant::create([
            'name' => 'مركز النور التعليمي',
            'slug' => 'p6-nour-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'center',
            'status' => 'active',
            'brand_settings' => [
                'allow_static_student_code_scan' => false,
                'late_after_minutes' => 15,
                'attendance_grace_minutes' => 60,
            ],
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => 'tenant_'.$this->tenant->slug,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($this->tenant);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(RoleSynchronizer::class)->sync();

        $assistantRole = Role::where('name', 'assistant')->firstOrFail();
        $studentRole = Role::where('name', 'student')->firstOrFail();

        $branch = Branch::create(['name' => 'الفرع الرئيسي', 'code' => 'MAIN']);
        $classroom = Classroom::create(['branch_id' => $branch->id, 'name' => 'قاعة 1', 'capacity' => 40]);

        // Assistant user
        $this->assistantUser = TenantUser::create([
            'name' => 'مساعد المستر',
            'email' => 'assistant@nour.test',
            'password' => 'secret_pass_123',
            'type' => 'staff',
            'status' => 'active',
        ]);
        $staff = Staff::create([
            'user_id' => $this->assistantUser->id,
            'staff_type' => 'assistant',
            'status' => 'active',
        ]);
        $this->assistantUser->roles()->attach($assistantRole->id);
        $tokenRes = TenantToken::createTokenFor($this->assistantUser);
        $this->assistantToken = $tokenRes['plainTextToken'];

        // Class
        $this->class = SchoolClass::create([
            'branch_id' => $branch->id,
            'name' => 'شعبة الرياضيات المتقدمة',
            'code' => 'MATH-101',
            'status' => 'active',
        ]);

        StaffAssignment::create([
            'staff_id' => $staff->id,
            'assignable_type' => 'class',
            'assignable_id' => $this->class->id,
        ]);

        // Students
        $this->student1User = TenantUser::create([
            'name' => 'عمر خالد',
            'email' => 'omar@student.test',
            'password' => 'secret_pass_123',
            'type' => 'student',
            'status' => 'active',
        ]);
        $this->student1 = Student::create([
            'user_id' => $this->student1User->id,
            'student_code' => 'STU-1001',
            'status' => 'active',
        ]);
        $this->student1User->roles()->attach($studentRole->id);

        $this->student2User = TenantUser::create([
            'name' => 'سارة أحمد',
            'email' => 'sara@student.test',
            'password' => 'secret_pass_123',
            'type' => 'student',
            'status' => 'active',
        ]);
        $this->student2 = Student::create([
            'user_id' => $this->student2User->id,
            'student_code' => 'STU-1002',
            'status' => 'active',
        ]);
        $this->student2User->roles()->attach($studentRole->id);

        // Enroll students into class
        $this->class->students()->attach($this->student1->id, ['id' => (string) Str::uuid(), 'status' => 'active']);
        $this->class->students()->attach($this->student2->id, ['id' => (string) Str::uuid(), 'status' => 'active']);

        // Session
        $this->session = ClassSession::create([
            'class_id' => $this->class->id,
            'classroom_id' => $classroom->id,
            'title' => 'حصة الجبر والهندسة الفراغية',
            'starts_at' => now()->subMinutes(5),
            'ends_at' => now()->addMinutes(55),
            'status' => 'in_progress',
            'attendance_mode' => 'qr',
            'timing_mode' => 'scheduled',
            'grace_period_minutes' => 60,
        ]);
    }

    protected function tearDown(): void
    {
        $this->cleanupTenantDbs();
        parent::tearDown();
    }

    protected function cleanupTenantDbs(): void
    {
        app(TenantDatabaseManager::class)->purgeConnection();
        $dir = database_path('tenants');
        if (is_dir($dir)) {
            foreach (glob($dir.DIRECTORY_SEPARATOR.'tenant_p6-nour-*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    protected function authHeaders(): array
    {
        return [
            'Authorization' => 'Bearer '.$this->assistantToken,
            'X-Tenant-Slug' => $this->tenant->slug,
        ];
    }

    public function test_my_sessions_filters_by_today(): void
    {
        // 1. Session today (already created in setUp)
        // 2. Session tomorrow
        ClassSession::create([
            'class_id' => $this->class->id,
            'title' => 'حصة الغد',
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDay()->addHour(),
            'status' => 'scheduled',
            'attendance_mode' => 'qr',
        ]);

        $res = $this->withHeaders($this->authHeaders())->getJson('/api/v1/me/sessions?date=today');

        $res->assertOk();
        $sessions = $res->json('data');
        $this->assertCount(1, $sessions);
        $this->assertSame($this->session->id, $sessions[0]['id']);
    }

    public function test_qr_scan_marks_as_present_when_on_time(): void
    {
        $qrService = app(StudentQrService::class);
        $tokenData = $qrService->generateToken($this->student1, $this->tenant);

        $res = $this->withHeaders($this->authHeaders())->postJson("/api/v1/sessions/{$this->session->id}/attendance/scan", [
            'token' => $tokenData['token'],
        ]);

        $res->assertOk();
        $this->assertFalse($res->json('data.already_recorded'));
        $this->assertSame('present', $res->json('data.student.status'));

        $this->assertDatabaseHas('attendance_records', [
            'session_id' => $this->session->id,
            'student_id' => $this->student1->id,
            'status' => 'present',
        ], 'tenant');
    }

    public function test_qr_scan_marks_as_late_when_past_grace_period(): void
    {
        // Set session start time to 30 minutes ago (grace is 15 min)
        $this->session->update([
            'starts_at' => now()->subMinutes(30),
        ]);

        $qrService = app(StudentQrService::class);
        $tokenData = $qrService->generateToken($this->student1, $this->tenant);

        $res = $this->withHeaders($this->authHeaders())->postJson("/api/v1/sessions/{$this->session->id}/attendance/scan", [
            'token' => $tokenData['token'],
        ]);

        $res->assertOk();
        $this->assertFalse($res->json('data.already_recorded'));
        $this->assertSame('late', $res->json('data.student.status'));

        $this->assertDatabaseHas('attendance_records', [
            'session_id' => $this->session->id,
            'student_id' => $this->student1->id,
            'status' => 'late',
        ], 'tenant');
    }

    public function test_qr_scan_rejects_unregistered_student(): void
    {
        $unregisteredUser = TenantUser::create([
            'name' => 'طالب غريب',
            'email' => 'stranger@test.local',
            'password' => 'secret_pass_123',
            'type' => 'student',
            'status' => 'active',
        ]);
        $unregistered = Student::create([
            'user_id' => $unregisteredUser->id,
            'student_code' => 'STU-9999',
            'status' => 'active',
        ]);

        $qrService = app(StudentQrService::class);
        $tokenData = $qrService->generateToken($unregistered, $this->tenant);

        $res = $this->withHeaders($this->authHeaders())->postJson("/api/v1/sessions/{$this->session->id}/attendance/scan", [
            'token' => $tokenData['token'],
        ]);

        $res->assertStatus(422);
        $this->assertSame('STUDENT_NOT_IN_CLASS', $res->json('error.code'));
    }

    public function test_delete_attendance_record_undo(): void
    {
        // 1. Record attendance
        $record = AttendanceRecord::create([
            'session_id' => $this->session->id,
            'student_id' => $this->student1->id,
            'recorded_by_user_id' => $this->assistantUser->id,
            'status' => 'present',
            'attendance_mode' => 'qr',
            'recorded_at' => now(),
        ]);

        $this->assertDatabaseHas('attendance_records', ['id' => $record->id], 'tenant');

        // 2. Undo/Delete within 30 seconds
        $res = $this->withHeaders($this->authHeaders())->deleteJson("/api/v1/attendance-records/{$record->id}", [
            'reason' => 'تراجع سريع عن المسح الخاطئ',
        ]);

        $res->assertOk();
        $this->assertDatabaseMissing('attendance_records', ['id' => $record->id], 'tenant');
    }

    public function test_end_session_marks_unrecorded_students_as_absent(): void
    {
        // student1 is present
        AttendanceRecord::create([
            'session_id' => $this->session->id,
            'student_id' => $this->student1->id,
            'recorded_by_user_id' => $this->assistantUser->id,
            'status' => 'present',
            'attendance_mode' => 'qr',
            'recorded_at' => now(),
        ]);

        // End session and mark remaining students as absent
        $res = $this->withHeaders($this->authHeaders())->postJson("/api/v1/sessions/{$this->session->id}/end", [
            'mark_absent_remaining' => true,
        ]);

        $res->assertOk();
        $this->assertSame(1, $res->json('data.marked_absent_count'));

        // student1 is still present
        $this->assertDatabaseHas('attendance_records', [
            'session_id' => $this->session->id,
            'student_id' => $this->student1->id,
            'status' => 'present',
        ], 'tenant');

        // student2 was unrecorded, now marked as absent
        $this->assertDatabaseHas('attendance_records', [
            'session_id' => $this->session->id,
            'student_id' => $this->student2->id,
            'status' => 'absent',
            'attendance_mode' => 'system',
        ], 'tenant');
    }
}
