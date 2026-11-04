<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
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

class EducationGateTest extends TestCase
{
    use RefreshDatabase;

    protected string $tenantConnA;

    protected string $tenantConnB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConnA = 'test_edu_a_'.uniqid();
        $this->tenantConnB = 'test_edu_b_'.uniqid();
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'test_edu_*.sqlite') as $file) {
                if (file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    /**
     * Phase J §24 — Education Gate:
     * - teacher creates course
     * - teacher creates lesson
     * - student enrollment
     * - student sees authorized course
     * - student cannot see another tenant course
     * - assistant sees only permitted student data
     */
    public function test_education_gate_complete_lifecycle(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        // -------------------------------------------------------------
        // 1. Provision Tenant A (Al-Noor Academy)
        // -------------------------------------------------------------
        $tenantA = Tenant::create([
            'name' => 'Al-Noor Academy',
            'slug' => 'alnoor',
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
        $permCourseUpdate = Permission::create(['name' => 'courses.update', 'module' => 'education']);
        $permLessonCreate = Permission::create(['name' => 'lessons.create', 'module' => 'education']);
        $permEnrollCreate = Permission::create(['name' => 'enrollments.create', 'module' => 'education']);
        $permStudentView = Permission::create(['name' => 'students.view', 'module' => 'education']);

        // Roles in Tenant A
        $teacherRole = Role::create(['name' => 'teacher', 'label' => 'Teacher', 'is_system' => true]);
        $teacherRole->permissions()->attach([
            $permCourseCreate->id,
            $permCourseView->id,
            $permCourseUpdate->id,
            $permLessonCreate->id,
            $permEnrollCreate->id,
            $permStudentView->id,
        ]);

        $permittedAssistantRole = Role::create(['name' => 'assistant_lead', 'label' => 'Lead Assistant', 'is_system' => true]);
        $permittedAssistantRole->permissions()->attach([
            $permCourseView->id,
            $permStudentView->id,
        ]);

        $restrictedAssistantRole = Role::create(['name' => 'assistant_basic', 'label' => 'Basic Assistant', 'is_system' => true]);
        // Has no course/student view permissions

        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        // Users in Tenant A
        // A1: Teacher Tariq
        $teacherUser = TenantUser::create([
            'name' => 'Dr. Tariq',
            'email' => 'tariq@alnoor.edu',
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

        // A2: Permitted Assistant Mona
        $assistantMona = TenantUser::create([
            'name' => 'Assistant Mona',
            'email' => 'mona@alnoor.edu',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $assistantMona->roles()->attach($permittedAssistantRole->id);
        Staff::create([
            'user_id' => $assistantMona->id,
            'staff_type' => 'assistant',
            'status' => 'active',
        ]);
        $monaToken = TenantToken::createTokenFor($assistantMona)['plainTextToken'];

        // A3: Restricted Assistant Zaid
        $assistantZaid = TenantUser::create([
            'name' => 'Assistant Zaid',
            'email' => 'zaid@alnoor.edu',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $assistantZaid->roles()->attach($restrictedAssistantRole->id);
        Staff::create([
            'user_id' => $assistantZaid->id,
            'staff_type' => 'assistant',
            'status' => 'active',
        ]);
        $zaidToken = TenantToken::createTokenFor($assistantZaid)['plainTextToken'];

        // A4: Student Omar
        $studentOmar = TenantUser::create([
            'name' => 'Student Omar',
            'email' => 'omar@alnoor.edu',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentOmar->roles()->attach($studentRole->id);
        $studentOmarProfile = Student::create([
            'user_id' => $studentOmar->id,
            'student_code' => 'STU-ALN-001',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);
        $omarToken = TenantToken::createTokenFor($studentOmar)['plainTextToken'];

        // -------------------------------------------------------------
        // 2. Provision Tenant B (Al-Falah Institute)
        // -------------------------------------------------------------
        $tenantB = Tenant::create([
            'name' => 'Al-Falah Institute',
            'slug' => 'alfalah',
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
            'title' => 'Physics 101 - Mechanics',
            'code' => 'PHY-101',
            'description' => 'Tenant B Private Course',
            'status' => 'published',
        ]);

        // -------------------------------------------------------------
        // 3. EXECUTE GATE CHECKS
        // -------------------------------------------------------------

        // 1. Teacher creates course in Tenant A
        $createCourseResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson('/api/v1/courses', [
            'title' => 'Algebra 101',
            'code' => 'ALG-101',
            'description' => 'Introduction to Algebraic Expressions',
            'status' => 'published',
            'is_free' => true,
        ]);

        $createCourseResp->assertStatus(200)
            ->assertJsonPath('data.course.title', 'Algebra 101')
            ->assertJsonPath('data.course.code', 'ALG-101');

        $courseId = $createCourseResp->json('data.course.id');
        $this->assertNotEmpty($courseId);

        // 2. Teacher creates lesson
        $createLessonResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$teacherToken,
        ])->postJson("/api/v1/courses/{$courseId}/lessons", [
            'title' => 'Lesson 1: Linear Equations',
            'content' => 'Solving single variable linear equations.',
            'sort_order' => 1,
            'status' => 'published',
        ]);

        $createLessonResp->assertStatus(201)
            ->assertJsonPath('data.lesson.title', 'Lesson 1: Linear Equations')
            ->assertJsonPath('data.lesson.sort_order', 1);

        $lessonId = $createLessonResp->json('data.lesson.id');
        $this->assertNotEmpty($lessonId);

        // 3. Student enrollment
        $enrollResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$omarToken,
        ])->postJson("/api/v1/courses/{$courseId}/enroll");

        $enrollResp->assertStatus(201)
            ->assertJsonPath('data.enrollment.course_id', $courseId)
            ->assertJsonPath('data.enrollment.status', 'active');

        // 4. Student sees authorized course and lessons
        $studentViewCourseResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$omarToken,
        ])->getJson("/api/v1/courses/{$courseId}");

        $studentViewCourseResp->assertStatus(200)
            ->assertJsonPath('data.course.id', $courseId)
            ->assertJsonPath('data.course.title', 'Algebra 101');

        $studentViewLessonsResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$omarToken,
        ])->getJson("/api/v1/courses/{$courseId}/lessons");

        $studentViewLessonsResp->assertStatus(200)
            ->assertJsonCount(1, 'data.lessons')
            ->assertJsonPath('data.lessons.0.title', 'Lesson 1: Linear Equations');

        // 5. Student cannot see another tenant course (Cross-Tenant Isolation)
        // 5a. Querying Tenant B's course ID through Tenant A context -> 404 (Not Found in Tenant A DB)
        $crossTenantQueryResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$omarToken,
        ])->getJson("/api/v1/courses/{$courseB->id}");

        $crossTenantQueryResp->assertStatus(404);

        // 5b. Attempting to use Tenant A student token against Tenant B endpoint -> 401 UNAUTHENTICATED
        $crossTenantTokenResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alfalah',
            'Authorization' => 'Bearer '.$omarToken,
        ])->getJson("/api/v1/courses/{$courseB->id}");

        $crossTenantTokenResp->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');

        // 6. Assistant sees only permitted student data
        // 6a. Permitted Assistant (Mona with 'students.view') -> 200 OK
        $permittedAssistantResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$monaToken,
        ])->getJson("/api/v1/students/{$studentOmarProfile->id}");

        $permittedAssistantResp->assertStatus(200)
            ->assertJsonPath('data.student.id', $studentOmarProfile->id)
            ->assertJsonPath('data.student.student_code', 'STU-ALN-001');

        // 6b. Restricted Assistant (Zaid WITHOUT 'students.view') -> 403 FORBIDDEN
        $restrictedAssistantResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$zaidToken,
        ])->getJson("/api/v1/students/{$studentOmarProfile->id}");

        $restrictedAssistantResp->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        // 6c. Restricted Assistant cannot view student enrollments -> 403 FORBIDDEN
        $restrictedEnrollmentsResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnoor',
            'Authorization' => 'Bearer '.$zaidToken,
        ])->getJson("/api/v1/students/{$studentOmarProfile->id}/enrollments");

        $restrictedEnrollmentsResp->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }
}
