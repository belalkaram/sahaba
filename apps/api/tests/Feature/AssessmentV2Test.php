<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Enrollment;
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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Assessment v2: split-session exam time budget, question images, assignment questions,
 * and teacher-controlled release of model answers.
 */
class AssessmentV2Test extends TestCase
{
    use RefreshDatabase;

    private array $env;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('tenant_private');
        $this->env = $this->makeEnvironment();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeEnvironment(): array
    {
        $slug = 'v2-school-'.Str::random(5);
        $tenant = Tenant::create(['name' => 'V2 School', 'slug' => $slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$slug, 'status' => 'ready']);

        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $db->configureConnection($tenant);

        $perms = [];
        foreach (['exams.create', 'exams.grade', 'assignments.create', 'assignments.grade'] as $name) {
            $perms[] = Permission::firstOrCreate(['name' => $name], ['module' => 'assessment'])->id;
        }
        $teacherRole = Role::firstOrCreate(['name' => 'teacher'], ['label' => 'Teacher']);
        $teacherRole->permissions()->syncWithoutDetaching($perms);
        $studentRole = Role::firstOrCreate(['name' => 'student'], ['label' => 'Student']);

        $teacherUser = TenantUser::create(['name' => 'Teacher', 'email' => "t_$slug@test.com", 'password' => bcrypt('x'), 'type' => 'staff', 'status' => 'active']);
        $teacherUser->roles()->attach($teacherRole->id);
        $staff = Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);

        $course = Course::create(['teacher_staff_id' => $staff->id, 'title' => 'Course', 'code' => 'C-'.Str::random(3), 'status' => 'published', 'is_free' => true]);

        $students = [];
        foreach (['a', 'b'] as $tag) {
            $user = TenantUser::create(['name' => "Student $tag", 'email' => "s{$tag}_$slug@test.com", 'password' => bcrypt('x'), 'type' => 'student', 'status' => 'active']);
            $user->roles()->attach($studentRole->id);
            $student = Student::create(['user_id' => $user->id, 'student_code' => 'S-'.strtoupper(Str::random(4)), 'status' => 'active']);
            Enrollment::create(['student_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
            $students[$tag] = ['student' => $student, 'token' => TenantToken::createTokenFor($user)['plainTextToken']];
        }

        $teacherToken = TenantToken::createTokenFor($teacherUser)['plainTextToken'];
        // Tests travel in time: keep the bearer tokens valid.
        TenantToken::query()->update(['expires_at' => null]);

        return ['slug' => $slug, 'course' => $course, 'teacherToken' => $teacherToken, 'students' => $students];
    }

    private function as(string $token)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $this->env['slug'], 'Authorization' => 'Bearer '.$token]);
    }

    private function teacher()
    {
        return $this->as($this->env['teacherToken']);
    }

    private function student(string $tag = 'a')
    {
        return $this->as($this->env['students'][$tag]['token']);
    }

    private function makeExam(array $overrides = []): Exam
    {
        $exam = Exam::create($overrides + [
            'course_id' => $this->env['course']->id,
            'title' => 'Exam',
            'status' => 'published',
            'is_published' => true,
            'duration_minutes' => 10,
            'max_attempts' => 1,
            'show_results' => 'after_publish',
            'total_points' => 10,
        ]);
        Question::create(['exam_id' => $exam->id, 'question_text' => '2+2?', 'question_type' => 'multiple_choice', 'points' => 10, 'options' => ['3', '4'], 'correct_answer' => '4', 'model_answer' => 'Because 2+2=4', 'sort_order' => 1]);

        return $exam;
    }

    private function url(string $path): string
    {
        return "/api/v1/courses/{$this->env['course']->id}/$path";
    }

    // ---- split-session time budget -------------------------------------------------------------------

    public function test_split_exam_charges_only_active_time_across_sittings(): void
    {
        Carbon::setTestNow('2026-11-10 09:00:00');
        $exam = $this->makeExam(['allow_split_sessions' => true, 'opens_at' => now()->subDay(), 'closes_at' => now()->addDays(5)]);

        $start = $this->student()->postJson($this->url("exams/{$exam->id}/start"))->assertStatus(201);
        $attemptId = $start->json('data.attempt.id');
        $this->assertSame(600, $start->json('data.remaining_seconds'));

        Carbon::setTestNow(now()->addSeconds(15));
        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/heartbeat"))
            ->assertOk()->assertJsonPath('data.remaining_seconds', 585)->assertJsonPath('data.expired', false);

        // Back the next day. Merely opening the briefing (active-attempt) is a free peek ...
        Carbon::setTestNow(now()->addDay());
        $peek = $this->student()->getJson($this->url("exams/{$exam->id}/active-attempt"))->assertOk();
        $this->assertSame(585, $peek->json('data.remaining_seconds'));
        $this->assertTrue($peek->json('data.split_sessions'));
        // ... and the first beat of the new sitting charges only a short grace for the whole night, not 24 hours.
        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/heartbeat"), ['resume' => true])
            ->assertOk()->assertJsonPath('data.remaining_seconds', 565);

        // Missing heartbeats never charge more than the grace window.
        Carbon::setTestNow(now()->addHours(3));
        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/heartbeat"))
            ->assertOk()->assertJsonPath('data.remaining_seconds', 520);
    }

    public function test_split_exam_is_submitted_when_budget_is_used_up(): void
    {
        Carbon::setTestNow('2026-11-10 09:00:00');
        $exam = $this->makeExam(['allow_split_sessions' => true, 'closes_at' => now()->addDays(3)]);
        $attemptId = $this->student()->postJson($this->url("exams/{$exam->id}/start"))->json('data.attempt.id');

        ExamAttempt::whereKey($attemptId)->update(['time_used_seconds' => 595]);
        Carbon::setTestNow(now()->addSeconds(10));

        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/heartbeat"))
            ->assertOk()->assertJsonPath('data.expired', true)->assertJsonPath('data.remaining_seconds', 0);

        $this->assertSame('submitted', ExamAttempt::find($attemptId)->status);
    }

    public function test_split_exam_ends_when_the_window_closes_even_with_time_left(): void
    {
        Carbon::setTestNow('2026-11-10 09:00:00');
        $exam = $this->makeExam(['allow_split_sessions' => true, 'closes_at' => now()->addDay()]);
        $attemptId = $this->student()->postJson($this->url("exams/{$exam->id}/start"))->json('data.attempt.id');

        Carbon::setTestNow(now()->addDays(2));
        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/heartbeat"))
            ->assertOk()->assertJsonPath('data.expired', true);
    }

    public function test_single_session_exam_keeps_the_original_deadline(): void
    {
        Carbon::setTestNow('2026-11-10 09:00:00');
        $exam = $this->makeExam();
        $attemptId = $this->student()->postJson($this->url("exams/{$exam->id}/start"))->json('data.attempt.id');

        Carbon::setTestNow(now()->addMinutes(11));
        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/heartbeat"))
            ->assertOk()->assertJsonPath('data.expired', true);
    }

    // ---- images --------------------------------------------------------------------------------------

    public function test_question_image_is_uploaded_by_teacher_and_served_without_leaking_paths(): void
    {
        $exam = $this->makeExam();
        $question = $exam->questions()->first();

        $this->teacher()->post($this->url("exams/{$exam->id}/questions/{$question->id}/image"), [
            'image' => UploadedFile::fake()->image('q.png', 200, 120),
        ])->assertOk()->assertJsonPath('data.question.has_image', true)
            ->assertJsonMissingPath('data.question.image_path');

        // Student must have started the exam before the image is served.
        $this->student()->get($this->url("exams/{$exam->id}/questions/{$question->id}/image"))->assertForbidden();
        $this->student()->postJson($this->url("exams/{$exam->id}/start"))->assertStatus(201);
        $this->student()->get($this->url("exams/{$exam->id}/questions/{$question->id}/image"))->assertOk();

        // The question list shows the flag, never the path or the model answer.
        $list = $this->student()->getJson($this->url("exams/{$exam->id}/questions"))->assertOk();
        $this->assertTrue($list->json('data.questions.0.has_image'));
        $this->assertArrayNotHasKey('image_path', $list->json('data.questions.0'));
        $this->assertArrayNotHasKey('model_answer', $list->json('data.questions.0'));

        // A student cannot upload.
        $this->student()->post($this->url("exams/{$exam->id}/questions/{$question->id}/image"), [
            'image' => UploadedFile::fake()->image('x.png'),
        ])->assertForbidden();
    }

    public function test_started_attempt_payload_carries_image_flag_but_not_answers(): void
    {
        $exam = $this->makeExam();
        $question = $exam->questions()->first();
        $question->update(['image_path' => 'tenants/'.$this->env['slug'].'/images/questions/x.png']);

        $start = $this->student()->postJson($this->url("exams/{$exam->id}/start"))->assertStatus(201);
        $q = $start->json('data.questions.0');
        $this->assertArrayNotHasKey('correct_answer', $q);
        $this->assertArrayNotHasKey('model_answer', $q);
        $this->assertArrayNotHasKey('image_path', $q);
    }

    // ---- assignment questions ------------------------------------------------------------------------

    private function makeAssignmentWithQuestions(): array
    {
        $a = $this->teacher()->postJson($this->url('assignments'), ['title' => 'HW', 'due_at' => now()->addDay()->toIso8601String()])->assertStatus(201);
        $id = $a->json('data.assignment.id');
        $mcq = $this->teacher()->postJson($this->url("assignments/$id/questions"), [
            'question_text' => '1+1?', 'question_type' => 'multiple_choice', 'points' => 5, 'options' => ['1', '2'], 'correct_answer' => '2', 'model_answer' => 'two',
        ])->assertStatus(201);
        $essay = $this->teacher()->postJson($this->url("assignments/$id/questions"), [
            'question_text' => 'Explain', 'question_type' => 'essay', 'points' => 5, 'model_answer' => 'Because...',
        ])->assertStatus(201);

        return [$id, $mcq->json('data.question.id'), $essay->json('data.question.id')];
    }

    public function test_assignment_questions_hide_answers_from_students_and_total_points_follow(): void
    {
        [$id] = $this->makeAssignmentWithQuestions();

        $this->assertEquals(10, Assignment::find($id)->points_possible);

        $list = $this->student()->getJson($this->url("assignments/$id/questions"))->assertOk();
        $this->assertCount(2, $list->json('data.questions'));
        foreach ($list->json('data.questions') as $q) {
            $this->assertArrayNotHasKey('correct_answer', $q);
            $this->assertArrayNotHasKey('model_answer', $q);
        }

        $staff = $this->teacher()->getJson($this->url("assignments/$id/questions?with_answers=1"))->assertOk();
        $this->assertSame('2', $staff->json('data.questions.0.correct_answer'));
    }

    public function test_assignment_answers_are_auto_graded_and_essay_waits_for_teacher(): void
    {
        [$id, $mcqId, $essayId] = $this->makeAssignmentWithQuestions();

        $resp = $this->student()->postJson($this->url("assignments/$id/submit"), ['answers' => [
            ['question_id' => $mcqId, 'answer_text' => '2'],
            ['question_id' => $essayId, 'answer_text' => 'My explanation'],
        ]])->assertStatus(201);

        $submissionId = $resp->json('data.submission.id');
        $this->assertSame('submitted', $resp->json('data.submission.status'));
        $this->assertEquals(5, $resp->json('data.submission.score'));

        $answers = $this->teacher()->getJson($this->url("assignments/$id/submissions/$submissionId/answers"))->assertOk();
        $essayAnswer = collect($answers->json('data.answers'))->firstWhere('question_id', $essayId);

        $this->teacher()->postJson($this->url("assignments/$id/submissions/$submissionId/answers/{$essayAnswer['id']}/grade"), ['awarded_points' => 4, 'feedback' => 'good'])
            ->assertOk();

        $sub = AssignmentSubmission::find($submissionId);
        $this->assertSame('graded', $sub->status);
        $this->assertEquals(9, $sub->score);
    }

    public function test_assignment_can_be_submitted_with_only_answers(): void
    {
        [$id, $mcqId] = $this->makeAssignmentWithQuestions();
        $this->student()->postJson($this->url("assignments/$id/submit"), [])->assertStatus(422);
        $this->student()->postJson($this->url("assignments/$id/submit"), ['answers' => [['question_id' => $mcqId, 'answer_text' => '1']]])->assertStatus(201);
    }

    // ---- model answers -------------------------------------------------------------------------------

    private function finishedExamForStudentA(array $examOverrides = []): Exam
    {
        $exam = $this->makeExam($examOverrides);
        $question = $exam->questions()->first();
        $attemptId = $this->student()->postJson($this->url("exams/{$exam->id}/start"))->json('data.attempt.id');
        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/answers"), ['question_id' => $question->id, 'answer_text' => '3'])->assertOk();
        $this->student()->postJson($this->url("exams/{$exam->id}/attempts/$attemptId/submit"))->assertOk();

        return $exam;
    }

    public function test_model_answers_require_finished_published_and_released(): void
    {
        $exam = $this->makeExam();
        $url = $this->url("exams/{$exam->id}/model-answers");

        // Not finished yet.
        $this->student()->getJson($url)->assertForbidden()->assertJsonPath('error.details.reason', 'NOT_FINISHED');

        $exam = $this->finishedExamForStudentA();
        $url = $this->url("exams/{$exam->id}/model-answers");

        // Finished, grades not published.
        $this->student()->getJson($url)->assertForbidden()->assertJsonPath('error.details.reason', 'GRADES_NOT_PUBLISHED');

        $exam->update(['is_grades_published' => true]);
        // Published, not released by the teacher.
        $this->student()->getJson($url)->assertForbidden()->assertJsonPath('error.details.reason', 'NOT_RELEASED');
    }

    public function test_teacher_releases_to_one_student_then_revokes(): void
    {
        $exam = $this->finishedExamForStudentA();
        $exam->update(['is_grades_published' => true]);
        $base = $this->url("exams/{$exam->id}/model-answers");
        $studentAId = $this->env['students']['a']['student']->id;

        // Student B never took the exam and is not released: no access either way.
        $this->student('b')->getJson($base)->assertForbidden();

        $this->teacher()->postJson("$base/release", ['scope' => 'student', 'student_ids' => [$studentAId]])->assertStatus(201);

        $view = $this->student()->getJson($base)->assertOk();
        $this->assertSame('Because 2+2=4', $view->json('data.questions.0.model_answer'));
        $this->assertSame('4', $view->json('data.questions.0.correct_answer'));
        $this->assertSame('3', $view->json('data.questions.0.student_answer'));

        $status = $this->teacher()->getJson("$base/status")->assertOk();
        $row = collect($status->json('data.students'))->firstWhere('student_id', $studentAId);
        $this->assertTrue($row['finished'] && $row['graded'] && $row['can_view']);

        $this->teacher()->postJson("$base/revoke", ['scope' => 'student', 'student_ids' => [$studentAId]])->assertOk()->assertJsonPath('data.revoked', 1);
        $this->student()->getJson($base)->assertForbidden();
    }

    public function test_release_to_all_and_auto_release_after_window(): void
    {
        Carbon::setTestNow('2026-11-10 09:00:00');
        $exam = $this->finishedExamForStudentA(['closes_at' => now()->addHours(2)]);
        $exam->update(['is_grades_published' => true]);
        $base = $this->url("exams/{$exam->id}/model-answers");

        $this->teacher()->postJson("$base/auto-release", ['enabled' => true])->assertOk();
        // Window still open: not yet.
        $this->student()->getJson($base)->assertForbidden();

        Carbon::setTestNow(now()->addHours(3));
        $this->student()->getJson($base)->assertOk();
    }

    public function test_students_cannot_manage_releases(): void
    {
        $exam = $this->finishedExamForStudentA();
        $base = $this->url("exams/{$exam->id}/model-answers");
        $sid = $this->env['students']['a']['student']->id;

        $this->student()->postJson("$base/release", ['scope' => 'all'])->assertForbidden();
        $this->student()->getJson("$base/status")->assertForbidden();
        $this->student()->postJson("$base/auto-release", ['enabled' => true])->assertForbidden();
        $this->assertSame(0, \App\Models\ModelAnswerRelease::count());
        $this->assertNotNull($sid);
    }
}
