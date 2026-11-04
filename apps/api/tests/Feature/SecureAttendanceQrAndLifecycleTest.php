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
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class SecureAttendanceQrAndLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenantA;

    protected Tenant $tenantB;

    protected TenantUser $teacherUser;

    protected TenantUser $assistantUser;

    protected TenantUser $studentAUser;

    protected TenantUser $studentBUser;

    protected Student $studentA;

    protected Student $studentB;

    protected SchoolClass $classA;

    protected ClassSession $sessionA;

    protected string $teacherToken;

    protected string $assistantToken;

    protected string $studentAToken;

    protected string $studentBToken;

    protected function setUp(): void
    {
        parent::setUp();

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        // 1. Tenant A
        $this->tenantA = Tenant::create([
            'name' => 'Al-Hikma Academy',
            'slug' => 'r5-hikma',
            'type' => 'educational_center',
            'status' => 'active',
            'brand_settings' => [
                'allow_static_student_code_scan' => false, // Default: false
                'attendance_grace_minutes' => 30,
            ],
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenantA->id,
            'connection_identifier' => 'tenant_'.$this->tenantA->slug,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($this->tenantA);
        $context->setTenant($this->tenantA);
        $dbManager->configureConnection($this->tenantA);
        app(RoleSynchronizer::class)->sync();

        // 2. Tenant B (for cross-tenant tests)
        $this->tenantB = Tenant::create([
            'name' => 'Al-Rowad Institute',
            'slug' => 'r5-rowad',
            'type' => 'educational_center',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenantB->id,
            'connection_identifier' => 'tenant_'.$this->tenantB->slug,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($this->tenantB);

        // Reconnect to Tenant A
        $context->setTenant($this->tenantA);
        $dbManager->configureConnection($this->tenantA);

        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $assistantRole = Role::where('name', 'assistant')->firstOrFail();
        $studentRole = Role::where('name', 'student')->firstOrFail();

        // Branch & Classroom
        $branch = Branch::create(['name' => 'Main Campus', 'code' => 'MAIN']);
        $classroom = Classroom::create(['branch_id' => $branch->id, 'name' => 'Hall 1', 'capacity' => 50]);

        // Teacher
        $this->teacherUser = TenantUser::create([
            'name' => 'Teacher Taha',
            'email' => 'taha@hikma.edu',
            'password' => bcrypt('secret123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $this->teacherUser->roles()->attach($teacherRole->id);
        $teacherStaff = Staff::create(['user_id' => $this->teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $this->teacherToken = TenantToken::createTokenFor($this->teacherUser)['plainTextToken'];

        // Assistant
        $this->assistantUser = TenantUser::create([
            'name' => 'Assistant Mona',
            'email' => 'mona@hikma.edu',
            'password' => bcrypt('secret123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $this->assistantUser->roles()->attach($assistantRole->id);
        Staff::create(['user_id' => $this->assistantUser->id, 'staff_type' => 'assistant', 'status' => 'active']);
        $this->assistantToken = TenantToken::createTokenFor($this->assistantUser)['plainTextToken'];

        // Student A (Enrolled in class)
        $this->studentAUser = TenantUser::create([
            'name' => 'Student Youssef',
            'email' => 'youssef@hikma.edu',
            'password' => bcrypt('secret123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $this->studentAUser->roles()->attach($studentRole->id);
        $this->studentA = Student::create([
            'user_id' => $this->studentAUser->id,
            'student_code' => 'STU-HIK-101',
            'grade_level' => 'Grade 12',
            'status' => 'active',
        ]);
        $this->studentAToken = TenantToken::createTokenFor($this->studentAUser)['plainTextToken'];

        // Student B (NOT enrolled in class)
        $this->studentBUser = TenantUser::create([
            'name' => 'Student Sara',
            'email' => 'sara@hikma.edu',
            'password' => bcrypt('secret123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $this->studentBUser->roles()->attach($studentRole->id);
        $this->studentB = Student::create([
            'user_id' => $this->studentBUser->id,
            'student_code' => 'STU-HIK-102',
            'grade_level' => 'Grade 12',
            'status' => 'active',
        ]);
        $this->studentBToken = TenantToken::createTokenFor($this->studentBUser)['plainTextToken'];

        // Class & Session
        $this->classA = SchoolClass::create([
            'teacher_staff_id' => $teacherStaff->id,
            'branch_id' => $branch->id,
            'name' => 'Physics Mechanics 2026',
            'code' => 'PHY-MEC-26',
            'status' => 'active',
        ]);
        // Enroll Student A only
        $this->classA->students()->attach($this->studentA->id, ['id' => (string) Str::uuid(), 'status' => 'active']);

        $this->sessionA = ClassSession::create([
            'class_id' => $this->classA->id,
            'classroom_id' => $classroom->id,
            'title' => 'Mechanics Lecture 1',
            'starts_at' => now()->subMinutes(10),
            'ends_at' => now()->addMinutes(80),
            'attendance_mode' => 'both',
            'timing_mode' => 'scheduled',
            'grace_period_minutes' => 30,
            'status' => 'in_progress',
        ]);
    }

    protected function tearDown(): void
    {
        app(TenantDatabaseManager::class)->purgeConnection();
        DB::disconnect('tenant_'.$this->tenantA->slug);
        DB::disconnect('tenant_'.$this->tenantB->slug);

        $pathA = database_path('tenants/tenant_'.$this->tenantA->slug.'.sqlite');
        $pathB = database_path('tenants/tenant_'.$this->tenantB->slug.'.sqlite');
        if (file_exists($pathA)) {
            @unlink($pathA);
        }
        if (file_exists($pathB)) {
            @unlink($pathB);
        }

        parent::tearDown();
    }

    /** @test */
    public function test_student_can_generate_short_lived_secure_qr_token(): void
    {
        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->studentAToken}",
        ])->getJson('/api/v1/me/attendance-qr');

        $response->assertStatus(200)
            ->assertJsonPath('data.expires_in_seconds', 60)
            ->assertJsonPath('data.student.id', $this->studentA->id)
            ->assertJsonPath('data.student.name', 'Student Youssef');

        $token = $response->json('data.token');
        $this->assertNotEmpty($token);

        // Verify token does not contain raw student code
        $this->assertStringNotContainsString('STU-HIK-101', $token);
    }

    /** @test */
    public function test_assistant_scans_valid_dynamic_qr_token_and_duplicate_scan_is_deterministic(): void
    {
        // 1. Student generates QR token
        $qrResp = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->studentAToken}",
        ])->getJson('/api/v1/me/attendance-qr');
        $token = $qrResp->json('data.token');

        // 2. Assistant scans token
        $scanResp1 = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
            'token' => $token,
        ]);

        $scanResp1->assertStatus(200)
            ->assertJsonPath('data.already_recorded', false)
            ->assertJsonPath('data.student.id', $this->studentA->id)
            ->assertJsonPath('data.student.status', 'present')
            ->assertJsonPath('data.message', 'تم تسجيل الحضور بنجاح');

        $this->assertDatabaseHas('attendance_records', [
            'session_id' => $this->sessionA->id,
            'student_id' => $this->studentA->id,
            'status' => 'present',
            'attendance_mode' => 'qr',
        ], 'tenant');

        // 3. Duplicate Scan: Assistant scans same student again -> returns 200 with already_recorded: true
        $scanResp2 = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
            'token' => $token,
        ]);

        $scanResp2->assertStatus(200)
            ->assertJsonPath('data.already_recorded', true)
            ->assertJsonPath('data.student.id', $this->studentA->id)
            ->assertJsonPath('data.message', 'مسجل مسبقاً في هذه الجلسة');
    }

    /** @test */
    public function test_expired_qr_token_is_rejected_with_arabic_reason(): void
    {
        // Freeze time in future past 60s
        Carbon::setTestNow(now()->subSeconds(75));
        $qrResp = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->studentAToken}",
        ])->getJson('/api/v1/me/attendance-qr');
        $expiredToken = $qrResp->json('data.token');

        // Reset to present
        Carbon::setTestNow();

        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
            'token' => $expiredToken,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'QR_TOKEN_EXPIRED');
    }

    /** @test */
    public function test_tampered_qr_token_is_rejected(): void
    {
        $qrResp = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->studentAToken}",
        ])->getJson('/api/v1/me/attendance-qr');
        $validToken = $qrResp->json('data.token');

        // Tamper with token signature
        $tamperedToken = $validToken.'HACKED';

        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
            'token' => $tamperedToken,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_QR_SIGNATURE');
    }

    /** @test */
    public function test_cross_tenant_qr_token_is_rejected(): void
    {
        // Generate token under Tenant B
        $qrService = app(StudentQrService::class);
        $tokenFromTenantB = $qrService->generateToken($this->studentA, $this->tenantB)['token'];

        // Assistant in Tenant A scans token issued for Tenant B
        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
            'token' => $tokenFromTenantB,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_QR_SIGNATURE');
    }

    /** @test */
    public function test_student_not_enrolled_in_class_is_rejected(): void
    {
        // Student B is NOT enrolled in classA
        $qrResp = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->studentBToken}",
        ])->getJson('/api/v1/me/attendance-qr');
        $tokenB = $qrResp->json('data.token');

        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
            'token' => $tokenB,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'STUDENT_NOT_IN_CLASS');
    }

    /** @test */
    public function test_static_student_code_scan_is_rejected_by_default_when_disabled(): void
    {
        // Tenant A has allow_static_student_code_scan = false
        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
            'qr_data' => 'STU-HIK-101',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'STATIC_SCAN_NOT_ALLOWED');
    }

    /** @test */
    public function test_scheduled_session_outside_grace_window_is_rejected(): void
    {
        // Session started 5 hours ago and ended 3 hours ago (outside 30m grace)
        $pastSession = ClassSession::create([
            'class_id' => $this->classA->id,
            'title' => 'Yesterday Session',
            'starts_at' => now()->subHours(5),
            'ends_at' => now()->subHours(3),
            'attendance_mode' => 'both',
            'timing_mode' => 'scheduled',
            'grace_period_minutes' => 30,
            'status' => 'in_progress',
        ]);

        $qrResp = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->studentAToken}",
        ])->getJson('/api/v1/me/attendance-qr');
        $token = $qrResp->json('data.token');

        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->assistantToken}",
        ])->postJson("/api/v1/sessions/{$pastSession->id}/attendance/scan", [
            'token' => $token,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'SESSION_OUTSIDE_WINDOW');
    }

    /** @test */
    public function test_attendance_correction_requires_reason_and_audit_history(): void
    {
        // 1. Record initial attendance
        $record = AttendanceRecord::create([
            'session_id' => $this->sessionA->id,
            'student_id' => $this->studentA->id,
            'recorded_by_user_id' => $this->assistantUser->id,
            'status' => 'absent',
            'attendance_mode' => 'manual',
            'recorded_at' => now(),
        ]);

        // 2. Teacher corrects to 'excused' with reason
        $correctResp = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->teacherToken}",
        ])->putJson("/api/v1/attendance-records/{$record->id}", [
            'status' => 'excused',
            'reason' => 'قدم عذراً طبياً معتمداً من المستشفى',
        ]);

        $correctResp->assertStatus(200)
            ->assertJsonPath('data.record.status', 'excused')
            ->assertJsonPath('data.record.changes.0.old_status', 'absent')
            ->assertJsonPath('data.record.changes.0.new_status', 'excused')
            ->assertJsonPath('data.record.changes.0.reason', 'قدم عذراً طبياً معتمداً من المستشفى');

        $this->assertDatabaseHas('attendance_record_changes', [
            'attendance_record_id' => $record->id,
            'old_status' => 'absent',
            'new_status' => 'excused',
            'reason' => 'قدم عذراً طبياً معتمداً من المستشفى',
        ], 'tenant');
    }

    /** @test */
    public function test_session_lifecycle_start_end_cancel(): void
    {
        $session = ClassSession::create([
            'class_id' => $this->classA->id,
            'title' => 'Lifecycle Test Session',
            'starts_at' => now()->addHour(),
            'status' => 'scheduled',
        ]);

        // Start
        $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->teacherToken}",
        ])->postJson("/api/v1/sessions/{$session->id}/start")
            ->assertStatus(200)
            ->assertJsonPath('data.session.status', 'in_progress');

        // End
        $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->teacherToken}",
        ])->postJson("/api/v1/sessions/{$session->id}/end")
            ->assertStatus(200)
            ->assertJsonPath('data.session.status', 'completed');

        // Cancel
        $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->teacherToken}",
        ])->postJson("/api/v1/sessions/{$session->id}/cancel")
            ->assertStatus(200)
            ->assertJsonPath('data.session.status', 'cancelled');
    }

    /** @test */
    public function test_student_can_fetch_own_attendance_history(): void
    {
        AttendanceRecord::create([
            'session_id' => $this->sessionA->id,
            'student_id' => $this->studentA->id,
            'recorded_by_user_id' => $this->teacherUser->id,
            'status' => 'present',
            'attendance_mode' => 'qr',
            'recorded_at' => now(),
        ]);

        $response = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenantA->slug,
            'Authorization' => "Bearer {$this->studentAToken}",
        ])->getJson('/api/v1/me/attendance');

        $response->assertStatus(200)
            ->assertJsonPath('data.summary.present', 1)
            ->assertJsonPath('data.summary.attendance_rate', 100)
            ->assertJsonPath('data.classes.0.class_name', 'Physics Mechanics 2026');
    }
}
