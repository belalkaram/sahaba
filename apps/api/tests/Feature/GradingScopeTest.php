<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Role;
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

/** The grading inbox and grade publishing stay inside the courses the caller's role scope covers. */
class GradingScopeTest extends TestCase
{
    use RefreshDatabase;

    private string $slug;

    private Staff $teacherStaff;

    private Staff $otherStaff;

    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->slug = 'grading-'.strtolower(Str::random(6));
        $tenant = Tenant::create(['name' => 'Grading School', 'slug' => $this->slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$this->slug, 'status' => 'ready']);

        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $db->configureConnection($tenant);
        app(RoleSynchronizer::class)->sync();

        [$this->teacherStaff] = $this->staff('teacher');
        [$this->otherStaff] = $this->staff('other');

        $user = TenantUser::create(['name' => 'Student', 'email' => 'student@grading.test', 'password' => bcrypt('x'), 'type' => 'student', 'status' => 'active']);
        $user->roles()->attach(Role::where('name', 'student')->firstOrFail()->id);
        $this->student = Student::create(['user_id' => $user->id, 'student_code' => 'S-1', 'status' => 'active']);
    }

    /** @return array{0: Staff, 1: string} */
    private function staff(string $tag, string $role = 'teacher'): array
    {
        $user = TenantUser::create(['name' => "Staff $tag", 'email' => "$tag@grading.test", 'password' => bcrypt('x'), 'type' => 'staff', 'status' => 'active']);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);
        $staff = Staff::create(['user_id' => $user->id, 'staff_type' => $role === 'teacher' ? 'teacher' : 'assistant', 'status' => 'active']);

        return [$staff, TenantToken::createTokenFor($user)['plainTextToken']];
    }

    private function token(Staff $staff): string
    {
        return TenantToken::createTokenFor($staff->user)['plainTextToken'];
    }

    private function course(Staff $staff): Course
    {
        $course = Course::create(['teacher_staff_id' => $staff->id, 'title' => 'Course', 'code' => 'C-'.Str::random(4), 'status' => 'published', 'is_free' => true]);
        Enrollment::create(['student_id' => $this->student->id, 'course_id' => $course->id, 'status' => 'active']);

        return $course;
    }

    private function exam(Course $course): Exam
    {
        $exam = Exam::create(['course_id' => $course->id, 'title' => 'Exam', 'status' => 'published', 'is_published' => true, 'duration_minutes' => 10, 'max_attempts' => 1, 'show_results' => 'after_publish', 'total_points' => 10]);
        ExamAttempt::create(['exam_id' => $exam->id, 'student_id' => $this->student->id, 'attempt_number' => 1, 'started_at' => now(), 'submitted_at' => now(), 'status' => 'submitted']);

        return $exam;
    }

    private function assignment(Course $course): Assignment
    {
        $assignment = Assignment::create(['course_id' => $course->id, 'title' => 'Homework', 'status' => 'published', 'points_possible' => 10]);
        AssignmentSubmission::create(['assignment_id' => $assignment->id, 'student_id' => $this->student->id, 'attempt_number' => 1, 'submitted_at' => now(), 'status' => 'submitted', 'score' => 5]);

        return $assignment;
    }

    private function publish(string $token, array $payload)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $this->slug, 'Authorization' => 'Bearer '.$token])->postJson('/api/v1/grading/publish-bulk', $payload);
    }

    public function test_teacher_can_publish_grades_of_own_course(): void
    {
        $course = $this->course($this->teacherStaff);
        $exam = $this->exam($course);
        $assignment = $this->assignment($course);

        $response = $this->publish($this->token($this->teacherStaff), ['exam_ids' => [$exam->id], 'assignment_ids' => [$assignment->id]]);

        $response->assertOk()->assertJsonPath('data.published_count', 2);
        $this->assertTrue((bool) $exam->fresh()->is_grades_published);
        $this->assertTrue((bool) AssignmentSubmission::where('assignment_id', $assignment->id)->first()->is_grade_published);
    }

    public function test_teacher_cannot_publish_exam_grades_of_another_teachers_course(): void
    {
        $exam = $this->exam($this->course($this->otherStaff));

        $this->publish($this->token($this->teacherStaff), ['exam_ids' => [$exam->id]])->assertForbidden();

        $this->assertFalse((bool) $exam->fresh()->is_grades_published);
    }

    public function test_teacher_cannot_publish_assignment_grades_of_another_teachers_course(): void
    {
        $assignment = $this->assignment($this->course($this->otherStaff));

        $this->publish($this->token($this->teacherStaff), ['assignment_ids' => [$assignment->id]])->assertForbidden();

        $this->assertFalse((bool) AssignmentSubmission::where('assignment_id', $assignment->id)->first()->is_grade_published);
    }

    public function test_one_foreign_item_rejects_the_whole_request(): void
    {
        $own = $this->exam($this->course($this->teacherStaff));
        $ownAssignment = $this->assignment($this->course($this->teacherStaff));
        $foreign = $this->assignment($this->course($this->otherStaff));

        $this->publish($this->token($this->teacherStaff), ['exam_ids' => [$own->id], 'assignment_ids' => [$ownAssignment->id, $foreign->id]])->assertForbidden();

        $this->assertFalse((bool) $own->fresh()->is_grades_published);
        $this->assertFalse((bool) AssignmentSubmission::where('assignment_id', $ownAssignment->id)->first()->is_grade_published);
    }

    public function test_owner_with_tenant_scope_can_publish_any_course(): void
    {
        [, $ownerToken] = $this->staff('owner', 'owner');
        $exam = $this->exam($this->course($this->otherStaff));

        $this->publish($ownerToken, ['exam_ids' => [$exam->id]])->assertOk();

        $this->assertTrue((bool) $exam->fresh()->is_grades_published);
    }

    public function test_student_cannot_publish_grades(): void
    {
        $exam = $this->exam($this->course($this->teacherStaff));

        $this->publish(TenantToken::createTokenFor($this->student->user)['plainTextToken'], ['exam_ids' => [$exam->id]])->assertForbidden();

        $this->assertFalse((bool) $exam->fresh()->is_grades_published);
    }

    public function test_assistant_sees_and_publishes_only_assigned_courses(): void
    {
        [$assistant, $token] = $this->staff('assistant', 'assistant');
        $assigned = $this->course($this->teacherStaff);
        $assignedExam = $this->exam($assigned);
        $assignedHomework = Assignment::create(['course_id' => $assigned->id, 'title' => 'Homework', 'status' => 'published', 'points_possible' => 10]);
        AssignmentSubmission::create(['assignment_id' => $assignedHomework->id, 'student_id' => $this->student->id, 'attempt_number' => 1, 'submitted_at' => now(), 'status' => 'submitted']);
        $otherExam = $this->exam($this->course($this->otherStaff));
        StaffAssignment::create(['staff_id' => $assistant->id, 'assignable_type' => 'course', 'assignable_id' => $assigned->id]);

        $inbox = $this->withHeaders(['X-Tenant-Slug' => $this->slug, 'Authorization' => 'Bearer '.$token])->getJson('/api/v1/grading/pending')->assertOk();

        $this->assertSame([$assignedExam->id], collect($inbox->json('data.attempts'))->pluck('exam_id')->all());
        $this->assertSame([$assignedHomework->id], collect($inbox->json('data.submissions'))->pluck('assignment_id')->all());
        $this->publish($token, ['exam_ids' => [$assignedExam->id]])->assertOk();
        $this->publish($token, ['exam_ids' => [$otherExam->id]])->assertForbidden();
    }

    public function test_teacher_inbox_excludes_other_teachers_courses(): void
    {
        $own = $this->exam($this->course($this->teacherStaff));
        $this->exam($this->course($this->otherStaff));

        $inbox = $this->withHeaders(['X-Tenant-Slug' => $this->slug, 'Authorization' => 'Bearer '.$this->token($this->teacherStaff)])->getJson('/api/v1/grading/pending')->assertOk();

        $this->assertSame([$own->id], collect($inbox->json('data.attempts'))->pluck('exam_id')->all());
    }
}
