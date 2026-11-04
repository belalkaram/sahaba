<?php

namespace Tests\Feature;

use App\Domain\Reporting\Services\ReportGenerationService;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Classroom;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\MetricMeasurement;
use App\Models\Permission;
use App\Models\ReportInstance;
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
use Illuminate\Support\Str;
use Tests\TestCase;

class AnalyticsAndReportingGateTest extends TestCase
{
    use RefreshDatabase;

    protected string $tenantConnA;

    protected string $tenantConnB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConnA = 'test_anl_a_'.uniqid();
        $this->tenantConnB = 'test_anl_b_'.uniqid();
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'test_anl_*.sqlite') as $file) {
                if (file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    protected function setupTenant(string $slug, string $dbName): array
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $tenant = Tenant::create([
            'name' => 'Tenant '.$slug,
            'slug' => $slug,
            'type' => 'educational_center',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => $dbName,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($tenant);

        $context->setTenant($tenant);
        $dbManager->configureConnection($tenant);

        // Permissions
        $perms = [
            'analytics.view' => Permission::create(['name' => 'analytics.view', 'module' => 'analytics']),
            'analytics.manage' => Permission::create(['name' => 'analytics.manage', 'module' => 'analytics']),
            'reports.view' => Permission::create(['name' => 'reports.view', 'module' => 'reports']),
            'reports.generate' => Permission::create(['name' => 'reports.generate', 'module' => 'reports']),
            'reports.download' => Permission::create(['name' => 'reports.download', 'module' => 'reports']),
        ];

        // Teacher/Staff role
        $staffRole = Role::create(['name' => 'teacher', 'label' => 'Teacher']);
        foreach ($perms as $perm) {
            $staffRole->permissions()->attach($perm->id);
        }

        // Student role (minimal)
        $studentRole = Role::create(['name' => 'student', 'label' => 'Student']);

        // Teacher user
        $teacherUser = TenantUser::create([
            'name' => 'Teacher '.$slug,
            'email' => "teacher@{$slug}.local",
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherStaff = Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher']);
        $teacherUser->roles()->attach($staffRole->id);

        $teacherToken = TenantToken::createTokenFor($teacherUser)['plainTextToken'];

        // Student user
        $studentUser = TenantUser::create([
            'name' => 'Student '.$slug,
            'email' => "student@{$slug}.local",
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $student = Student::create(['user_id' => $studentUser->id, 'student_code' => 'STU-'.$slug]);
        $studentUser->roles()->attach($studentRole->id);

        $studentToken = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        return [
            'tenant' => $tenant,
            'teacherUser' => $teacherUser,
            'teacherStaff' => $teacherStaff,
            'teacherToken' => $teacherToken,
            'studentUser' => $studentUser,
            'student' => $student,
            'studentToken' => $studentToken,
        ];
    }

    /**
     * Phase J §45 — Analytics Gate:
     * - correct tenant
     * - correct student
     * - correct metric version
     * - correct calculation
     * - historical stability
     * - no synchronous heavy calculation on dashboard
     */
    public function test_analytics_gate(): void
    {
        $tenantA = $this->setupTenant('anl-a', $this->tenantConnA);
        $tenantB = $this->setupTenant('anl-b', $this->tenantConnB);

        $headersTeacherA = [
            'X-Tenant-Slug' => 'anl-a',
            'Authorization' => 'Bearer '.$tenantA['teacherToken'],
        ];

        $headersStudentA = [
            'X-Tenant-Slug' => 'anl-a',
            'Authorization' => 'Bearer '.$tenantA['studentToken'],
        ];

        $headersTeacherB = [
            'X-Tenant-Slug' => 'anl-b',
            'Authorization' => 'Bearer '.$tenantB['teacherToken'],
        ];

        // -------------------------------------------------------------
        // 1. Seed Domain Data in Tenant A
        // -------------------------------------------------------------
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($tenantA['tenant']);
        $dbManager->configureConnection($tenantA['tenant']);

        $course = Course::create([
            'title' => 'Biology 101',
            'code' => 'BIO101',
            'status' => 'active',
        ]);

        $branch = Branch::create(['name' => 'Main Campus']);
        $room = Classroom::create(['branch_id' => $branch->id, 'name' => 'Lab 1', 'capacity' => 30]);
        $class = SchoolClass::create(['name' => 'Class A', 'course_id' => $course->id, 'classroom_id' => $room->id]);

        $session1 = ClassSession::create(['class_id' => $class->id, 'classroom_id' => $room->id, 'title' => 'Session 1', 'session_date' => now()->subDays(2), 'status' => 'completed']);
        $session2 = ClassSession::create(['class_id' => $class->id, 'classroom_id' => $room->id, 'title' => 'Session 2', 'session_date' => now()->subDays(1), 'status' => 'completed']);

        // Student attended 1 of 2 sessions -> 50% attendance
        AttendanceRecord::create(['session_id' => $session1->id, 'student_id' => $tenantA['student']->id, 'status' => 'present', 'mode' => 'qr']);
        AttendanceRecord::create(['session_id' => $session2->id, 'student_id' => $tenantA['student']->id, 'status' => 'absent', 'mode' => 'manual']);

        // Completion counts assignments in the student's enrolled courses
        Enrollment::create(['student_id' => $tenantA['student']->id, 'course_id' => $course->id, 'status' => 'active', 'enrolled_at' => now()]);

        // 1 assignment created and submitted -> 100% completion
        $assignment = Assignment::create(['course_id' => $course->id, 'title' => 'Cell Structure', 'points_possible' => 100, 'status' => 'published']);
        AssignmentSubmission::create(['assignment_id' => $assignment->id, 'student_id' => $tenantA['student']->id, 'score' => 90, 'status' => 'graded']);

        // 1 published grade -> 80%
        Grade::create([
            'student_id' => $tenantA['student']->id,
            'gradable_type' => Assignment::class,
            'gradable_id' => $assignment->id,
            'score' => 80.00,
            'max_score' => 100.00,
            'percentage' => 80.00,
            'is_published' => true,
        ]);

        // -------------------------------------------------------------
        // 2. Trigger Calculation & Verify Accurate Computation
        // -------------------------------------------------------------
        $refreshRes = $this->postJson("/api/v1/students/{$tenantA['student']->id}/dashboard/refresh", [], $headersTeacherA);
        $refreshRes->assertStatus(200);

        $snapshot = $refreshRes->json('data.snapshot');
        $this->assertEquals(50.00, $snapshot['attendance_rate']);
        $this->assertEquals(100.00, $snapshot['assignment_completion_rate']);
        $this->assertEquals(80.00, $snapshot['exam_average']);
        // Overall: (80 * 0.40) + (100 * 0.35) + (50 * 0.25) = 32 + 35 + 12.5 = 79.50
        $this->assertEquals(79.50, $snapshot['overall_score']);

        // -------------------------------------------------------------
        // 3. Verify Metric Versioning & Historical Stability
        // -------------------------------------------------------------
        $measurement = MetricMeasurement::where('student_id', $tenantA['student']->id)->first();
        $this->assertNotNull($measurement);
        $initialVersionId = $measurement->metric_version_id;

        // Add Metric Version 2 to the definition
        $metricDef = $measurement->metricDefinition;
        $v2Res = $this->postJson("/api/v1/metrics/{$metricDef->id}/versions", [
            'version' => 2,
            'formula_definition' => ['multiplier' => 1.1],
            'changelog' => 'Added bonus multiplier',
        ], $headersTeacherA);
        $v2Res->assertStatus(201);

        // Historical stability: Old measurement still points to Version 1
        $measurementAfterUpgrade = MetricMeasurement::find($measurement->id);
        $this->assertEquals($initialVersionId, $measurementAfterUpgrade->metric_version_id);
        $this->assertEquals(1, $measurementAfterUpgrade->metricVersion->version);

        // -------------------------------------------------------------
        // 4. Fast Read Model Serving (Dashboard Invariant)
        // -------------------------------------------------------------
        $dashRes = $this->getJson("/api/v1/students/{$tenantA['student']->id}/dashboard", $headersStudentA);
        $dashRes->assertStatus(200)
            ->assertJsonPath('data.dashboard.attendance_rate', '50.00')
            ->assertJsonPath('data.dashboard.exam_average', '80.00');

        // -------------------------------------------------------------
        // 5. Tenant Isolation (SEC-INV-001)
        // -------------------------------------------------------------
        // Teacher B in Tenant B attempts to read Tenant A's student dashboard
        $crossTenantDash = $this->getJson("/api/v1/students/{$tenantA['student']->id}/dashboard", $headersTeacherB);
        $crossTenantDash->assertStatus(404);
    }

    /**
     * Phase J §47 — Reporting Gate:
     * - report generation
     * - job tracking
     * - failure handling
     * - tenant isolation
     * - download authorization
     */
    public function test_reporting_gate(): void
    {
        $tenantA = $this->setupTenant('rep-a', $this->tenantConnA);
        $tenantB = $this->setupTenant('rep-b', $this->tenantConnB);

        $headersTeacherA = [
            'X-Tenant-Slug' => 'rep-a',
            'Authorization' => 'Bearer '.$tenantA['teacherToken'],
        ];

        $headersStudentA = [
            'X-Tenant-Slug' => 'rep-a',
            'Authorization' => 'Bearer '.$tenantA['studentToken'],
        ];

        $headersTeacherB = [
            'X-Tenant-Slug' => 'rep-b',
            'Authorization' => 'Bearer '.$tenantB['teacherToken'],
        ];

        // -------------------------------------------------------------
        // 1. Report Generation & Job Tracking
        // -------------------------------------------------------------
        $reqRes = $this->postJson('/api/v1/reports', [
            'title' => 'Semester Progress Report',
            'format' => 'json',
            'parameters' => [
                'student_id' => $tenantA['student']->id,
            ],
        ], $headersTeacherA);

        $reqRes->assertStatus(201);
        $reportData = $reqRes->json('data.report');

        $this->assertEquals('completed', $reportData['status']);
        $this->assertNotEmpty($reportData['data_payload']);
        $this->assertEquals($tenantA['student']->id, $reportData['data_payload']['student']['id']);

        $reportId = $reportData['id'];

        // -------------------------------------------------------------
        // 2. Failure Handling
        // -------------------------------------------------------------
        // A data source failure is recorded on the report instead of being lost.
        $failing = ReportInstance::create([
            'title' => 'Failing Report Test',
            'requested_by_user_id' => $tenantA['teacherUser']->id,
            'status' => 'queued',
            'format' => 'json',
            'parameters' => ['type' => 'student', 'student_id' => (string) Str::uuid()],
        ]);
        $failed = app(ReportGenerationService::class)->generate($failing);

        $this->assertEquals('failed', $failed->status);
        $this->assertNotEmpty($failed->error_message);

        // -------------------------------------------------------------
        // 3. Download Authorization
        // -------------------------------------------------------------
        // Teacher A has 'reports.download' -> Allowed
        $downloadRes = $this->getJson("/api/v1/reports/{$reportId}/download", $headersTeacherA);
        $downloadRes->assertStatus(200)
            ->assertJsonPath('data.report_id', $reportId)
            ->assertJsonPath('data.title', 'Semester Progress Report');

        // Student A does not have 'reports.download' and did not request this report -> Denied (403)
        $unauthDownload = $this->getJson("/api/v1/reports/{$reportId}/download", $headersStudentA);
        $unauthDownload->assertStatus(403);

        // -------------------------------------------------------------
        // 4. Tenant Isolation
        // -------------------------------------------------------------
        // Tenant B cannot access or download Tenant A's report
        $crossTenantReport = $this->getJson("/api/v1/reports/{$reportId}", $headersTeacherB);
        $crossTenantReport->assertStatus(404);

        $crossTenantDownload = $this->getJson("/api/v1/reports/{$reportId}/download", $headersTeacherB);
        $crossTenantDownload->assertStatus(404);
    }
}
