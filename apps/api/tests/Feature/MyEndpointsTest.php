<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\SchoolClass;
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
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * MyEndpointsTest (R1-A8)
 *
 * Verifies scoped "My" resource endpoints:
 *  - /me/children (Parent)
 *  - /me/courses  (Student / Staff)
 *  - /me/classes  (Student / Staff / Parent)
 *  - /me/students (Staff)
 *  - /me/sessions (with date filtering)
 */
class MyEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'my_endpoints_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'My Endpoints Academy',
            'slug' => 'my-academy',
            'type' => 'school',
            'status' => 'active',
            'auth_mode' => 'hybrid',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => $this->tenantConn,
            'status' => 'ready',
        ]);

        TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => 'my-academy.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        // Sync standard catalog system roles
        app(RoleSynchronizer::class)->sync();
    }

    protected function tearDown(): void
    {
        $this->cleanupTenantDb();
        parent::tearDown();
    }

    protected function cleanupTenantDb(): void
    {
        app(TenantDatabaseManager::class)->purgeConnection();
        $dir = database_path('tenants');
        if (is_dir($dir)) {
            foreach (glob($dir.DIRECTORY_SEPARATOR.'my_endpoints_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_parent_can_get_linked_children_and_non_parent_is_forbidden(): void
    {
        // 1. Create Parent
        $parentUser = TenantUser::create([
            'name' => 'Parent Hany',
            'email' => 'parent@my-academy.test',
            'password' => Hash::make('secret'),
            'type' => 'parent',
            'status' => 'active',
        ]);
        $parentRole = Role::where('name', 'parent')->firstOrFail();
        $parentUser->roles()->attach($parentRole->id);
        $parentProfile = ParentProfile::create(['user_id' => $parentUser->id, 'status' => 'active']);

        // 2. Create Child Student
        $childUser = TenantUser::create([
            'name' => 'Child Layla',
            'email' => 'layla@my-academy.test',
            'password' => Hash::make('secret'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentRole = Role::where('name', 'student')->firstOrFail();
        $childUser->roles()->attach($studentRole->id);
        $child = Student::create([
            'user_id' => $childUser->id,
            'student_code' => 'STU-LAYLA-01',
            'grade_level' => 'Grade 8',
            'status' => 'active',
        ]);

        $child->parents()->attach($parentProfile->id, ['relation_type' => 'mother']);

        $tokenResult = TenantToken::createTokenFor($parentUser);

        // Request /me/children as parent
        $response = $this->withHeaders([
            'X-Tenant' => 'my-academy',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/me/children');

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('STU-LAYLA-01', $data[0]['student_code']);
        $this->assertEquals('mother', $data[0]['relation']);

        // Request /me/children as student -> forbidden
        $childToken = TenantToken::createTokenFor($childUser);
        $forbiddenResponse = $this->withHeaders([
            'X-Tenant' => 'my-academy',
            'Authorization' => 'Bearer '.$childToken['plainTextToken'],
        ])->getJson('/api/v1/me/children');

        $forbiddenResponse->assertStatus(403);
    }

    public function test_teacher_my_courses_and_students(): void
    {
        $teacherUser = TenantUser::create([
            'name' => 'Teacher Tarek',
            'email' => 'tarek@my-academy.test',
            'password' => Hash::make('secret'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $teacherUser->roles()->attach($teacherRole->id);
        $staff = Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);

        // Course belonging to Teacher
        $course = Course::create([
            'teacher_staff_id' => $staff->id,
            'title' => 'Physics 101',
            'code' => 'PHY-101',
            'status' => 'published',
        ]);

        // Student enrolled in this course
        $studentUser = TenantUser::create([
            'name' => 'Student Karim',
            'email' => 'karim@my-academy.test',
            'password' => Hash::make('secret'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentRole = Role::where('name', 'student')->firstOrFail();
        $studentUser->roles()->attach($studentRole->id);
        $student = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-KARIM-01',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);

        Enrollment::create([
            'course_id' => $course->id,
            'student_id' => $student->id,
            'status' => 'active',
            'enrolled_at' => now(),
        ]);

        $tokenResult = TenantToken::createTokenFor($teacherUser);

        // GET /me/courses
        $coursesResponse = $this->withHeaders([
            'X-Tenant' => 'my-academy',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/me/courses');

        $coursesResponse->assertStatus(200);
        $this->assertCount(1, $coursesResponse->json('data'));
        $this->assertEquals('PHY-101', $coursesResponse->json('data.0.code'));

        // GET /me/students
        $studentsResponse = $this->withHeaders([
            'X-Tenant' => 'my-academy',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/me/students');

        $studentsResponse->assertStatus(200);
        $this->assertCount(1, $studentsResponse->json('data'));
        $this->assertEquals('STU-KARIM-01', $studentsResponse->json('data.0.student_code'));
    }

    public function test_sessions_endpoint_filters_by_date(): void
    {
        $teacherUser = TenantUser::create([
            'name' => 'Teacher Samy',
            'email' => 'samy@my-academy.test',
            'password' => Hash::make('secret'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $teacherUser->roles()->attach($teacherRole->id);
        $staff = Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);

        $class = SchoolClass::create([
            'teacher_staff_id' => $staff->id,
            'name' => 'Science 8A',
            'code' => 'SCI-8A',
            'status' => 'active',
        ]);

        // Session 1: Yesterday
        ClassSession::create([
            'class_id' => $class->id,
            'title' => 'Session 1',
            'starts_at' => now()->subDays(1)->setTime(10, 0),
            'ends_at' => now()->subDays(1)->setTime(11, 0),
            'attendance_mode' => 'manual',
            'status' => 'completed',
        ]);

        // Session 2: Tomorrow
        ClassSession::create([
            'class_id' => $class->id,
            'title' => 'Session 2',
            'starts_at' => now()->addDays(1)->setTime(10, 0),
            'ends_at' => now()->addDays(1)->setTime(11, 0),
            'attendance_mode' => 'manual',
            'status' => 'scheduled',
        ]);

        $tokenResult = TenantToken::createTokenFor($teacherUser);

        // 1. Without date filters -> returns both sessions
        $allSessionsResponse = $this->withHeaders([
            'X-Tenant' => 'my-academy',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/me/sessions');

        $allSessionsResponse->assertStatus(200);
        $this->assertCount(2, $allSessionsResponse->json('data'));

        // 2. With `from` filter starting from today -> returns only Session 2
        $filteredResponse = $this->withHeaders([
            'X-Tenant' => 'my-academy',
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/me/sessions?from='.now()->startOfDay()->toIso8601String());

        $filteredResponse->assertStatus(200);
        $this->assertCount(1, $filteredResponse->json('data'));
        $this->assertEquals('Session 2', $filteredResponse->json('data.0.title'));
    }
}
