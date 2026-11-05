<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\AccessCredential;
use App\Models\Branch;
use App\Models\Classroom;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
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

class OfflineServiceTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected TenantUser $teacherUser;

    protected TenantUser $assistantUser;

    protected TenantUser $studentOfflineUser;

    protected TenantUser $studentBothUser;

    protected Student $studentOffline;

    protected Student $studentBoth;

    protected SchoolClass $classA;

    protected SchoolClass $classB;

    protected ClassSession $sessionA;

    protected ClassSession $sessionB;

    protected Course $course;

    protected Lesson $lesson;

    protected string $teacherToken;

    protected string $assistantToken;

    protected string $studentOfflineToken;

    protected string $studentBothToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cleanupTenantDbs();

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $this->tenant = Tenant::create([
            'name' => 'مركز الفلاح التعليمي',
            'slug' => 'p8-falah-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'center',
            'status' => 'active',
            'brand_settings' => [
                'services' => ['online', 'offline'],
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

        // Seed roles & permissions
        app(RoleSynchronizer::class)->sync();

        // 1. Teacher Setup
        $this->teacherUser = TenantUser::create([
            'email' => 'teacher@falah.edu',
            'password' => 'Password123!',
            'name' => 'أحمد الشناوي',
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherStaff = Staff::create([
            'user_id' => $this->teacherUser->id,
            'staff_type' => 'teacher',
            'status' => 'active',
        ]);
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $this->teacherUser->roles()->attach($teacherRole->id);
        $this->teacherToken = TenantToken::createTokenFor($this->teacherUser)['plainTextToken'];

        // 2. Assistant Setup
        $this->assistantUser = TenantUser::create([
            'email' => 'assistant@falah.edu',
            'password' => 'Password123!',
            'name' => 'محمد سمير (مساعد)',
            'type' => 'staff',
            'status' => 'active',
        ]);
        $assistantStaff = Staff::create([
            'user_id' => $this->assistantUser->id,
            'staff_type' => 'assistant',
            'status' => 'active',
        ]);
        $assistantRole = Role::where('name', 'assistant')->firstOrFail();
        $this->assistantUser->roles()->attach($assistantRole->id);
        $this->assistantToken = TenantToken::createTokenFor($this->assistantUser)['plainTextToken'];

        // 3. Offline Student Setup
        $this->studentOfflineUser = TenantUser::create([
            'email' => 'student.offline@test.com',
            'password' => 'Password123!',
            'name' => 'زياد طارق (أوفلاين)',
            'type' => 'student',
            'status' => 'active',
        ]);
        $this->studentOffline = Student::create([
            'user_id' => $this->studentOfflineUser->id,
            'student_code' => 'STU-OFFLINE-01',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);
        $studentRole = Role::where('name', 'student')->firstOrFail();
        $this->studentOfflineUser->roles()->attach($studentRole->id);
        $this->studentOfflineToken = TenantToken::createTokenFor($this->studentOfflineUser)['plainTextToken'];

        // 4. Both-Mode Student Setup
        $this->studentBothUser = TenantUser::create([
            'email' => 'student.both@test.com',
            'password' => 'Password123!',
            'name' => 'يوسف أيمن (كلا النمطين)',
            'type' => 'student',
            'status' => 'active',
        ]);
        $this->studentBoth = Student::create([
            'user_id' => $this->studentBothUser->id,
            'student_code' => 'STU-BOTH-02',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);
        $this->studentBothUser->roles()->attach($studentRole->id);
        $this->studentBothToken = TenantToken::createTokenFor($this->studentBothUser)['plainTextToken'];

        // 5. Branch, Classroom, Classes
        $branch = Branch::create(['name' => 'فرع المهندسين', 'status' => 'active']);
        $room = Classroom::create(['branch_id' => $branch->id, 'name' => 'قاعة أ', 'capacity' => 40]);

        $this->classA = SchoolClass::create([
            'teacher_staff_id' => $teacherStaff->id,
            'branch_id' => $branch->id,
            'name' => 'مجموعة الفيزياء - أ',
            'status' => 'active',
        ]);

        $this->classB = SchoolClass::create([
            'teacher_staff_id' => $teacherStaff->id,
            'branch_id' => $branch->id,
            'name' => 'مجموعة الكيمياء - ب',
            'status' => 'active',
        ]);

        // Attach students to Class A
        $this->classA->students()->attach([
            $this->studentOffline->id => ['id' => (string) Str::uuid(), 'status' => 'active', 'mode' => 'offline'],
            $this->studentBoth->id => ['id' => (string) Str::uuid(), 'status' => 'active', 'mode' => 'both'],
        ]);

        // Assign Assistant to Class A ONLY
        StaffAssignment::create([
            'staff_id' => $assistantStaff->id,
            'assignable_type' => 'class',
            'assignable_id' => $this->classA->id,
        ]);

        // 6. Create Sessions
        $this->sessionA = ClassSession::create([
            'class_id' => $this->classA->id,
            'classroom_id' => $room->id,
            'title' => 'حصة الفيزياء 1',
            'starts_at' => now()->subMinutes(10),
            'ends_at' => now()->addMinutes(80),
            'attendance_mode' => 'both',
            'status' => 'in_progress',
        ]);

        $this->sessionB = ClassSession::create([
            'class_id' => $this->classB->id,
            'classroom_id' => $room->id,
            'title' => 'حصة الكيمياء 1',
            'starts_at' => now()->subMinutes(10),
            'ends_at' => now()->addMinutes(80),
            'attendance_mode' => 'both',
            'status' => 'in_progress',
        ]);

        // 7. Course & Lesson Setup
        $this->course = Course::create([
            'teacher_staff_id' => $teacherStaff->id,
            'title' => 'الفيزياء الحديثة للثانوية',
            'code' => 'PHY-101',
            'status' => 'published',
            'is_free' => true,
        ]);

        $this->lesson = Lesson::create([
            'course_id' => $this->course->id,
            'title' => 'الدرس الأول: حركة الجسيمات',
            'status' => 'published',
            'is_free_preview' => false,
            'sort_order' => 1,
        ]);

        // Enroll students in course with specific modes
        Enrollment::create([
            'student_id' => $this->studentOffline->id,
            'course_id' => $this->course->id,
            'status' => 'active',
            'mode' => 'offline',
        ]);

        Enrollment::create([
            'student_id' => $this->studentBoth->id,
            'course_id' => $this->course->id,
            'status' => 'active',
            'mode' => 'both',
        ]);
    }

    protected function tearDown(): void
    {
        $this->cleanupTenantDbs();
        parent::tearDown();
    }

    protected function cleanupTenantDbs(): void
    {
        $dbPath = config('database.connections.tenant.database');
        if ($dbPath && file_exists($dbPath) && $dbPath !== ':memory:') {
            @unlink($dbPath);
        }
    }

    protected function authHeaders(string $token): array
    {
        return [
            'X-Tenant' => $this->tenant->slug,
            'Authorization' => "Bearer {$token}",
            'Accept' => 'application/json',
        ];
    }

    /**
     * Requirement: طالب أوفلاين بيطلب /courses/{id}/lessons يرجع 403.
     */
    public function test_offline_student_requesting_course_lessons_returns_403(): void
    {
        $response = $this->withHeaders($this->authHeaders($this->studentOfflineToken))
            ->getJson("/api/v1/courses/{$this->course->id}/lessons");

        $response->assertStatus(403);
        $response->assertJson([
            'error' => [
                'code' => 'OFFLINE_STUDENT_RESTRICTED',
            ],
        ]);
    }

    /**
     * Requirement: طالب both يشوف الاتنين (محتوى الدروس يرجع بنجاح).
     */
    public function test_both_mode_student_requesting_course_lessons_succeeds(): void
    {
        $response = $this->withHeaders($this->authHeaders($this->studentBothToken))
            ->getJson("/api/v1/courses/{$this->course->id}/lessons");

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'lessons' => [
                    '*' => ['id', 'title'],
                ],
            ],
        ]);
    }

    /**
     * Requirement: المساعد يسجّل الواجب لطلاب فصله بس (scope assigned).
     */
    public function test_assistant_can_record_homework_check_for_assigned_class(): void
    {
        $response = $this->withHeaders($this->authHeaders($this->assistantToken))
            ->postJson("/api/v1/sessions/{$this->sessionA->id}/homework-checks", [
                'student_id' => $this->studentOffline->id,
                'status' => 'done',
                'note' => 'حل الواجب كاملاً وخط ممتاز',
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'check' => [
                    'session_id' => $this->sessionA->id,
                    'student_id' => $this->studentOffline->id,
                    'status' => 'done',
                    'note' => 'حل الواجب كاملاً وخط ممتاز',
                ],
            ],
        ]);

        $this->assertDatabaseHas('offline_homework_checks', [
            'session_id' => $this->sessionA->id,
            'student_id' => $this->studentOffline->id,
            'status' => 'done',
        ], 'tenant');
    }

    /**
     * Requirement: المساعد لا يستطيع تسجيل الواجب لفصل غير مسند إليه (403 Forbidden).
     */
    public function test_assistant_cannot_record_homework_check_for_unassigned_class(): void
    {
        $response = $this->withHeaders($this->authHeaders($this->assistantToken))
            ->postJson("/api/v1/sessions/{$this->sessionB->id}/homework-checks", [
                'student_id' => $this->studentOffline->id,
                'status' => 'done',
            ]);

        $response->assertStatus(403);
    }

    /**
     * Test bulk homework checks recording for assistant.
     */
    public function test_assistant_can_bulk_record_homework_checks(): void
    {
        $response = $this->withHeaders($this->authHeaders($this->assistantToken))
            ->postJson("/api/v1/sessions/{$this->sessionA->id}/homework-checks/bulk", [
                'checks' => [
                    [
                        'student_id' => $this->studentOffline->id,
                        'status' => 'done',
                        'note' => 'مكتمل',
                    ],
                    [
                        'student_id' => $this->studentBoth->id,
                        'status' => 'partial',
                        'note' => 'حل نصف المسائل',
                    ],
                ],
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'data' => [
                'count' => 2,
            ],
        ]);

        $this->assertDatabaseHas('offline_homework_checks', [
            'session_id' => $this->sessionA->id,
            'student_id' => $this->studentBoth->id,
            'status' => 'partial',
        ], 'tenant');
    }

    /**
     * Test managing offline assessments and recording scores by assistant.
     */
    public function test_offline_assessments_creation_and_score_recording(): void
    {
        // 1. Teacher creates offline assessment for Class A
        $createRes = $this->withHeaders($this->authHeaders($this->teacherToken))
            ->postJson("/api/v1/classes/{$this->classA->id}/offline-assessments", [
                'title' => 'كويز ورقي - الفصل الأول',
                'max_score' => 20,
                'date' => now()->toDateString(),
                'session_id' => $this->sessionA->id,
                'description' => 'كويز فيزياء ورقي في السنتر',
            ]);

        $createRes->assertStatus(201);
        $assessmentId = $createRes->json('data.assessment.id');

        // 2. Assistant records scores for students in Class A
        $scoreRes = $this->withHeaders($this->authHeaders($this->assistantToken))
            ->postJson("/api/v1/offline-assessments/{$assessmentId}/scores", [
                'scores' => [
                    [
                        'student_id' => $this->studentOffline->id,
                        'score' => 19.5,
                        'notes' => 'إجابات ممتازة',
                    ],
                    [
                        'student_id' => $this->studentBoth->id,
                        'score' => 16.0,
                        'notes' => 'جيد جداً',
                    ],
                ],
            ]);

        $scoreRes->assertStatus(200);
        $scoreRes->assertJson([
            'data' => [
                'count' => 2,
            ],
        ]);

        // Verify score saved in tenant db
        $this->assertDatabaseHas('offline_assessment_scores', [
            'offline_assessment_id' => $assessmentId,
            'student_id' => $this->studentOffline->id,
            'score' => 19.5,
        ], 'tenant');

        // Verify synced into grades table so student and parent see it
        $this->assertDatabaseHas('grades', [
            'student_id' => $this->studentOffline->id,
            'gradable_type' => 'OfflineAssessment',
            'gradable_id' => $assessmentId,
            'score' => 19.5,
            'max_score' => 20,
        ], 'tenant');
    }

    /**
     * Test scanning printed card with AccessCredential.
     */
    public function test_printed_card_access_credential_can_be_scanned_for_attendance(): void
    {
        $credCode = 'CRD-PRINTED-'.strtoupper(Str::random(8));
        AccessCredential::create([
            'student_id' => $this->studentOffline->id,
            'credential_code' => $credCode,
            'secret_hash' => hash('sha256', 'secret'),
            'status' => 'active',
            'created_by_user_id' => $this->teacherUser->id,
            'issued_at' => now(),
        ]);

        $scanRes = $this->withHeaders($this->authHeaders($this->assistantToken))
            ->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
                'token' => $credCode,
            ]);

        $scanRes->assertStatus(200);
        $scanRes->assertJson([
            'data' => [
                'record' => [
                    'student_id' => $this->studentOffline->id,
                    'status' => 'present',
                ],
            ],
        ]);

        $this->assertDatabaseHas('attendance_records', [
            'session_id' => $this->sessionA->id,
            'student_id' => $this->studentOffline->id,
            'status' => 'present',
        ], 'tenant');
    }

    /**
     * Test revoked printed card credential is rejected with 422 CREDENTIAL_REVOKED.
     */
    public function test_revoked_printed_card_credential_is_rejected(): void
    {
        $credCode = 'CRD-REVOKED-'.strtoupper(Str::random(8));
        AccessCredential::create([
            'student_id' => $this->studentOffline->id,
            'credential_code' => $credCode,
            'secret_hash' => hash('sha256', 'secret'),
            'status' => 'revoked',
            'created_by_user_id' => $this->teacherUser->id,
            'issued_at' => now(),
            'revoked_at' => now(),
            'revocation_reason' => 'البطاقة مفقودة وتم إلغاؤها',
        ]);

        $scanRes = $this->withHeaders($this->authHeaders($this->assistantToken))
            ->postJson("/api/v1/sessions/{$this->sessionA->id}/attendance/scan", [
                'token' => $credCode,
            ]);

        $scanRes->assertStatus(422);
        $scanRes->assertJson([
            'error' => [
                'code' => 'CREDENTIAL_REVOKED',
            ],
        ]);
    }
}
