<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Classroom;
use App\Models\ClassSession;
use App\Models\Permission;
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
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AttendanceGateTest extends TestCase
{
    use RefreshDatabase;

    protected string $tenantConnA;

    protected string $tenantConnB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConnA = 'test_att_a_'.uniqid();
        $this->tenantConnB = 'test_att_b_'.uniqid();
        $this->cleanupTestDatabases();
    }

    protected function tearDown(): void
    {
        $this->cleanupTestDatabases();
        parent::tearDown();
    }

    protected function cleanupTestDatabases(): void
    {
        app(TenantDatabaseManager::class)->purgeConnection();
        $dir = database_path('tenants');
        if (is_dir($dir)) {
            foreach (glob($dir.DIRECTORY_SEPARATOR.'test_att_*.sqlite') as $file) {
                if (file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    /**
     * Phase J §27 — Attendance Gate:
     * - teacher creates class
     * - teacher creates session
     * - student attendance recorded
     * - qr attendance check
     * - attendance report
     * - tenant isolation on attendance
     */
    public function test_attendance_gate_complete_lifecycle(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        // -------------------------------------------------------------
        // 1. Provision Tenant A (Dar Al-Hikma)
        // -------------------------------------------------------------
        $tenantA = Tenant::create([
            'name' => 'Dar Al-Hikma Center',
            'slug' => 'alhikma',
            'type' => 'educational_center',
            'status' => 'active',
            'brand_settings' => ['allow_static_student_code_scan' => true],
        ]);
        TenantDatabase::create([
            'tenant_id' => $tenantA->id,
            'connection_identifier' => $this->tenantConnA,
            'status' => 'ready',
        ]);
        $dbManager->migrateTenant($tenantA);

        $context->setTenant($tenantA);
        $dbManager->configureConnection($tenantA);

        // Permissions in Tenant A
        $permClassCreate = Permission::create(['name' => 'classes.create', 'module' => 'attendance']);
        $permClassManageStudents = Permission::create(['name' => 'classes.manage_students', 'module' => 'attendance']);
        $permSessionCreate = Permission::create(['name' => 'sessions.create', 'module' => 'attendance']);
        $permAttendanceRecord = Permission::create(['name' => 'attendance.record', 'module' => 'attendance']);
        $permAttendanceView = Permission::create(['name' => 'attendance.view', 'module' => 'attendance']);

        // Roles in Tenant A
        $teacherRole = Role::create(['name' => 'teacher', 'label' => 'Teacher', 'is_system' => true]);
        $teacherRole->permissions()->attach([
            $permClassCreate->id,
            $permClassManageStudents->id,
            $permSessionCreate->id,
            $permAttendanceRecord->id,
            $permAttendanceView->id,
        ]);

        $assistantRole = Role::create(['name' => 'assistant', 'label' => 'Teaching Assistant', 'is_system' => true]);
        $assistantRole->permissions()->attach([
            $permAttendanceRecord->id,
            $permAttendanceView->id,
        ]);

        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        // Branch & Classroom
        $branch = Branch::create(['name' => 'Main Campus', 'code' => 'MAIN']);
        $classroom = Classroom::create([
            'branch_id' => $branch->id,
            'name' => 'Hall 101',
            'capacity' => 40,
        ]);

        // Teacher User
        $teacherUser = TenantUser::create([
            'name' => 'Teacher Mahmoud',
            'email' => 'mahmoud@alhikma.edu',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherUser->roles()->attach($teacherRole->id);
        $teacherStaff = Staff::create([
            'user_id' => $teacherUser->id,
            'staff_type' => 'teacher',
            'status' => 'active',
        ]);
        $teacherToken = TenantToken::createTokenFor($teacherUser)['plainTextToken'];

        // Assistant User
        $assistantUser = TenantUser::create([
            'name' => 'Assistant Salma',
            'email' => 'salma@alhikma.edu',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $assistantUser->roles()->attach($assistantRole->id);
        Staff::create([
            'user_id' => $assistantUser->id,
            'staff_type' => 'assistant',
            'status' => 'active',
        ]);
        $assistantToken = TenantToken::createTokenFor($assistantUser)['plainTextToken'];

        // Student 1 (Yusuf)
        $studentYusufUser = TenantUser::create([
            'name' => 'Student Yusuf',
            'email' => 'yusuf@alhikma.edu',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentYusufUser->roles()->attach($studentRole->id);
        $studentYusuf = Student::create([
            'user_id' => $studentYusufUser->id,
            'student_code' => 'STU-HIK-001',
            'grade_level' => 'Grade 11',
            'status' => 'active',
        ]);
        $studentYusufToken = TenantToken::createTokenFor($studentYusufUser)['plainTextToken'];

        // Student 2 (Mariam)
        $studentMariamUser = TenantUser::create([
            'name' => 'Student Mariam',
            'email' => 'mariam@alhikma.edu',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentMariamUser->roles()->attach($studentRole->id);
        $studentMariam = Student::create([
            'user_id' => $studentMariamUser->id,
            'student_code' => 'STU-HIK-002',
            'grade_level' => 'Grade 11',
            'status' => 'active',
        ]);

        // -------------------------------------------------------------
        // 2. Provision Tenant B (Al-Rowad Institute)
        // -------------------------------------------------------------
        $tenantB = Tenant::create([
            'name' => 'Al-Rowad Institute',
            'slug' => 'alrowad',
            'type' => 'educational_center',
            'status' => 'active',
            'brand_settings' => ['allow_static_student_code_scan' => true],
        ]);
        TenantDatabase::create([
            'tenant_id' => $tenantB->id,
            'connection_identifier' => $this->tenantConnB,
            'status' => 'ready',
        ]);
        $dbManager->migrateTenant($tenantB);

        $context->setTenant($tenantB);
        $dbManager->configureConnection($tenantB);

        $classB = SchoolClass::create([
            'name' => 'Chemistry Year 1',
            'code' => 'CHM-1',
            'status' => 'active',
        ]);
        $sessionB = ClassSession::create([
            'class_id' => $classB->id,
            'title' => 'Lab 1',
            'status' => 'scheduled',
        ]);

        // -------------------------------------------------------------
        // 3. EXECUTE ATTENDANCE GATE VERIFICATIONS
        // -------------------------------------------------------------

        // 1. Teacher creates class in Tenant A
        $createClassResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson('/api/v1/classes', [
            'name' => 'Physics Advanced 2026',
            'code' => 'PHY-ADV-26',
        ]);

        $createClassResp->assertStatus(201)
            ->assertJsonPath('data.class.name', 'Physics Advanced 2026')
            ->assertJsonPath('data.class.code', 'PHY-ADV-26');

        $classId = $createClassResp->json('data.class.id');
        $this->assertNotEmpty($classId);

        // Enroll students into the class
        $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/classes/{$classId}/students", [
            'student_id' => $studentYusuf->id,
        ])->assertStatus(201);

        $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/classes/{$classId}/students", [
            'student_id' => $studentMariam->id,
        ])->assertStatus(201);

        // 2. Teacher creates session for class
        $createSessionResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/classes/{$classId}/sessions", [
            'title' => 'Newtonian Mechanics Session 1',
            'classroom_id' => $classroom->id,
            'starts_at' => now()->toIso8601String(),
            'attendance_mode' => 'both',
        ]);

        $createSessionResp->assertStatus(201)
            ->assertJsonPath('data.session.title', 'Newtonian Mechanics Session 1');

        $sessionId = $createSessionResp->json('data.session.id');
        $this->assertNotEmpty($sessionId);

        // 3. Student attendance recorded (Manual Attendance)
        $manualAttendResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/sessions/{$sessionId}/attendance", [
            'student_id' => $studentYusuf->id,
            'status' => 'present',
            'notes' => 'Arrived on time.',
        ]);

        $manualAttendResp->assertStatus(200)
            ->assertJsonPath('data.record.student_id', $studentYusuf->id)
            ->assertJsonPath('data.record.status', 'present')
            ->assertJsonPath('data.record.attendance_mode', 'manual');

        // 4. QR attendance check (Assistant scans Mariam's student QR code)
        $qrScanResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$assistantToken,
        ])->postJson("/api/v1/sessions/{$sessionId}/attendance/scan", [
            'qr_data' => 'STU-HIK-002', // Mariam's QR code
        ]);

        $qrScanResp->assertStatus(200)
            ->assertJsonPath('data.record.student_id', $studentMariam->id)
            ->assertJsonPath('data.record.status', 'present')
            ->assertJsonPath('data.record.attendance_mode', 'qr')
            ->assertJsonPath('data.student.student_code', 'STU-HIK-002');

        // Unauthorized attendance recording attempt (Student trying to record attendance -> 403 Forbidden)
        $studentAttendAttemptResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$studentYusufToken,
        ])->postJson("/api/v1/sessions/{$sessionId}/attendance", [
            'student_id' => $studentYusuf->id,
            'status' => 'present',
        ]);

        $studentAttendAttemptResp->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        // 5. Attendance report
        $reportResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->getJson("/api/v1/sessions/{$sessionId}/attendance/report");

        $reportResp->assertStatus(200)
            ->assertJsonPath('data.summary.total_enrolled', 2)
            ->assertJsonPath('data.summary.present', 2)
            ->assertJsonPath('data.summary.absent', 0)
            ->assertJsonPath('data.summary.attendance_rate_percentage', 100)
            ->assertJsonCount(2, 'data.records');

        // 6. Cross-Tenant Attendance Isolation (SEC-INV-001)
        // Accessing Tenant B's session from Tenant A endpoint -> 404 Not Found
        $crossTenantSessionResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alhikma',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->getJson("/api/v1/sessions/{$sessionB->id}/attendance/report");

        $crossTenantSessionResp->assertStatus(404);

        // Attempting to record attendance in Tenant B with Tenant A teacher token -> 401 Unauthenticated
        $crossTenantTokenResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alrowad',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/sessions/{$sessionB->id}/attendance", [
            'student_id' => $studentYusuf->id,
            'status' => 'present',
        ]);

        $crossTenantTokenResp->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }
}
