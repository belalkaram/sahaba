<?php

namespace Tests\Feature;

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

/**
 * Course/teacher images, opt-in public landing data, and exam resume + integrity events.
 */
class PublicAcademyAndImagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function env(?string $slug = null): array
    {
        $slug = $slug ?? ('pub-'.Str::lower(Str::random(6)));
        $tenant = Tenant::create(['name' => 'Public School', 'slug' => $slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$slug, 'status' => 'ready']);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $dbManager->configureConnection($tenant);

        $teacherRole = Role::firstOrCreate(['name' => 'teacher'], ['label' => 'Teacher']);
        $teacherRole->permissions()->syncWithoutDetaching([
            Permission::firstOrCreate(['name' => 'courses.update'], ['module' => 'education'])->id,
        ]);
        $studentRole = Role::firstOrCreate(['name' => 'student'], ['label' => 'Student']);

        $make = function (string $name, string $type, Role $role) use ($slug) {
            $user = TenantUser::create([
                'name' => $name,
                'email' => Str::slug($name).'_'.$slug.'@test.com',
                'password' => bcrypt('password123'),
                'type' => $type,
                'status' => 'active',
            ]);
            $user->roles()->attach($role->id);

            return $user;
        };

        $teacherUser = $make('Teacher One', 'staff', $teacherRole);
        $staff = Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $otherUser = $make('Teacher Two', 'staff', $teacherRole);
        $otherStaff = Staff::create(['user_id' => $otherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $studentUser = $make('Student One', 'student', $studentRole);
        $student = Student::create(['user_id' => $studentUser->id, 'student_code' => 'S-'.Str::upper(Str::random(4)), 'status' => 'active']);

        $course = Course::create([
            'teacher_staff_id' => $staff->id,
            'title' => 'Physics',
            'description' => 'Forces and motion',
            'status' => 'published',
            'is_free' => true,
        ]);

        return [
            'slug' => $slug,
            'staff' => $staff,
            'otherStaff' => $otherStaff,
            'student' => $student,
            'course' => $course,
            'teacherToken' => TenantToken::createTokenFor($teacherUser)['plainTextToken'],
            'otherToken' => TenantToken::createTokenFor($otherUser)['plainTextToken'],
            'studentToken' => TenantToken::createTokenFor($studentUser)['plainTextToken'],
        ];
    }

    private function as(array $env, string $tokenKey = 'teacherToken')
    {
        return $this->withHeaders(['X-Tenant-Slug' => $env['slug'], 'Authorization' => 'Bearer '.$env[$tokenKey]]);
    }

    private function guest(array $env)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $env['slug']]);
    }

    public function test_public_landing_lists_only_opted_in_published_content_without_contact_details(): void
    {
        $env = $this->env();

        // Nothing is public by default.
        $this->guest($env)->getJson('/api/v1/public/academy/courses')->assertOk()->assertJsonCount(0, 'data.courses');
        $this->guest($env)->getJson('/api/v1/public/academy/teachers')->assertOk()->assertJsonCount(0, 'data.teachers');

        $this->as($env)->putJson("/api/v1/courses/{$env['course']->id}", ['is_public' => true])->assertOk();
        $this->as($env)->putJson("/api/v1/staff/{$env['staff']->id}/public-profile", [
            'headline' => 'Physics teacher', 'public_bio' => 'Ten years of teaching.', 'is_public' => true,
        ])->assertOk();

        $courses = $this->guest($env)->getJson('/api/v1/public/academy/courses')->assertOk();
        $courses->assertJsonCount(1, 'data.courses')->assertJsonPath('data.courses.0.title', 'Physics');

        $teachers = $this->guest($env)->getJson('/api/v1/public/academy/teachers')->assertOk();
        $teachers->assertJsonPath('data.teachers.0.name', 'Teacher One')->assertJsonPath('data.teachers.0.courses_count', 1);
        $this->assertStringNotContainsString('@', json_encode($teachers->json()), 'No e-mail addresses on public pages.');

        // A draft course never shows even when flagged public.
        $this->as($env)->putJson("/api/v1/courses/{$env['course']->id}", ['status' => 'draft'])->assertOk();
        $this->guest($env)->getJson('/api/v1/public/academy/courses')->assertJsonCount(0, 'data.courses');
        $this->guest($env)->getJson("/api/v1/public/academy/courses/{$env['course']->id}")->assertNotFound();
    }

    public function test_public_data_never_crosses_tenants(): void
    {
        $a = $this->env();
        $this->as($a)->putJson("/api/v1/courses/{$a['course']->id}", ['is_public' => true])->assertOk();

        $b = $this->env();
        $this->guest($b)->getJson('/api/v1/public/academy/courses')->assertOk()->assertJsonCount(0, 'data.courses');
        $this->guest($b)->getJson("/api/v1/public/academy/courses/{$a['course']->id}")->assertNotFound();
    }

    public function test_teacher_uploads_course_cover_and_it_is_served_only_when_public(): void
    {
        $env = $this->env();
        $file = UploadedFile::fake()->image('cover.png', 800, 450);

        $resp = $this->as($env)->post("/api/v1/courses/{$env['course']->id}/cover", ['image' => $file], ['Accept' => 'application/json']);
        $resp->assertOk();
        $path = Course::find($env['course']->id)->cover_path;
        $this->assertStringStartsWith('tenants/'.$env['slug'].'/images/courses/', $path);
        Storage::disk('local')->assertExists($path);

        // Not public yet -> 404 for guests, but the owner can preview it.
        $this->guest($env)->get("/api/v1/public/academy/courses/{$env['course']->id}/image")->assertNotFound();
        $this->as($env)->get("/api/v1/courses/{$env['course']->id}/cover")->assertOk();

        $this->as($env)->putJson("/api/v1/courses/{$env['course']->id}", ['is_public' => true])->assertOk();
        $this->guest($env)->get("/api/v1/public/academy/courses/{$env['course']->id}/image")->assertOk();

        // Replacing deletes the old file.
        $this->as($env)->post("/api/v1/courses/{$env['course']->id}/cover", ['image' => UploadedFile::fake()->image('b.jpg')], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('local')->assertMissing($path);
    }

    public function test_image_upload_rejects_non_images_oversize_and_foreign_users(): void
    {
        $env = $this->env();
        $url = "/api/v1/courses/{$env['course']->id}/cover";
        $h = ['Accept' => 'application/json'];

        $this->as($env)->post($url, ['image' => UploadedFile::fake()->create('x.svg', 10, 'image/svg+xml')], $h)->assertStatus(422);
        $this->as($env)->post($url, ['image' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')], $h)->assertStatus(422);
        $this->as($env)->post($url, ['image' => UploadedFile::fake()->image('big.png')->size(4000)], $h)->assertStatus(422);

        // A student and another teacher (not the owner, scope "own" is not enforced here, but students lack permission).
        $this->as($env, 'studentToken')->post($url, ['image' => UploadedFile::fake()->image('a.png')], $h)->assertStatus(403);
    }

    public function test_client_cannot_point_cover_path_at_arbitrary_files(): void
    {
        $env = $this->env();
        $this->as($env)->putJson("/api/v1/courses/{$env['course']->id}", ['cover_path' => '../../.env', 'is_public' => true])->assertOk();

        $this->assertNull(Course::find($env['course']->id)->cover_path);
    }

    public function test_teacher_manages_own_photo_but_not_another_teachers(): void
    {
        $env = $this->env();
        $h = ['Accept' => 'application/json'];

        $this->as($env)->post("/api/v1/staff/{$env['staff']->id}/photo", ['image' => UploadedFile::fake()->image('me.jpg')], $h)->assertOk();
        Storage::disk('local')->assertExists(Staff::find($env['staff']->id)->photo_path);

        $this->as($env)->post("/api/v1/staff/{$env['otherStaff']->id}/photo", ['image' => UploadedFile::fake()->image('x.jpg')], $h)->assertStatus(403);
        $this->as($env)->putJson("/api/v1/staff/{$env['otherStaff']->id}/public-profile", ['is_public' => true])->assertStatus(403);

        $this->as($env)->deleteJson("/api/v1/staff/{$env['staff']->id}/photo")->assertOk();
        $this->assertNull(Staff::find($env['staff']->id)->photo_path);
    }

    private function openExam(array $env): Exam
    {
        $exam = Exam::create([
            'course_id' => $env['course']->id,
            'title' => 'Midterm',
            'duration_minutes' => 30,
            'max_attempts' => 1,
            'shuffle_questions' => true,
            'shuffle_options' => true,
            'status' => 'published',
            'is_published' => true,
        ]);
        foreach (range(1, 6) as $i) {
            Question::create([
                'exam_id' => $exam->id,
                'question_text' => "Q$i",
                'question_type' => 'multiple_choice',
                'points' => 5,
                'options' => ['a', 'b', 'c', 'd'],
                'correct_answer' => 'a',
                'sort_order' => $i,
            ]);
        }

        return $exam;
    }

    public function test_exam_attempt_resumes_with_stable_order_and_has_no_correct_answers(): void
    {
        $env = $this->env();
        $exam = $this->openExam($env);
        $base = "/api/v1/courses/{$env['course']->id}/exams/{$exam->id}";

        $this->as($env, 'studentToken')->getJson("$base/active-attempt")->assertNotFound()->assertJsonPath('error.code', 'NO_ACTIVE_ATTEMPT');

        $start = $this->as($env, 'studentToken')->postJson("$base/start")->assertCreated();
        $start->assertJsonPath('data.max_violations', 5);

        $first = $this->as($env, 'studentToken')->getJson("$base/active-attempt")->assertOk();
        $second = $this->as($env, 'studentToken')->getJson("$base/active-attempt")->assertOk();
        $this->assertSame(array_column($first->json('data.questions'), 'id'), array_column($second->json('data.questions'), 'id'));
        $this->assertStringNotContainsString('correct_answer', json_encode($first->json()));

        // Teachers cannot "resume" an attempt that is not theirs.
        $this->as($env)->getJson("$base/active-attempt")->assertStatus(403);
    }

    public function test_integrity_events_are_counted_and_auto_submit_at_the_limit(): void
    {
        $env = $this->env();
        $exam = $this->openExam($env);
        $base = "/api/v1/courses/{$env['course']->id}/exams/{$exam->id}";

        $attemptId = $this->as($env, 'studentToken')->postJson("$base/start")->json('data.attempt.id');
        $url = "$base/attempts/$attemptId/integrity-events";

        $this->as($env, 'studentToken')->postJson($url, ['type' => 'made_up'])->assertStatus(422);

        // Blocked copy/paste attempts are logged for the teacher but do not count toward the limit.
        $this->as($env, 'studentToken')->postJson($url, ['type' => 'copy_attempt'])
            ->assertOk()->assertJsonPath('data.violation_count', 0);
        $this->as($env)->postJson($url, ['type' => 'tab_hidden'])->assertStatus(403);

        foreach (range(1, 4) as $n) {
            $this->as($env, 'studentToken')->postJson($url, ['type' => 'tab_hidden'])
                ->assertOk()->assertJsonPath('data.violation_count', $n)->assertJsonPath('data.auto_submitted', false);
        }
        $this->as($env, 'studentToken')->postJson($url, ['type' => 'fullscreen_exit'])
            ->assertOk()->assertJsonPath('data.auto_submitted', true);

        $attempt = ExamAttempt::find($attemptId);
        $this->assertSame('submitted', $attempt->status);
        $this->assertCount(6, $attempt->integrity_events);

        $this->as($env, 'studentToken')->postJson($url, ['type' => 'tab_hidden'])->assertStatus(422);
    }
}
