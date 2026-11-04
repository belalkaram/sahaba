<?php

namespace Tests\Feature;

use App\Domain\Analytics\Services\AnalyticsCalculationService;
use App\Domain\Reporting\Services\ReportGenerationService;
use App\Models\AccessCredential;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Classroom;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\DeviceBinding;
use App\Models\Enrollment;
use App\Models\Entitlement;
use App\Models\GlobalIdentity;
use App\Models\Grade;
use App\Models\Lesson;
use App\Models\Package;
use App\Models\PaymentRequest;
use App\Models\PaymentReviewLog;
use App\Models\Permission;
use App\Models\ReportDefinition;
use App\Models\ReportInstance;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\Student;
use App\Models\StudentAnalyticsSnapshot;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EndToEndLifecycleGateTest extends TestCase
{
    use RefreshDatabase;

    protected TenantDatabaseManager $dbManager;

    protected TenantContext $tenantContext;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dbManager = app(TenantDatabaseManager::class);
        $this->tenantContext = app(TenantContext::class);
    }

    protected function tearDown(): void
    {
        $this->dbManager->purgeConnection();

        $tenantDir = database_path('tenants');
        if (File::isDirectory($tenantDir)) {
            $files = File::glob($tenantDir.'/tenant_e2e_*.sqlite');
            foreach ($files as $file) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }

    protected function createTenantWithDb(string $slug, string $name): Tenant
    {
        $tenant = Tenant::create([
            'name' => $name,
            'slug' => $slug,
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => 'tenant_'.$slug,
            'is_migrated' => true,
        ]);

        $this->dbManager->migrateTenant($tenant);

        return $tenant;
    }

    public function test_full_system_lifecycle_end_to_end(): void
    {
        $runId = uniqid();
        $slugA = 'e2e_alpha_'.$runId;
        $slugB = 'e2e_beta_'.$runId;

        // =========================================================================
        // Step 1: Multi-Tenant Provisioning & Isolation (M2)
        // =========================================================================
        $tenantA = $this->createTenantWithDb($slugA, 'Alpha Academy');
        $tenantB = $this->createTenantWithDb($slugB, 'Beta Institute');

        $this->assertDatabaseHas('tenants', ['slug' => $slugA]);
        $this->assertDatabaseHas('tenants', ['slug' => $slugB]);

        // =========================================================================
        // Step 2: Global Identity & Tenant Users (M3)
        // =========================================================================
        $globalOmar = GlobalIdentity::create([
            'name' => 'Omar Farooq',
            'email' => 'omar.farooq@example.com',
            'phone' => '+966555123456',
            'type' => 'student',
            'status' => 'active',
        ]);

        $this->dbManager->configureConnection($tenantA);
        $this->tenantContext->setTenant($tenantA);

        // Teacher Sarah
        $teacherRole = Role::create(['name' => 'teacher', 'label' => 'Teacher', 'is_system' => true]);
        $permCourseCreate = Permission::create(['name' => 'courses.create', 'module' => 'education']);
        $teacherRole->permissions()->attach($permCourseCreate->id);

        $teacherUser = TenantUser::create([
            'name' => 'Teacher Sarah',
            'email' => 'sarah@alpha.sa',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherUser->roles()->attach($teacherRole->id);
        $teacherStaff = Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);

        // Student Omar
        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);
        $studentUser = TenantUser::create([
            'name' => 'Omar Farooq',
            'email' => 'omar.farooq@example.com',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $studentOmar = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-ALPHA-001',
            'status' => 'active',
        ]);

        $studentToken = TenantToken::createTokenFor($studentUser)['plainTextToken'];
        $teacherToken = TenantToken::createTokenFor($teacherUser)['plainTextToken'];

        $this->assertNotEquals($studentUser->id, $studentOmar->id); // User != Student

        // =========================================================================
        // Step 3: Billing, Subscriptions & Entitlements (M7)
        // =========================================================================
        $package = Package::create([
            'name' => 'Annual Premium Package',
            'code' => 'ANNUAL-2026',
            'price' => 1200.00,
            'currency' => 'SAR',
            'status' => 'active',
        ]);

        $payment = PaymentRequest::create([
            'student_id' => $studentOmar->id,
            'package_id' => $package->id,
            'amount' => 1200.00,
            'currency' => 'SAR',
            'payment_method' => 'bank_transfer',
            'status' => 'pending',
        ]);

        $this->assertSame('pending', $payment->status);
        $this->assertFalse($studentOmar->hasEntitlement('feature:courses'));

        // Review & Approve Payment
        $payment->update(['status' => 'approved', 'reviewed_at' => now(), 'reviewed_by_user_id' => $teacherUser->id]);
        PaymentReviewLog::create([
            'payment_request_id' => $payment->id,
            'reviewed_by_user_id' => $teacherUser->id,
            'action' => 'approved',
            'reason' => 'Verified bank wire receipt',
            'logged_at' => now(),
        ]);

        // Provision Subscription and Entitlement
        $subscription = Subscription::create([
            'student_id' => $studentOmar->id,
            'package_id' => $package->id,
            'payment_request_id' => $payment->id,
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
            'status' => 'active',
        ]);

        $entitlement = Entitlement::create([
            'student_id' => $studentOmar->id,
            'subscription_id' => $subscription->id,
            'entitlement_key' => 'feature:courses',
            'is_active' => true,
            'expires_at' => now()->addYear(),
        ]);

        $this->assertTrue($studentOmar->fresh()->hasEntitlement('feature:courses'));

        // =========================================================================
        // Step 4: Access Credential & Device Binding (M8)
        // =========================================================================
        $rawPin = '123456';
        $hashedPin = hash('sha256', $rawPin);

        $credential = AccessCredential::create([
            'student_id' => $studentOmar->id,
            'credential_code' => 'CRD-OMAR-01',
            'secret_hash' => $hashedPin,
            'status' => 'active',
            'created_by_user_id' => $teacherUser->id,
            'issued_at' => now(),
        ]);

        $binding = DeviceBinding::create([
            'credential_id' => $credential->id,
            'device_id' => 'tablet-omar-ipad',
            'device_name' => 'Omar iPad Air',
            'device_fingerprint' => hash('sha256', 'ipad-hardware-guid-001'),
            'is_active' => true,
        ]);

        $this->assertTrue($credential->verifySecret('123456'));
        $this->assertFalse($credential->verifySecret('wrong-pin'));
        $this->assertTrue($binding->matchesDevice('tablet-omar-ipad', hash('sha256', 'ipad-hardware-guid-001')));

        // =========================================================================
        // Step 5: Education Core — Course, Lesson & Enrollment (M4)
        // =========================================================================
        $course = Course::create([
            'title' => 'Physics 101: Mechanics & Dynamics',
            'code' => 'PHYS-101',
            'description' => 'Classical mechanics and motion laws',
            'status' => 'published',
        ]);

        $lesson = Lesson::create([
            'course_id' => $course->id,
            'title' => 'Newton First Law of Motion',
            'order' => 1,
            'status' => 'published',
        ]);

        $enrollment = Enrollment::create([
            'student_id' => $studentOmar->id,
            'course_id' => $course->id,
            'status' => 'active',
            'enrolled_at' => now(),
        ]);

        $this->assertSame('active', $enrollment->status);
        $this->assertSame(1, $course->enrollments()->count());

        // =========================================================================
        // Step 6: Classroom & Attendance Recording (M5)
        // =========================================================================
        $branch = Branch::create(['name' => 'Main Campus', 'code' => 'MAIN', 'status' => 'active']);
        $classroom = Classroom::create([
            'branch_id' => $branch->id,
            'name' => 'Lecture Hall 101',
            'capacity' => 40,
            'status' => 'active',
        ]);
        $schoolClass = SchoolClass::create([
            'name' => 'Physics Cohort A',
            'code' => 'PHYS-A',
            'branch_id' => $branch->id,
            'classroom_id' => $classroom->id,
            'teacher_staff_id' => $teacherStaff->id,
            'status' => 'active',
        ]);
        $session = ClassSession::create([
            'class_id' => $schoolClass->id,
            'classroom_id' => $classroom->id,
            'title' => 'Session 1: Vectors & Kinematics',
            'starts_at' => now()->subHour(),
            'ends_at' => now(),
            'status' => 'completed',
        ]);

        $attendance = AttendanceRecord::create([
            'session_id' => $session->id,
            'student_id' => $studentOmar->id,
            'recorded_by_user_id' => $teacherUser->id,
            'status' => 'present',
            'attendance_mode' => 'qr_scan',
            'recorded_at' => now(),
        ]);

        $this->assertSame('present', $attendance->status);
        $this->assertNotEquals($session->id, $attendance->id); // Attendance != Session

        // =========================================================================
        // Step 7: Assessment & Grading Domain (M6)
        // =========================================================================
        $assignment = Assignment::create([
            'course_id' => $course->id,
            'title' => 'Problem Set 1: Newton Laws',
            'max_score' => 100,
            'due_at' => now()->addDays(5),
            'status' => 'published',
        ]);

        $submission = AssignmentSubmission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $studentOmar->id,
            'submitted_at' => now(),
            'status' => 'submitted',
            'content' => 'Answers to problems 1 through 10',
        ]);

        $grade = Grade::create([
            'student_id' => $studentOmar->id,
            'gradable_type' => Assignment::class,
            'gradable_id' => $assignment->id,
            'score' => 95.00,
            'max_score' => 100.00,
            'percentage' => 95.00,
            'is_published' => true,
            'graded_at' => now(),
        ]);

        $this->assertEquals(95.00, $grade->score);

        // =========================================================================
        // Step 8: Integrations & Virtual Classrooms (M9)
        // =========================================================================
        $permMeetingCreate = Permission::create(['name' => 'meetings.create', 'module' => 'meetings']);
        $teacherRole->permissions()->attach($permMeetingCreate->id);

        $createMeetingRes = $this->postJson('/api/v1/meetings', [
            'title' => 'Live Review: Vectors & Mechanics',
            'provider' => 'mock',
            'duration_minutes' => 60,
            'idempotency_key' => 'e2e-meet-'.$runId,
        ], [
            'X-Tenant-Slug' => $slugA,
            'Authorization' => 'Bearer '.$teacherToken,
        ]);

        $createMeetingRes->assertStatus(201);
        $this->assertNotEmpty($createMeetingRes->json('data.meeting.external_meeting_id'));
        $this->assertNotEmpty($createMeetingRes->json('data.meeting.join_url'));
        $this->assertEquals('mock', $createMeetingRes->json('data.meeting.provider'));

        // =========================================================================
        // Step 9: Analytics Calculation & Fast Read Model Snapshot (M10)
        // =========================================================================
        $analyticsService = app(AnalyticsCalculationService::class);
        $snapshot = $analyticsService->computeStudentSnapshot($studentOmar);

        $this->assertInstanceOf(StudentAnalyticsSnapshot::class, $snapshot);
        $this->assertEquals(100.0, $snapshot->attendance_rate);
        $this->assertEquals(100.0, $snapshot->assignment_completion_rate);
        $this->assertEquals(95.0, $snapshot->exam_average);

        // Fast dashboard endpoint serving
        $dashboardResponse = $this->withHeaders([
            'X-Tenant' => $tenantA->slug,
            'Authorization' => 'Bearer '.$studentToken,
        ])->getJson('/api/v1/students/'.$studentOmar->id.'/dashboard');

        $dashboardResponse->assertStatus(200);
        $dashboardResponse->assertJsonPath('data.student_id', $studentOmar->id);
        $this->assertEquals(100.00, (float) $dashboardResponse->json('data.dashboard.attendance_rate'));

        // =========================================================================
        // Step 10: Asynchronous Reporting Engine (M10)
        // =========================================================================
        $reportDef = ReportDefinition::create([
            'key' => 'student_transcript',
            'name' => 'Academic Transcript Report',
            'type' => 'student_transcript',
            'supported_formats' => ['json', 'csv'],
        ]);

        $reportInstance = ReportInstance::create([
            'title' => 'Omar Academic Transcript',
            'report_definition_id' => $reportDef->id,
            'requested_by_user_id' => $studentUser->id,
            'status' => 'queued',
            'format' => 'json',
            'parameters' => ['type' => 'student', 'student_id' => $studentOmar->id],
        ]);

        $reportingService = app(ReportGenerationService::class);
        $reportingService->generate($reportInstance);

        $this->assertSame('completed', $reportInstance->fresh()->status);
        $this->assertNotNull($reportInstance->fresh()->completed_at);

        // Download report with student token
        $downloadResponse = $this->withHeaders([
            'X-Tenant' => $tenantA->slug,
            'Authorization' => 'Bearer '.$studentToken,
        ])->getJson('/api/v1/reports/'.$reportInstance->id.'/download');

        $downloadResponse->assertStatus(200);

        // =========================================================================
        // Step 11: Cross-Tenant Isolation Enforcement (SEC-INV-001)
        // =========================================================================
        // Attempt to access School Alpha's course using School Beta's tenant header
        $crossTenantResponse = $this->withHeaders([
            'X-Tenant' => $tenantB->slug,
            'Authorization' => 'Bearer '.$studentToken,
        ])->getJson('/api/v1/courses/'.$course->id);

        $this->assertContains($crossTenantResponse->getStatusCode(), [401, 403, 404]);
    }
}
