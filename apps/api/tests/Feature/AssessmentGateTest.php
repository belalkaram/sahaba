<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Course;
use App\Models\Exam;
use App\Models\Permission;
use App\Models\Role;
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

class AssessmentGateTest extends TestCase
{
    use RefreshDatabase;

    protected string $tenantConnA;

    protected string $tenantConnB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConnA = 'test_ass_a_'.uniqid();
        $this->tenantConnB = 'test_ass_b_'.uniqid();
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'test_ass_*.sqlite') as $file) {
                if (file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    /**
     * Phase J §30 — Assessment Gate:
     * - assignment submission
     * - deadline
     * - late submission
     * - exam start
     * - exam answer
     * - exam submit
     * - duplicate submission
     * - grading
     * - grade publication
     * - authorization
     * - tenant isolation
     */
    public function test_assessment_gate_complete_lifecycle(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        // -------------------------------------------------------------
        // 1. Provision Tenant A (Al-Ibdaa Center)
        // -------------------------------------------------------------
        $tenantA = Tenant::create([
            'name' => 'Al-Ibdaa Center',
            'slug' => 'alibdaa',
            'type' => 'educational_center',
            'status' => 'active',
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
        $permCourseCreate = Permission::create(['name' => 'courses.create', 'module' => 'education']);
        $permCourseView = Permission::create(['name' => 'courses.view', 'module' => 'education']);
        $permAssignCreate = Permission::create(['name' => 'assignments.create', 'module' => 'assessment']);
        $permAssignGrade = Permission::create(['name' => 'assignments.grade', 'module' => 'assessment']);
        $permExamCreate = Permission::create(['name' => 'exams.create', 'module' => 'assessment']);
        $permExamGrade = Permission::create(['name' => 'exams.grade', 'module' => 'assessment']);
        $permGradeView = Permission::create(['name' => 'grades.view', 'module' => 'assessment']);

        // Roles in Tenant A
        $teacherRole = Role::create(['name' => 'teacher', 'label' => 'Teacher', 'is_system' => true]);
        $teacherRole->permissions()->attach([
            $permCourseCreate->id,
            $permCourseView->id,
            $permAssignCreate->id,
            $permAssignGrade->id,
            $permExamCreate->id,
            $permExamGrade->id,
            $permGradeView->id,
        ]);

        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        // Users in Tenant A
        $teacherUser = TenantUser::create([
            'name' => 'Dr. Nader',
            'email' => 'nader@alibdaa.edu',
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

        $studentUser = TenantUser::create([
            'name' => 'Student Hany',
            'email' => 'hany@alibdaa.edu',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $studentProfile = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-IBD-001',
            'grade_level' => 'Grade 12',
            'status' => 'active',
        ]);
        $studentToken = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        // Course in Tenant A
        $course = Course::create([
            'teacher_staff_id' => $teacherStaff->id,
            'title' => 'Biology 101',
            'code' => 'BIO-101',
            'status' => 'published',
        ]);

        // -------------------------------------------------------------
        // 2. Provision Tenant B (Al-Manar Institute)
        // -------------------------------------------------------------
        $tenantB = Tenant::create([
            'name' => 'Al-Manar Institute',
            'slug' => 'almanar',
            'type' => 'educational_center',
            'status' => 'active',
        ]);
        TenantDatabase::create([
            'tenant_id' => $tenantB->id,
            'connection_identifier' => $this->tenantConnB,
            'status' => 'ready',
        ]);
        $dbManager->migrateTenant($tenantB);

        $context->setTenant($tenantB);
        $dbManager->configureConnection($tenantB);

        $courseB = Course::create([
            'title' => 'Tenant B Geology',
            'status' => 'published',
        ]);
        $assignB = Assignment::create([
            'course_id' => $courseB->id,
            'title' => 'Tenant B Assignment',
            'status' => 'published',
        ]);

        // -------------------------------------------------------------
        // 3. EXECUTE GATE CHECKS (Phase J §30)
        // -------------------------------------------------------------

        // 1. Assignment Creation with Deadlines
        // Assignment 1: On-time assignment (deadline in future)
        $assign1Resp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments", [
            'title' => 'Cell Structure Lab',
            'description' => 'Write a report on eukaryotic organelle functions.',
            'points_possible' => 100,
            'due_at' => now()->addDays(2)->toIso8601String(),
        ]);
        $assign1Resp->assertStatus(201);
        $assign1Id = $assign1Resp->json('data.assignment.id');

        // Assignment 2: Past due assignment (deadline in past)
        $assign2Resp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments", [
            'title' => 'Microscopy Homework',
            'description' => 'Late submission test assignment.',
            'points_possible' => 50,
            'due_at' => now()->subDay()->toIso8601String(),
        ]);
        $assign2Resp->assertStatus(201);
        $assign2Id = $assign2Resp->json('data.assignment.id');

        // 2. Student Submits Assignment within Deadline
        $submit1Resp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments/{$assign1Id}/submit", [
            'content' => 'My eukaryotic cells analysis and observations...',
        ]);
        $submit1Resp->assertStatus(201)
            ->assertJsonPath('data.submission.is_late', false)
            ->assertJsonPath('data.submission.status', 'submitted');

        $submission1Id = $submit1Resp->json('data.submission.id');

        // 3. Late Submission Check
        $submitLateResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments/{$assign2Id}/submit", [
            'content' => 'Submitting late microscopy homework...',
        ]);
        $submitLateResp->assertStatus(201)
            ->assertJsonPath('data.submission.is_late', true);

        // 4. Duplicate Submission Check (Submitting again to Assign 1)
        $dupSubmitResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments/{$assign1Id}/submit", [
            'content' => 'Trying to submit again...',
        ]);
        $dupSubmitResp->assertStatus(422)
            ->assertJsonPath('error.code', 'DUPLICATE_SUBMISSION');

        // 5. Grading Assignment
        $gradeAssignResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments/{$assign1Id}/submissions/{$submission1Id}/grade", [
            'score' => 95,
            'feedback' => 'Outstanding analysis and diagrams.',
            'is_grade_published' => false,
        ]);
        $gradeAssignResp->assertStatus(200)
            ->assertJsonPath('data.submission.status', 'graded')
            ->assertJsonPath('data.submission.score', '95.00');

        // Student queries grades before publication -> should NOT see it yet
        $prePubGradesResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->getJson("/api/v1/students/{$studentProfile->id}/grades");
        $prePubGradesResp->assertStatus(200)
            ->assertJsonCount(0, 'data.grades');

        // 6. Grade Publication for Assignment
        $publishAssignGradesResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments/{$assign1Id}/publish-grades");
        $publishAssignGradesResp->assertStatus(200);

        // Student queries grades after publication -> sees score 95
        $postPubGradesResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->getJson("/api/v1/students/{$studentProfile->id}/grades");
        $postPubGradesResp->assertStatus(200)
            ->assertJsonCount(1, 'data.grades')
            ->assertJsonPath('data.grades.0.score', '95.00')
            ->assertJsonPath('data.grades.0.percentage', '95.00');

        // 7. Exam Lifecycle
        // Teacher creates exam
        $examResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams", [
            'title' => 'Genetics Midterm',
            'duration_minutes' => 45,
            'total_points' => 20,
        ]);
        $examResp->assertStatus(201);
        $examId = $examResp->json('data.exam.id');

        // Add questions to exam
        $q1Resp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/questions", [
            'question_text' => 'What is the carrier of genetic instructions in cells?',
            'question_type' => 'multiple_choice',
            'points' => 10,
            'options' => ['DNA', 'Lipid', 'Carbohydrate'],
            'correct_answer' => 'DNA',
        ]);
        $q1Resp->assertStatus(201);
        $q1Id = $q1Resp->json('data.question.id');

        // Teacher Publishes Exam
        $publishExamResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/publish");
        $publishExamResp->assertStatus(200);

        // 8. Exam Start
        $startExamResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/start");
        $startExamResp->assertStatus(201)
            ->assertJsonPath('data.attempt.status', 'in_progress');
        $attemptId = $startExamResp->json('data.attempt.id');

        // Duplicate Exam Attempt Check
        $dupExamStartResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/start");
        $dupExamStartResp->assertStatus(422)
            ->assertJsonPath('error.code', 'DUPLICATE_ATTEMPT');

        // 9. Exam Answer Submission
        $answerResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/attempts/{$attemptId}/answers", [
            'question_id' => $q1Id,
            'answer_text' => 'DNA',
        ]);
        $answerResp->assertStatus(200)
            ->assertJsonPath('data.answer.is_correct', true)
            ->assertJsonPath('data.answer.awarded_points', '10.00');

        // 10. Exam Submit
        $submitExamResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/attempts/{$attemptId}/submit");
        $submitExamResp->assertStatus(200)
            ->assertJsonPath('data.attempt.status', 'submitted');

        // 11. Teacher Grades and Publishes Exam
        $gradeExamResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/attempts/{$attemptId}/grade", [
            'score' => 20,
        ]);
        $gradeExamResp->assertStatus(200);

        $publishExamGradesResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$course->id}/exams/{$examId}/publish-grades");
        $publishExamGradesResp->assertStatus(200);

        // Student queries grades -> sees both Assignment and Exam grades
        $allStudentGradesResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->getJson("/api/v1/students/{$studentProfile->id}/grades");
        $allStudentGradesResp->assertStatus(200)
            ->assertJsonCount(2, 'data.grades');

        // 12. Authorization Check (Student cannot grade)
        $unauthGradeAttempt = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments/{$assign1Id}/submissions/{$submission1Id}/grade", [
            'score' => 100,
        ]);
        $unauthGradeAttempt->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        // 13. Tenant Isolation Check (Cross-tenant submission attempt)
        // Submitting to Tenant B assignment within Tenant A context -> 404
        $crossTenantQuery = $this->withHeaders([
            'X-Tenant-Slug' => 'alibdaa',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$course->id}/assignments/{$assignB->id}/submit", [
            'content' => 'Cross tenant exploit attempt',
        ]);
        $crossTenantQuery->assertStatus(404);

        // Submitting to Tenant B with Tenant A token -> 401
        $crossTenantAuth = $this->withHeaders([
            'X-Tenant-Slug' => 'almanar',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson("/api/v1/courses/{$courseB->id}/assignments/{$assignB->id}/submit", [
            'content' => 'Cross tenant exploit attempt',
        ]);
        $crossTenantAuth->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }
}
