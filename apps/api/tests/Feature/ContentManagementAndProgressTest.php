<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\MediaAsset;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ContentManagementAndProgressTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected TenantUser $teacherAUser;

    protected Staff $teacherAStaff;

    protected string $teacherAToken;

    protected TenantUser $teacherBUser;

    protected Staff $teacherBStaff;

    protected string $teacherBToken;

    protected TenantUser $studentUser;

    protected Student $student;

    protected string $studentToken;

    protected function setUp(): void
    {
        parent::setUp();

        $slug = 'content-test-'.Str::random(6);
        $this->tenant = Tenant::create([
            'name' => 'Content Academy',
            'slug' => $slug,
            'status' => 'active',
            'modules' => ['online', 'billing'],
        ]);

        $dbPath = database_path("tenants/{$slug}.sqlite");
        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => 'tenant_'.$slug,
            'status' => 'ready',
        ]);

        TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => $slug.'.test.com',
            'is_primary' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        app(RoleSynchronizer::class)->sync();

        // 1. Teacher A
        $this->teacherAUser = TenantUser::create([
            'name' => 'Teacher Alpha',
            'email' => 'teacher.a@test.com',
            'password' => bcrypt('secret123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherRole = Role::where('name', 'teacher')->first();
        if ($teacherRole) {
            $this->teacherAUser->roles()->attach($teacherRole->id);
        }
        $this->teacherAStaff = Staff::create([
            'user_id' => $this->teacherAUser->id,
            'staff_type' => 'teacher',
        ]);
        $tokenDataA = TenantToken::createTokenFor($this->teacherAUser, 'api');
        $this->teacherAToken = $tokenDataA['plainTextToken'];

        // 2. Teacher B
        $this->teacherBUser = TenantUser::create([
            'name' => 'Teacher Beta',
            'email' => 'teacher.b@test.com',
            'password' => bcrypt('secret123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        if ($teacherRole) {
            $this->teacherBUser->roles()->attach($teacherRole->id);
        }
        $this->teacherBStaff = Staff::create([
            'user_id' => $this->teacherBUser->id,
            'staff_type' => 'teacher',
        ]);
        $tokenDataB = TenantToken::createTokenFor($this->teacherBUser, 'api');
        $this->teacherBToken = $tokenDataB['plainTextToken'];

        // 3. Student
        $this->studentUser = TenantUser::create([
            'name' => 'Student One',
            'email' => 'student.one@test.com',
            'password' => bcrypt('secret123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentRole = Role::where('name', 'student')->first();
        if ($studentRole) {
            $this->studentUser->roles()->attach($studentRole->id);
        }
        $this->student = Student::create([
            'user_id' => $this->studentUser->id,
            'student_code' => 'STU-9901',
        ]);
        $tokenDataS = TenantToken::createTokenFor($this->studentUser, 'api');
        $this->studentToken = $tokenDataS['plainTextToken'];
    }

    protected function tearDown(): void
    {
        $dbRecord = TenantDatabase::where('tenant_id', $this->tenant->id)->first();
        if ($dbRecord && file_exists($dbRecord->database_path)) {
            @unlink($dbRecord->database_path);
        }
        parent::tearDown();
    }

    public function test_teacher_can_create_course_and_modules_and_lessons(): void
    {
        // 1. Create Course
        $courseRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherAToken}",
        ])->postJson('/api/v1/courses', [
            'title' => 'Advanced Physics',
            'code' => 'PHYS-101',
            'description' => 'Comprehensive mechanics course',
            'level' => 'advanced',
            'status' => 'published',
            'is_free' => false,
        ]);

        $courseRes->assertSuccessful();
        $courseId = $courseRes->json('data.course.id');
        $this->assertNotNull($courseId);

        // 2. Create Module
        $moduleRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherAToken}",
        ])->postJson("/api/v1/courses/{$courseId}/modules", [
            'title' => 'Unit 1: Classical Mechanics',
            'description' => 'Newton laws and kinematics',
            'sort_order' => 1,
        ]);

        $moduleRes->assertStatus(201);
        $moduleId = $moduleRes->json('data.module.id');
        $this->assertNotNull($moduleId);

        // 3. Create Lessons
        $lessonRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherAToken}",
        ])->postJson("/api/v1/courses/{$courseId}/lessons", [
            'module_id' => $moduleId,
            'title' => 'Lesson 1.1: Velocity & Acceleration',
            'type' => 'video',
            'duration_seconds' => 600,
            'is_free_preview' => true,
        ]);

        $lessonRes->assertStatus(201);
        $this->assertEquals($moduleId, $lessonRes->json('data.lesson.module_id'));
        $this->assertTrue($lessonRes->json('data.lesson.is_free_preview'));
    }

    public function test_teacher_b_cannot_modify_teacher_a_course_or_lessons(): void
    {
        // Teacher A creates course
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Teacher A Course',
            'status' => 'published',
        ]);

        $module = $course->modules()->create([
            'title' => 'Unit A',
            'sort_order' => 1,
        ]);

        $lesson = $course->lessons()->create([
            'module_id' => $module->id,
            'title' => 'Lesson A',
            'type' => 'text',
        ]);

        // Teacher B tries to update Teacher A's course -> 403 Forbidden
        $updateCourseRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherBToken}",
        ])->putJson("/api/v1/courses/{$course->id}", [
            'title' => 'Hacked Course Title',
        ]);

        $updateCourseRes->assertStatus(403);

        // Teacher B tries to delete Teacher A's module -> 403 Forbidden
        $deleteModuleRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherBToken}",
        ])->deleteJson("/api/v1/modules/{$module->id}");

        $deleteModuleRes->assertStatus(403);

        // Teacher B tries to update Teacher A's lesson -> 403 Forbidden
        $updateLessonRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherBToken}",
        ])->putJson("/api/v1/lessons/{$lesson->id}", [
            'title' => 'Hacked Lesson Title',
        ]);

        $updateLessonRes->assertStatus(403);
    }

    public function test_outline_endpoint_returns_access_and_progress_for_student(): void
    {
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Calculus I',
            'status' => 'published',
            'is_free' => false,
        ]);

        $module = $course->modules()->create([
            'title' => 'Derivatives',
            'sort_order' => 1,
        ]);

        $lessonPreview = $course->lessons()->create([
            'module_id' => $module->id,
            'title' => 'Preview: Intro to Limits',
            'type' => 'video',
            'is_free_preview' => true,
            'duration_seconds' => 300,
            'sort_order' => 1,
        ]);

        $lessonPaid = $course->lessons()->create([
            'module_id' => $module->id,
            'title' => 'Paid: Chain Rule',
            'type' => 'video',
            'is_free_preview' => false,
            'duration_seconds' => 600,
            'sort_order' => 2,
        ]);

        // Student requests course outline
        $res = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->studentToken}",
        ])->getJson("/api/v1/courses/{$course->id}/outline");

        $res->assertStatus(200);
        $modules = $res->json('data.course.modules');
        $this->assertCount(1, $modules);
        $lessons = $modules[0]['lessons'];
        $this->assertCount(2, $lessons);

        // Preview lesson access is allowed
        $this->assertTrue($lessons[0]['access']['allowed']);

        // Paid lesson access is denied
        $this->assertFalse($lessons[1]['access']['allowed']);
        $this->assertEquals('not_enrolled', $lessons[1]['access']['reason']);
    }

    public function test_student_playback_events_aggregate_progress_and_complete(): void
    {
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Free Biology Course',
            'status' => 'published',
            'is_free' => true,
        ]);

        // Student self-enrolls into free course
        $this->student->enrollments()->create([
            'course_id' => $course->id,
            'status' => 'active',
        ]);

        $lesson = $course->lessons()->create([
            'title' => 'Cell Structure',
            'type' => 'video',
            'duration_seconds' => 100, // 100s for easy percentage verification
        ]);

        // 1. Submit event at 50s (50%)
        $eventRes1 = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->studentToken}",
        ])->postJson("/api/v1/lessons/{$lesson->id}/events", [
            'events' => [
                ['type' => 'start', 'position_seconds' => 0],
                ['type' => 'heartbeat', 'position_seconds' => 50],
            ],
        ]);

        $eventRes1->assertStatus(200);
        $this->assertEquals(50, $eventRes1->json('data.progress.percent'));
        $this->assertNull($eventRes1->json('data.progress.completed_at'));

        // 2. Submit event at 95s (95% -> triggers auto completion >= 90%)
        $eventRes2 = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->studentToken}",
        ])->postJson("/api/v1/lessons/{$lesson->id}/events", [
            'events' => [
                ['type' => 'heartbeat', 'position_seconds' => 95],
            ],
        ]);

        $eventRes2->assertStatus(200);
        $this->assertEquals(95, $eventRes2->json('data.progress.percent'));
        $this->assertNotNull($eventRes2->json('data.progress.completed_at'));
    }

    public function test_non_video_lesson_manual_completion(): void
    {
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Free Chemistry Course',
            'status' => 'published',
            'is_free' => true,
        ]);

        $this->student->enrollments()->create([
            'course_id' => $course->id,
            'status' => 'active',
        ]);

        $lesson = $course->lessons()->create([
            'title' => 'Periodic Table Reading Document',
            'type' => 'document',
        ]);

        $res = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->studentToken}",
        ])->postJson("/api/v1/lessons/{$lesson->id}/complete");

        $res->assertStatus(200);
        $this->assertEquals(100, $res->json('data.progress.percent'));
        $this->assertNotNull($res->json('data.progress.completed_at'));
    }

    public function test_reorder_modules_and_lessons(): void
    {
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Biology 101',
            'status' => 'published',
        ]);

        $mod1 = $course->modules()->create(['title' => 'Module 1', 'sort_order' => 1]);
        $mod2 = $course->modules()->create(['title' => 'Module 2', 'sort_order' => 2]);

        $les1 = $course->lessons()->create(['module_id' => $mod1->id, 'title' => 'L1', 'sort_order' => 1]);
        $les2 = $course->lessons()->create(['module_id' => $mod1->id, 'title' => 'L2', 'sort_order' => 2]);

        // Reorder modules
        $reorderModRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherAToken}",
        ])->postJson("/api/v1/courses/{$course->id}/modules/reorder", [
            'modules' => [
                ['id' => $mod1->id, 'sort_order' => 2],
                ['id' => $mod2->id, 'sort_order' => 1],
            ],
        ]);
        $reorderModRes->assertStatus(200);
        $this->assertEquals(2, $mod1->fresh()->sort_order);
        $this->assertEquals(1, $mod2->fresh()->sort_order);

        // Reorder lessons
        $reorderLesRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherAToken}",
        ])->postJson("/api/v1/modules/{$mod1->id}/lessons/reorder", [
            'lessons' => [
                ['id' => $les1->id, 'sort_order' => 5],
                ['id' => $les2->id, 'sort_order' => 3],
            ],
        ]);
        $reorderLesRes->assertStatus(200);
        $this->assertEquals(5, $les1->fresh()->sort_order);
        $this->assertEquals(3, $les2->fresh()->sort_order);
    }

    public function test_publish_and_unpublish_lesson(): void
    {
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Geometry',
            'status' => 'published',
        ]);

        $lesson = $course->lessons()->create([
            'title' => 'Angles',
            'status' => 'draft',
        ]);

        // Publish
        $pubRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherAToken}",
        ])->postJson("/api/v1/lessons/{$lesson->id}/publish");
        $pubRes->assertStatus(200);
        $this->assertEquals('published', $lesson->fresh()->status);
        $this->assertNotNull($lesson->fresh()->published_at);

        // Unpublish
        $unpubRes = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->teacherAToken}",
        ])->postJson("/api/v1/lessons/{$lesson->id}/unpublish");
        $unpubRes->assertStatus(200);
        $this->assertEquals('draft', $lesson->fresh()->status);
    }

    public function test_material_download_requires_access(): void
    {
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Paid Math Course',
            'status' => 'published',
            'is_free' => false,
        ]);

        $lesson = $course->lessons()->create([
            'title' => 'Secret Formulas',
            'is_free_preview' => false,
        ]);

        $material = $lesson->materials()->create([
            'title' => 'Formulas PDF',
            'kind' => 'link',
            'url' => 'https://example.com/formulas.pdf',
        ]);

        // Unpaid student attempts to download material -> 403 Forbidden
        $res = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->studentToken}",
        ])->getJson("/api/v1/materials/{$material->id}/download");

        $res->assertStatus(403);
        $res->assertJsonPath('error.code', 'ACCESS_REQUIRES_SUBSCRIPTION');
    }

    public function test_media_embed_enforces_access_policy(): void
    {
        $course = Course::create([
            'teacher_staff_id' => $this->teacherAStaff->id,
            'title' => 'Premium Video Course',
            'status' => 'published',
            'is_free' => false,
        ]);

        $lesson = $course->lessons()->create([
            'title' => 'Video Lecture 1',
            'is_free_preview' => false,
        ]);

        $media = MediaAsset::create([
            'title' => 'Lecture 1 HD',
            'provider' => 'mock',
            'external_media_id' => 'mock-vid-123',
            'course_id' => $course->id,
            'lesson_id' => $lesson->id,
            'status' => 'ready',
        ]);

        // Unpaid student tries to get embed url -> 403 Forbidden
        $res = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => "Bearer {$this->studentToken}",
        ])->getJson("/api/v1/media/{$media->id}/embed");

        $res->assertStatus(403);
        $res->assertJsonPath('error.code', 'ACCESS_REQUIRES_SUBSCRIPTION');
    }
}
