<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Permission;
use App\Models\Question;
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
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class AssessmentLifecycleAndServerTimingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('tenant_private');
    }

    private function createTenantEnvironment(?string $slug = null): array
    {
        $slug = $slug ?? ('test-school-'.Str::random(6));

        $tenant = Tenant::create([
            'name' => 'Test School',
            'slug' => $slug,
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => 'tenant_'.$tenant->slug,
            'status' => 'ready',
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $dbManager->migrateTenant($tenant);
        $context->setTenant($tenant);
        $dbManager->configureConnection($tenant);

        // Permissions
        $pExamCreate = Permission::firstOrCreate(['name' => 'exams.create'], ['module' => 'assessment']);
        $pExamGrade = Permission::firstOrCreate(['name' => 'exams.grade'], ['module' => 'assessment']);
        $pAssignCreate = Permission::firstOrCreate(['name' => 'assignments.create'], ['module' => 'assessment']);
        $pAssignGrade = Permission::firstOrCreate(['name' => 'assignments.grade'], ['module' => 'assessment']);

        $teacherRole = Role::firstOrCreate(['name' => 'teacher'], ['label' => 'Teacher']);
        $teacherRole->permissions()->syncWithoutDetaching([
            $pExamCreate->id,
            $pExamGrade->id,
            $pAssignCreate->id,
            $pAssignGrade->id,
        ]);

        $studentRole = Role::firstOrCreate(['name' => 'student'], ['label' => 'Student']);

        // Teacher User
        $teacherUser = TenantUser::create([
            'name' => 'Professor Smith',
            'email' => 'smith_'.$slug.'@test.com',
            'password' => bcrypt('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherUser->roles()->attach($teacherRole->id);
        $staff = Staff::create([
            'user_id' => $teacherUser->id,
            'staff_type' => 'teacher',
            'status' => 'active',
        ]);
        $teacherToken = TenantToken::createTokenFor($teacherUser)['plainTextToken'];

        // Student User
        $studentUser = TenantUser::create([
            'name' => 'Alice Student',
            'email' => 'alice_'.$slug.'@test.com',
            'password' => bcrypt('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $student = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-'.strtoupper(Str::random(4)),
            'status' => 'active',
        ]);
        $studentToken = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        // Course
        $course = Course::create([
            'teacher_staff_id' => $staff->id,
            'title' => 'Biology 101',
            'code' => 'BIO-'.strtoupper(Str::random(3)),
            'status' => 'published',
            'is_free' => true,
        ]);

        return compact('tenant', 'teacherUser', 'staff', 'teacherToken', 'studentUser', 'student', 'studentToken', 'course');
    }

    public function test_exam_defaults_to_draft_and_cannot_be_published_without_questions(): void
    {
        $env = $this->createTenantEnvironment();

        // 1. Create exam
        $resp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams", [
            'title' => 'Cell Structure Exam',
            'duration_minutes' => 30,
        ]);

        $resp->assertStatus(201)
            ->assertJsonPath('data.exam.status', 'draft')
            ->assertJsonPath('data.exam.is_published', false);

        $examId = $resp->json('data.exam.id');

        // 2. Student cannot see draft exam
        $listResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->getJson("/api/v1/courses/{$env['course']->id}/exams");

        $listResp->assertStatus(200);
        $this->assertCount(0, $listResp->json('data.exams'));

        // 3. Publishing fails if 0 questions
        $pubResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$examId}/publish");

        $pubResp->assertStatus(422)
            ->assertJsonPath('error.code', 'UNPUBLISHABLE_EXAM');

        // 4. Add a question with points
        $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$examId}/questions", [
            'question_text' => 'What is the powerhouse of the cell?',
            'question_type' => 'multiple_choice',
            'points' => 10,
            'options' => ['Mitochondria', 'Nucleus', 'Ribosome'],
            'correct_answer' => 'Mitochondria',
        ])->assertStatus(201);

        // 5. Publishing succeeds now
        $pubSuccess = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$examId}/publish");

        $pubSuccess->assertStatus(200)
            ->assertJsonPath('data.exam.status', 'published')
            ->assertJsonPath('data.exam.is_published', true);

        // 6. Student now sees published exam
        $listResp2 = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->getJson("/api/v1/courses/{$env['course']->id}/exams");

        $listResp2->assertStatus(200);
        $this->assertCount(1, $listResp2->json('data.exams'));
    }

    public function test_server_authoritative_timing_and_late_answer_rejection(): void
    {
        $env = $this->createTenantEnvironment();

        // Create and publish exam with 15 minutes duration
        $exam = Exam::create([
            'course_id' => $env['course']->id,
            'title' => 'Speed Quiz',
            'duration_minutes' => 15,
            'total_points' => 20,
            'max_attempts' => 1,
            'status' => 'published',
            'is_published' => true,
        ]);

        $q = Question::create([
            'exam_id' => $exam->id,
            'question_text' => 'Water formula?',
            'question_type' => 'short_answer',
            'points' => 20,
            'correct_answer' => 'H2O',
            'acceptable_answers' => ['h2o', 'h 2 o'],
            'sort_order' => 1,
        ]);

        // Student starts exam
        $startResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/start");

        $startResp->assertStatus(201)
            ->assertJsonPath('data.attempt.status', 'in_progress');

        $attemptId = $startResp->json('data.attempt.id');
        $expiresAt = $startResp->json('data.attempt.expires_at');
        $this->assertNotNull($expiresAt);

        // GET attempt returns synced timer data
        $getResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->getJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}");

        $getResp->assertStatus(200)
            ->assertJsonStructure(['data' => ['attempt', 'server_now', 'expires_at', 'remaining_seconds']]);

        // Simulate expired time by updating expires_at into the past
        ExamAttempt::where('id', $attemptId)->update([
            'expires_at' => now()->subMinutes(5),
        ]);

        // Attempting to submit answer after expiration must be rejected with 422 ATTEMPT_EXPIRED
        $lateAnswerResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/answers", [
            'question_id' => $q->id,
            'answer_text' => 'H2O',
        ]);

        $lateAnswerResp->assertStatus(422)
            ->assertJsonPath('error.code', 'ATTEMPT_EXPIRED');

        // The attempt must have been auto-submitted
        $this->assertDatabaseHas('exam_attempts', [
            'id' => $attemptId,
            'status' => 'submitted',
        ], 'tenant');
    }

    public function test_concurrent_or_double_submit_is_idempotent(): void
    {
        $env = $this->createTenantEnvironment();

        $exam = Exam::create([
            'course_id' => $env['course']->id,
            'title' => 'Idempotence Exam',
            'duration_minutes' => 60,
            'total_points' => 10,
            'status' => 'published',
            'is_published' => true,
        ]);

        $q = Question::create([
            'exam_id' => $exam->id,
            'question_text' => 'Is Earth flat?',
            'question_type' => 'true_false',
            'points' => 10,
            'correct_answer' => 'false',
        ]);

        $startResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/start");

        $attemptId = $startResp->json('data.attempt.id');

        // Submit answer
        $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/answers", [
            'question_id' => $q->id,
            'answer_text' => 'false',
        ])->assertStatus(200);

        // First submit: returns 200 with status submitted
        $sub1 = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/submit");

        $sub1->assertStatus(200)
            ->assertJsonPath('data.attempt.status', 'submitted');

        // Second submit: returns 200 idempotently with already_submitted = true
        $sub2 = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/submit");

        $sub2->assertStatus(200)
            ->assertJsonPath('data.already_submitted', true);
    }

    public function test_question_types_auto_grading_and_staff_answer_visibility(): void
    {
        $env = $this->createTenantEnvironment();

        $exam = Exam::create([
            'course_id' => $env['course']->id,
            'title' => 'Mixed Question Types Test',
            'duration_minutes' => 60,
            'total_points' => 40,
            'status' => 'published',
            'is_published' => true,
        ]);

        // 1. Multiple Choice
        $qMc = Question::create([
            'exam_id' => $exam->id,
            'question_text' => 'Select Red',
            'question_type' => 'multiple_choice',
            'points' => 10,
            'options' => ['Red', 'Blue', 'Green'],
            'correct_answer' => 'Red',
            'sort_order' => 1,
        ]);

        // 2. Short Answer with normalized comparison
        $qSa = Question::create([
            'exam_id' => $exam->id,
            'question_text' => 'Capital of France?',
            'question_type' => 'short_answer',
            'points' => 10,
            'correct_answer' => 'Paris',
            'acceptable_answers' => ['paris', 'la ville de paris'],
            'sort_order' => 2,
        ]);

        // 3. Multiple Select
        $qMs = Question::create([
            'exam_id' => $exam->id,
            'question_text' => 'Select Even Numbers',
            'question_type' => 'multiple_select',
            'points' => 10,
            'options' => ['1', '2', '3', '4'],
            'acceptable_answers' => ['2', '4'],
            'sort_order' => 3,
        ]);

        // 4. Essay (Manual grading)
        $qEssay = Question::create([
            'exam_id' => $exam->id,
            'question_text' => 'Explain photosynthesis.',
            'question_type' => 'essay',
            'points' => 10,
            'sort_order' => 4,
        ]);

        // Student starts exam
        $startResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/start");

        $attemptId = $startResp->json('data.attempt.id');

        // Security check: Student starting exam NEVER receives correct_answer
        foreach ($startResp->json('data.questions') as $sq) {
            $this->assertArrayNotHasKey('correct_answer', $sq);
            $this->assertArrayNotHasKey('acceptable_answers', $sq);
        }

        // Student submits answers
        // MC: correct
        $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/answers", [
            'question_id' => $qMc->id,
            'answer_text' => 'Red',
        ])->assertJsonPath('data.answer.is_correct', true)
            ->assertJsonPath('data.answer.awarded_points', '10.00');

        // SA: correct with leading/trailing spaces and lower case
        $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/answers", [
            'question_id' => $qSa->id,
            'answer_text' => '  paris  ',
        ])->assertJsonPath('data.answer.is_correct', true)
            ->assertJsonPath('data.answer.awarded_points', '10.00');

        // MS: correct options ['2', '4']
        $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/answers", [
            'question_id' => $qMs->id,
            'selected_options' => ['4', '2'],
        ])->assertJsonPath('data.answer.is_correct', true)
            ->assertJsonPath('data.answer.awarded_points', '10.00');

        // Essay: pending evaluation (is_correct = null)
        $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/attempts/{$attemptId}/answers", [
            'question_id' => $qEssay->id,
            'answer_text' => 'Plants convert sunlight into chemical energy using chlorophyll.',
        ])->assertJsonPath('data.answer.is_correct', null)
            ->assertJsonPath('data.answer.awarded_points', null);

        // Staff endpoint with with_answers=1 returns answers explicitly
        $staffQuestionsResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->getJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/questions?with_answers=1");

        $staffQuestionsResp->assertStatus(200);
        $questions = $staffQuestionsResp->json('data.questions');
        $this->assertEquals('Red', $questions[0]['correct_answer']);
    }

    public function test_question_bank_crud_and_import_to_exam(): void
    {
        $env = $this->createTenantEnvironment();

        // 1. Create Question Bank
        $bankResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/question-banks", [
            'title' => 'Biology General Question Bank',
            'description' => 'Shared bank for all midterm exams',
        ]);

        $bankResp->assertStatus(201);
        $bankId = $bankResp->json('data.question_bank.id');

        // 2. Add Questions to Bank
        $q1Resp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/question-banks/{$bankId}/questions", [
            'question_text' => 'Bank Q1: Human body chromosome count?',
            'question_type' => 'short_answer',
            'points' => 5,
            'correct_answer' => '46',
        ]);
        $q1Resp->assertStatus(201);
        $bankQ1Id = $q1Resp->json('data.question.id');

        $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/question-banks/{$bankId}/questions", [
            'question_text' => 'Bank Q2: Plants produce oxygen during daylight?',
            'question_type' => 'true_false',
            'points' => 5,
            'correct_answer' => 'true',
        ])->assertStatus(201);

        // 3. Create Draft Exam
        $exam = Exam::create([
            'course_id' => $env['course']->id,
            'title' => 'Import Target Exam',
            'duration_minutes' => 45,
            'total_points' => 0,
            'status' => 'draft',
            'is_published' => false,
        ]);

        // 4. Import from Bank to Exam
        $importResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/exams/{$exam->id}/questions/import-from-bank", [
            'bank_id' => $bankId,
            'question_ids' => [$bankQ1Id],
        ]);

        $importResp->assertStatus(201);
        $this->assertCount(1, $importResp->json('data.imported_questions'));
        $this->assertEquals(5, $importResp->json('data.exam.total_points'));
    }

    public function test_assignment_file_submission_and_secure_download(): void
    {
        $env = $this->createTenantEnvironment();

        // 1. Create Assignment with file constraints
        $assignResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/assignments", [
            'title' => 'Lab Report 1',
            'description' => 'Upload your PDF lab report.',
            'points_possible' => 50,
            'due_at' => now()->addDays(3)->toIso8601String(),
            'allow_late' => true,
            'late_penalty_percent' => 10,
            'allow_resubmission' => true,
            'max_file_size_mb' => 5,
            'allowed_file_types' => 'pdf,docx',
        ]);

        $assignResp->assertStatus(201);
        $assignId = $assignResp->json('data.assignment.id');

        // 2. Student uploads a valid PDF file
        $file = UploadedFile::fake()->create('report.pdf', 500, 'application/pdf');

        $submitResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->post("/api/v1/courses/{$env['course']->id}/assignments/{$assignId}/submit", [
            'content' => 'Attached is my lab report for cell osmosis.',
            'file' => $file,
        ]);

        $submitResp->assertStatus(201)
            ->assertJsonPath('data.submission.file_name', 'report.pdf')
            ->assertJsonPath('data.submission.is_late', false);

        $submissionId = $submitResp->json('data.submission.id');

        // File must exist on tenant_private storage
        $storedPath = $submitResp->json('data.submission.file_path');
        Storage::disk('tenant_private')->assertExists($storedPath);

        // 3. Download file as Student (Owner)
        $dlStudent = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['studentToken'],
        ])->get("/api/v1/courses/{$env['course']->id}/assignments/{$assignId}/submissions/{$submissionId}/file");
        $dlStudent->assertStatus(200);

        // 4. Download file as Teacher (Grader)
        $dlTeacher = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->get("/api/v1/courses/{$env['course']->id}/assignments/{$assignId}/submissions/{$submissionId}/file");
        $dlTeacher->assertStatus(200);

        // 5. Teacher grades submission with late penalty check
        $gradeResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson("/api/v1/courses/{$env['course']->id}/assignments/{$assignId}/submissions/{$submissionId}/grade", [
            'score' => 48,
            'feedback' => 'Excellent analysis and accurate graphs.',
            'is_grade_published' => true,
        ]);

        $gradeResp->assertStatus(200)
            ->assertJsonPath('data.submission.score', '48.00')
            ->assertJsonPath('data.submission.status', 'graded');
    }

    public function test_staff_grading_inbox_and_bulk_publish(): void
    {
        $env = $this->createTenantEnvironment();

        // Create assignment and pending submission
        $assignment = Assignment::create([
            'course_id' => $env['course']->id,
            'title' => 'Pending Homework',
            'points_possible' => 20,
            'status' => 'published',
        ]);

        AssignmentSubmission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $env['student']->id,
            'content' => 'Please grade my homework.',
            'submitted_at' => now(),
            'status' => 'submitted',
        ]);

        // Query grading inbox
        $inboxResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->getJson('/api/v1/grading/pending');

        $inboxResp->assertStatus(200)
            ->assertJsonPath('data.count', 1);

        $this->assertCount(1, $inboxResp->json('data.submissions'));

        // Bulk publish grades
        $bulkResp = $this->withHeaders([
            'X-Tenant-Slug' => $env['tenant']->slug,
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ])->postJson('/api/v1/grading/publish-bulk', [
            'assignment_ids' => [$assignment->id],
        ]);

        $bulkResp->assertStatus(200)
            ->assertJsonPath('data.published_count', 1);
    }
}
