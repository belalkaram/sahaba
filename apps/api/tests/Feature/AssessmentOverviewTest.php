<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\ExamAnswer;
use App\Models\ExamAttempt;
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
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Staff overview pages for exams and assignments: counters, filters, permission scope, tenant boundary. */
class AssessmentOverviewTest extends TestCase
{
    use RefreshDatabase;

    private string $slug;

    private string $teacherToken;

    private string $otherTeacherToken;

    private string $studentToken;

    private Course $course;

    /** @var array<int, Student> */
    private array $students = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->slug = $this->makeTenant();
        $this->course = $this->makeWorld();
    }

    private function makeTenant(): string
    {
        $slug = 'overview-'.strtolower(Str::random(6));
        $tenant = Tenant::create(['name' => 'Overview School', 'slug' => $slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$slug, 'status' => 'ready']);

        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $db->configureConnection($tenant);
        app(RoleSynchronizer::class)->sync();

        return $slug;
    }

    private function makeStaffToken(string $tag, string $role = 'teacher'): array
    {
        $user = TenantUser::create(['name' => "Staff $tag", 'email' => "$tag@overview.test", 'password' => bcrypt('x'), 'type' => 'staff', 'status' => 'active']);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);
        $staff = Staff::create(['user_id' => $user->id, 'staff_type' => 'teacher', 'status' => 'active']);

        return [$staff, TenantToken::createTokenFor($user)['plainTextToken']];
    }

    private function makeWorld(): Course
    {
        [$staff, $this->teacherToken] = $this->makeStaffToken('teacher');
        [$otherStaff, $this->otherTeacherToken] = $this->makeStaffToken('other');

        $course = Course::create(['teacher_staff_id' => $staff->id, 'title' => 'Algebra', 'code' => 'ALG-1', 'status' => 'published', 'is_free' => true]);
        Course::create(['teacher_staff_id' => $otherStaff->id, 'title' => 'Other', 'code' => 'OTH-1', 'status' => 'published', 'is_free' => true]);

        $studentRole = Role::where('name', 'student')->firstOrFail();
        foreach (range(0, 4) as $i) {
            $user = TenantUser::create(['name' => "S$i", 'email' => "s$i@overview.test", 'password' => bcrypt('x'), 'type' => 'student', 'status' => 'active']);
            $user->roles()->attach($studentRole->id);
            $student = Student::create(['user_id' => $user->id, 'student_code' => "S-$i", 'status' => 'active']);
            Enrollment::create(['student_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
            $this->students[$i] = $student;
            if ($i === 0) {
                $this->studentToken = TenantToken::createTokenFor($user)['plainTextToken'];
            }
        }

        return $course;
    }

    private function as(string $token, ?string $slug = null)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $slug ?? $this->slug, 'Authorization' => 'Bearer '.$token]);
    }

    private function makeExam(array $overrides = []): Exam
    {
        return Exam::create($overrides + [
            'course_id' => $this->course->id,
            'title' => 'Midterm',
            'status' => 'published',
            'is_published' => true,
            'duration_minutes' => 30,
            'max_attempts' => 2,
            'show_results' => 'after_publish',
            'total_points' => 100,
            'passing_score' => 50,
        ]);
    }

    private function attempt(Exam $exam, int $student, array $overrides = []): ExamAttempt
    {
        return ExamAttempt::create($overrides + [
            'exam_id' => $exam->id,
            'student_id' => $this->students[$student]->id,
            'attempt_number' => 1,
            'started_at' => now()->subMinutes(5),
            'status' => 'in_progress',
        ]);
    }

    private function makeAssignment(array $overrides = []): Assignment
    {
        return Assignment::create($overrides + [
            'course_id' => $this->course->id,
            'title' => 'Homework',
            'status' => 'published',
            'points_possible' => 20,
        ]);
    }

    private function submission(Assignment $assignment, int $student, array $overrides = []): AssignmentSubmission
    {
        return AssignmentSubmission::create($overrides + [
            'assignment_id' => $assignment->id,
            'student_id' => $this->students[$student]->id,
            'attempt_number' => 1,
            'submitted_at' => now(),
            'status' => 'submitted',
        ]);
    }

    public function test_exam_row_reports_participation_and_best_attempt_results(): void
    {
        $exam = $this->makeExam();
        $essay = Question::create(['exam_id' => $exam->id, 'question_text' => 'Explain', 'question_type' => 'essay', 'points' => 100, 'sort_order' => 1]);

        // Student 0: two scored attempts, only the best one counts.
        $this->attempt($exam, 0, ['status' => 'graded', 'score' => 30, 'submitted_at' => now()]);
        $this->attempt($exam, 0, ['status' => 'graded', 'score' => 80, 'attempt_number' => 2, 'submitted_at' => now()]);
        // Student 1: scored below the pass mark, with a violation.
        $this->attempt($exam, 1, ['status' => 'graded', 'score' => 40, 'submitted_at' => now(), 'violation_count' => 2]);
        // Student 2: submitted with an ungraded essay.
        $pending = $this->attempt($exam, 2, ['status' => 'submitted', 'submitted_at' => now()]);
        ExamAnswer::create(['attempt_id' => $pending->id, 'question_id' => $essay->id, 'answer_text' => 'x']);
        // Student 3: still answering. Student 4: never opened it.
        $this->attempt($exam, 3, ['expires_at' => now()->addMinutes(10)]);

        $response = $this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview');

        $response->assertOk();
        $row = $response->json('data.exams.0');
        $this->assertSame('Midterm', $row['title']);
        $this->assertSame('ALG-1', $row['course']['code']);
        $this->assertSame(1, $row['questions_count']);
        $this->assertSame([
            'enrolled' => 5, 'started' => 4, 'not_started' => 1, 'in_progress' => 1, 'timed_out' => 0, 'completed' => 3,
            'pending_grading' => 1, 'graded' => 3, 'violators' => 1, 'passed' => 1, 'failed' => 1,
        ], array_intersect_key($row['stats'], array_flip(['enrolled', 'started', 'not_started', 'in_progress', 'timed_out', 'completed', 'pending_grading', 'graded', 'violators', 'passed', 'failed'])));
        $this->assertEquals(60, $row['stats']['average_score']);
        $this->assertEquals(80, $row['stats']['highest_score']);
        $this->assertEquals(40, $row['stats']['lowest_score']);
    }

    public function test_expired_attempt_counts_as_timed_out_unless_the_exam_allows_split_sessions(): void
    {
        $normal = $this->makeExam(['title' => 'Normal']);
        $split = $this->makeExam(['title' => 'Split', 'allow_split_sessions' => true]);
        $this->attempt($normal, 0, ['expires_at' => now()->subMinute()]);
        $this->attempt($split, 0, ['expires_at' => now()->subMinute()]);

        $rows = collect($this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview')->assertOk()->json('data.exams'))->keyBy('title');

        $this->assertSame([0, 1], [$rows['Normal']['stats']['in_progress'], $rows['Normal']['stats']['timed_out']]);
        $this->assertSame([1, 0], [$rows['Split']['stats']['in_progress'], $rows['Split']['stats']['timed_out']]);
    }

    public function test_pending_count_matches_the_grading_inbox(): void
    {
        $exam = $this->makeExam();
        $this->attempt($exam, 0, ['status' => 'submitted', 'submitted_at' => now()]);
        $this->attempt($exam, 1, ['status' => 'submitted', 'score' => 70, 'submitted_at' => now()]);
        $assignment = $this->makeAssignment();
        $this->submission($assignment, 0);
        $this->submission($assignment, 1, ['status' => 'graded', 'score' => 15]);

        $inbox = $this->as($this->teacherToken)->getJson('/api/v1/grading/pending')->assertOk();
        $exams = $this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview')->assertOk();
        $assignments = $this->as($this->teacherToken)->getJson('/api/v1/assessments/assignments-overview')->assertOk();

        $this->assertCount(1, $inbox->json('data.attempts'));
        $this->assertCount(1, $inbox->json('data.submissions'));
        $this->assertSame(1, $exams->json('data.summary.pending_grading'));
        $this->assertSame(1, $exams->json('data.exams.0.stats.pending_grading'));
        $this->assertSame(1, $assignments->json('data.summary.pending_grading'));
        $this->assertSame(1, $assignments->json('data.assignments.0.stats.pending_grading'));
    }

    public function test_exam_filters_narrow_the_list_but_summary_keeps_every_status(): void
    {
        $graded = $this->makeExam(['title' => 'Needs grading']);
        $this->attempt($graded, 0, ['status' => 'submitted', 'submitted_at' => now()]);
        $this->makeExam(['title' => 'Quiet exam']);
        $this->makeExam(['title' => 'Draft exam', 'status' => 'draft', 'is_published' => false]);

        $titles = fn (string $query) => collect($this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview?'.$query)->assertOk()->json('data.exams'))->pluck('title')->sort()->values()->all();

        $this->assertSame(['Draft exam'], $titles('status=draft'));
        $this->assertSame(['Needs grading'], $titles('needs=pending_grading'));
        $this->assertSame(['Quiet exam'], $titles('needs=no_participation'));
        $this->assertSame(['Quiet exam'], $titles('search=QUIET'));
        $this->assertSame(['Draft exam', 'Needs grading', 'Quiet exam'], $titles('search=alg-1'));
        $this->assertSame([], $titles('date_to=2000-01-01'));

        $summary = $this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview?status=draft')->json('data.summary');
        $this->assertSame([3, 1, 2], [$summary['total'], $summary['draft'], $summary['published']]);
    }

    public function test_assignment_row_reports_submissions_and_filters(): void
    {
        $assignment = $this->makeAssignment(['title' => 'Past due', 'due_at' => now()->subDay()]);
        $this->submission($assignment, 0, ['status' => 'graded', 'score' => 10]);
        $this->submission($assignment, 0, ['status' => 'graded', 'score' => 18, 'attempt_number' => 2, 'is_grade_published' => true]);
        $this->submission($assignment, 1, ['is_late' => true, 'file_path' => 'x.pdf', 'file_name' => 'x.pdf']);
        $this->makeAssignment(['title' => 'Open', 'due_at' => now()->addDay()]);

        $response = $this->as($this->teacherToken)->getJson('/api/v1/assessments/assignments-overview?needs=past_due_missing')->assertOk();

        $this->assertCount(1, $response->json('data.assignments'));
        $row = $response->json('data.assignments.0');
        $this->assertTrue($row['is_past_due']);
        $this->assertSame([
            'enrolled' => 5, 'submitted' => 2, 'not_submitted' => 3, 'late' => 1, 'with_file' => 1, 'pending_grading' => 1, 'graded' => 1, 'grades_published' => 1,
        ], array_intersect_key($row['stats'], array_flip(['enrolled', 'submitted', 'not_submitted', 'late', 'with_file', 'pending_grading', 'graded', 'grades_published'])));
        $this->assertEquals(18, $row['stats']['average_score']);

        $titles = fn (string $query) => collect($this->as($this->teacherToken)->getJson('/api/v1/assessments/assignments-overview?'.$query)->assertOk()->json('data.assignments'))->pluck('title')->all();
        $this->assertSame(['Open'], $titles('needs=no_submissions'));
        $this->assertSame(['Past due'], $titles('needs=late'));
        $this->assertSame(['Open'], $titles('needs=open_now'));
        $this->assertSame(1, $response->json('data.summary.past_due_missing'));
    }

    public function test_summary_in_progress_agrees_with_the_in_progress_filter(): void
    {
        $exam = $this->makeExam();
        $this->attempt($exam, 0, ['expires_at' => now()->subMinute()]);

        $response = $this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview?needs=in_progress')->assertOk();

        $this->assertSame([], $response->json('data.exams'));
        $this->assertSame(0, $response->json('data.summary.in_progress'));
    }

    public function test_query_count_does_not_grow_with_the_number_of_rows(): void
    {
        $this->makeExam(['title' => 'First']);
        // Counted with an event listener: each request re-opens the tenant connection, which would lose a query log.
        $executed = 0;
        Event::listen(QueryExecuted::class, function () use (&$executed) {
            $executed++;
        });
        $queries = function () use (&$executed): int {
            $executed = 0;
            $this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview')->assertOk();

            return $executed;
        };

        $queries(); // The first request also writes the token's last_used_at.
        $one = $queries();
        $this->assertGreaterThan(0, $one);
        $this->assertLessThanOrEqual(20, $one);

        foreach (range(1, 8) as $i) {
            $this->attempt($this->makeExam(['title' => "More $i"]), 0, ['status' => 'graded', 'score' => 50, 'submitted_at' => now()]);
        }

        $this->assertSame($one, $queries());
    }

    public function test_student_cannot_read_the_overviews(): void
    {
        $this->makeExam();

        $this->as($this->studentToken)->getJson('/api/v1/assessments/exams-overview')->assertForbidden();
        $this->as($this->studentToken)->getJson('/api/v1/assessments/assignments-overview')->assertForbidden();
    }

    public function test_teacher_with_own_scope_sees_only_own_courses(): void
    {
        $this->makeExam();
        $this->makeAssignment();

        $exams = $this->as($this->otherTeacherToken)->getJson('/api/v1/assessments/exams-overview?course_id='.$this->course->id)->assertOk();
        $assignments = $this->as($this->otherTeacherToken)->getJson('/api/v1/assessments/assignments-overview')->assertOk();

        $this->assertSame([], $exams->json('data.exams'));
        $this->assertSame(0, $exams->json('data.summary.total'));
        $this->assertSame([], $assignments->json('data.assignments'));
        $this->assertSame(['OTH-1'], collect($exams->json('data.courses'))->pluck('code')->all());
    }

    public function test_token_from_another_tenant_is_rejected(): void
    {
        $this->makeExam();
        $firstTenantToken = $this->teacherToken;

        $secondSlug = $this->makeTenant();

        $this->as($firstTenantToken, $secondSlug)->getJson('/api/v1/assessments/exams-overview')->assertUnauthorized();
    }

    public function test_invalid_filters_are_rejected(): void
    {
        $this->as($this->teacherToken)->getJson('/api/v1/assessments/exams-overview?status=nope')->assertUnprocessable();
        $this->as($this->teacherToken)->getJson('/api/v1/assessments/assignments-overview?needs=violations')->assertUnprocessable();
    }
}
