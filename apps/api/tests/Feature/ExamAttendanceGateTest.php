<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\ClassSession;
use App\Models\Classroom;
use App\Models\Course;
use App\Models\Exam;
use App\Models\Question;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantSetting;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** OD-35 / ATT-1: per-academy minimum attendance rate before sitting a course's exams. */
class ExamAttendanceGateTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{tenant: Tenant, student: Student, token: string, course: Course, exam: Exam, sessions: array<int, ClassSession>} */
    private function env(): array
    {
        $tenant = Tenant::create(['name' => 'Gate School', 'slug' => 'gate-'.Str::lower(Str::random(6)), 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$tenant->slug, 'status' => 'ready']);
        $manager = app(TenantDatabaseManager::class);
        $manager->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $manager->configureConnection($tenant);

        $teacher = TenantUser::create(['name' => 'T', 'email' => 't_'.$tenant->slug.'@test.com', 'password' => bcrypt('password123'), 'type' => 'staff', 'status' => 'active']);
        $staff = Staff::create(['user_id' => $teacher->id, 'staff_type' => 'teacher', 'status' => 'active']);

        $studentUser = TenantUser::create(['name' => 'S', 'email' => 's_'.$tenant->slug.'@test.com', 'password' => bcrypt('password123'), 'type' => 'student', 'status' => 'active']);
        $studentUser->roles()->attach(Role::firstOrCreate(['name' => 'student'], ['label' => 'Student'])->id);
        $student = Student::create(['user_id' => $studentUser->id, 'student_code' => 'STU-'.Str::upper(Str::random(4)), 'status' => 'active']);
        $token = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        $course = Course::create(['teacher_staff_id' => $staff->id, 'title' => 'Math', 'code' => 'M-'.Str::upper(Str::random(3)), 'status' => 'published', 'is_free' => true]);
        $exam = Exam::create(['course_id' => $course->id, 'title' => 'Quiz', 'duration_minutes' => 15, 'total_points' => 10, 'max_attempts' => 3, 'status' => 'published', 'is_published' => true]);
        Question::create(['exam_id' => $exam->id, 'question_text' => '1+1?', 'question_type' => 'short_answer', 'points' => 10, 'correct_answer' => '2', 'sort_order' => 1]);

        $room = Classroom::create(['branch_id' => Branch::create(['name' => 'Main'])->id, 'name' => 'R1', 'capacity' => 30]);
        $class = SchoolClass::create(['name' => 'A', 'course_id' => $course->id, 'classroom_id' => $room->id]);
        $sessions = [];
        for ($i = 1; $i <= 4; $i++) {
            $sessions[] = ClassSession::create(['class_id' => $class->id, 'classroom_id' => $room->id, 'title' => "S{$i}", 'session_date' => now()->subDays($i), 'status' => 'completed']);
        }

        return compact('tenant', 'student', 'token', 'course', 'exam', 'sessions');
    }

    /** Present in $present of the 4 sessions, absent in the rest. */
    private function attend(array $env, int $present): void
    {
        foreach ($env['sessions'] as $i => $session) {
            AttendanceRecord::create(['session_id' => $session->id, 'student_id' => $env['student']->id, 'status' => $i < $present ? 'present' : 'absent', 'mode' => 'manual']);
        }
    }

    private function start(array $env)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $env['tenant']->slug, 'Authorization' => 'Bearer '.$env['token']])
            ->postJson("/api/v1/courses/{$env['course']->id}/exams/{$env['exam']->id}/start");
    }

    public function test_no_minimum_set_means_no_rule(): void
    {
        $env = $this->env();
        $this->attend($env, 0);

        $this->start($env)->assertStatus(201);
    }

    public function test_student_below_the_academy_minimum_cannot_start(): void
    {
        $env = $this->env();
        TenantSetting::setValue(TenantSetting::MIN_ATTENDANCE_FOR_EXAMS, 75);
        $this->attend($env, 2); // 50%

        $this->start($env)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'ATTENDANCE_BELOW_MINIMUM')
            ->assertJsonPath('error.details.minimum', 75);
    }

    public function test_student_at_the_minimum_can_start(): void
    {
        $env = $this->env();
        TenantSetting::setValue(TenantSetting::MIN_ATTENDANCE_FOR_EXAMS, 75);
        $this->attend($env, 3); // 75%

        $this->start($env)->assertStatus(201);
    }

    public function test_student_without_recorded_attendance_is_not_blocked(): void
    {
        $env = $this->env();
        TenantSetting::setValue(TenantSetting::MIN_ATTENDANCE_FOR_EXAMS, 90);

        $this->start($env)->assertStatus(201);
    }
}
