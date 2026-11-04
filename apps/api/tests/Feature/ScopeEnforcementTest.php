<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Support\Authorization\ScopeResolver;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * ScopeEnforcementTest (R1-A4)
 *
 * Verifies that resource-level scope enforcement (self, linked, own, assigned, branch, tenant)
 * is strictly respected across all personas and roles.
 */
class ScopeEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'scope_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'Scope Test Academy',
            'slug' => 'scope-academy',
            'type' => 'school',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => $this->tenantConn,
            'status' => 'ready',
        ]);

        TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => 'scope-academy.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        // Sync standard catalog system roles
        app(RoleSynchronizer::class)->sync();
    }

    private function createUserWithRole(string $email, string $type, string $role): TenantUser
    {
        $user = TenantUser::create(['name' => $email, 'email' => $email, 'password' => Hash::make('secret'), 'type' => $type, 'status' => 'active']);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);

        return $user;
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'scope_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    /** @test */
    public function test_teacher_a_cannot_access_or_modify_teacher_b_course(): void
    {
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();

        // Teacher A
        $userA = TenantUser::create([
            'name' => 'Teacher A',
            'email' => 'teacher-a@scope.local',
            'password' => Hash::make('secret'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $userA->roles()->attach($teacherRole->id);
        $staffA = Staff::create(['user_id' => $userA->id, 'staff_type' => 'teacher', 'status' => 'active']);

        // Teacher B
        $userB = TenantUser::create([
            'name' => 'Teacher B',
            'email' => 'teacher-b@scope.local',
            'password' => Hash::make('secret'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $userB->roles()->attach($teacherRole->id);
        $staffB = Staff::create(['user_id' => $userB->id, 'staff_type' => 'teacher', 'status' => 'active']);

        // Course A belongs to Teacher A; Course B belongs to Teacher B
        $courseA = Course::create([
            'teacher_staff_id' => $staffA->id,
            'title' => 'Math by Teacher A',
            'code' => 'MATH-A',
            'status' => 'active',
        ]);

        $courseB = Course::create([
            'teacher_staff_id' => $staffB->id,
            'title' => 'Physics by Teacher B',
            'code' => 'PHYS-B',
            'status' => 'active',
        ]);

        // Teacher A query scope should ONLY return Course A
        $scopedCoursesA = ScopeResolver::scopeCourses(Course::query(), $userA, 'courses.view')->get();
        $this->assertTrue($scopedCoursesA->contains('id', $courseA->id));
        $this->assertFalse($scopedCoursesA->contains('id', $courseB->id));

        // canAccess checks
        $this->assertTrue(ScopeResolver::canAccess($userA, 'courses.update', $courseA));
        $this->assertFalse(ScopeResolver::canAccess($userA, 'courses.update', $courseB));
    }

    /** @test */
    public function test_assistant_sees_only_assigned_class_students(): void
    {
        $assistantRole = Role::where('name', 'assistant')->firstOrFail();

        $userAssistant = TenantUser::create([
            'name' => 'Assistant Mona',
            'email' => 'assistant@scope.local',
            'password' => Hash::make('secret'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $userAssistant->roles()->attach($assistantRole->id);
        $staffAssistant = Staff::create(['user_id' => $userAssistant->id, 'staff_type' => 'assistant', 'status' => 'active']);

        // Create 2 classes
        $classA = SchoolClass::create(['name' => 'Class Alpha', 'code' => 'CLS-A', 'status' => 'active']);
        $classB = SchoolClass::create(['name' => 'Class Beta', 'code' => 'CLS-B', 'status' => 'active']);

        // Student in Class A
        $userStuA = TenantUser::create(['name' => 'Student A', 'email' => 'stua@scope.local', 'password' => 'secret', 'type' => 'student', 'status' => 'active']);
        $studentA = Student::create(['user_id' => $userStuA->id, 'student_code' => 'STU-001', 'status' => 'active']);
        $classA->students()->attach($studentA->id, ['id' => (string) Str::uuid(), 'status' => 'active', 'enrolled_at' => now()]);

        // Student in Class B
        $userStuB = TenantUser::create(['name' => 'Student B', 'email' => 'stub@scope.local', 'password' => 'secret', 'type' => 'student', 'status' => 'active']);
        $studentB = Student::create(['user_id' => $userStuB->id, 'student_code' => 'STU-002', 'status' => 'active']);
        $classB->students()->attach($studentB->id, ['id' => (string) Str::uuid(), 'status' => 'active', 'enrolled_at' => now()]);

        // Assign Assistant ONLY to Class A
        StaffAssignment::create([
            'staff_id' => $staffAssistant->id,
            'assignable_type' => 'class',
            'assignable_id' => $classA->id,
            'role_context' => 'assistant',
        ]);

        $scopedStudents = ScopeResolver::scopeStudents(Student::query(), $userAssistant, 'students.view')->get();

        $this->assertTrue($scopedStudents->contains('id', $studentA->id));
        $this->assertFalse($scopedStudents->contains('id', $studentB->id));
    }

    /** @test */
    public function test_students_never_receive_unpublished_grades(): void
    {
        $studentUser = $this->createUserWithRole('graded@scope.test', 'student', 'student');
        $student = Student::create(['user_id' => $studentUser->id, 'student_code' => 'GRADED', 'status' => 'active']);

        $published = Grade::create(['student_id' => $student->id, 'gradable_type' => 'assignment', 'gradable_id' => (string) Str::uuid(), 'score' => 90, 'max_score' => 100, 'percentage' => 90, 'is_published' => true, 'graded_at' => now()]);
        Grade::create(['student_id' => $student->id, 'gradable_type' => 'assignment', 'gradable_id' => (string) Str::uuid(), 'score' => 40, 'max_score' => 100, 'percentage' => 40, 'is_published' => false, 'graded_at' => now()]);

        $res = $this->getJson("/api/v1/students/{$student->id}/grades", [
            'X-Tenant-Slug' => 'scope-academy',
            'Authorization' => 'Bearer '.TenantToken::createTokenFor($studentUser)['plainTextToken'],
        ])->assertOk();

        $this->assertSame([$published->id], array_column($res->json('data.grades'), 'id'));
    }

    public function test_teacher_student_endpoints_stop_at_their_own_students(): void
    {
        $teacherUser = $this->createUserWithRole('teacher@scope.test', 'staff', 'teacher');
        $staff = Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $course = Course::create(['code' => 'OWN-1', 'teacher_staff_id' => $staff->id, 'title' => 'مقرري', 'status' => 'published']);

        $mine = Student::create(['user_id' => $this->createUserWithRole('mine@scope.test', 'student', 'student')->id, 'student_code' => 'MINE', 'status' => 'active']);
        Enrollment::create(['student_id' => $mine->id, 'course_id' => $course->id, 'status' => 'active', 'enrolled_at' => now()]);
        $other = Student::create(['user_id' => $this->createUserWithRole('other@scope.test', 'student', 'student')->id, 'student_code' => 'OTHER', 'status' => 'active']);

        $headers = [
            'X-Tenant-Slug' => 'scope-academy',
            'Authorization' => 'Bearer '.TenantToken::createTokenFor($teacherUser)['plainTextToken'],
        ];

        $list = $this->getJson('/api/v1/students', $headers)->assertOk();
        $this->assertSame([$mine->id], array_column($list->json('data.students'), 'id'));

        $this->getJson("/api/v1/students/{$mine->id}", $headers)->assertOk();
        $this->getJson("/api/v1/students/{$other->id}", $headers)->assertForbidden();
        $this->getJson("/api/v1/students/{$other->id}/enrollments", $headers)->assertForbidden();
    }

    public function test_parent_can_access_own_child_dashboard_and_not_other_children(): void
    {
        $parentRole = Role::where('name', 'parent')->firstOrFail();

        // Parent User
        $parentUser = TenantUser::create([
            'name' => 'Parent Abu Omar',
            'email' => 'parent@scope.local',
            'password' => Hash::make('secret'),
            'type' => 'parent',
            'status' => 'active',
        ]);
        $parentUser->roles()->attach($parentRole->id);
        $parentProfile = ParentProfile::create(['user_id' => $parentUser->id, 'status' => 'active']);

        // Child
        $childUser = TenantUser::create(['name' => 'Omar Child', 'email' => 'child@scope.local', 'password' => 'secret', 'type' => 'student', 'status' => 'active']);
        $childStudent = Student::create(['user_id' => $childUser->id, 'student_code' => 'STU-CHILD', 'status' => 'active']);
        $parentProfile->students()->attach($childStudent->id, ['relation_type' => 'father']);

        // Other Student
        $otherUser = TenantUser::create(['name' => 'Other Kid', 'email' => 'other@scope.local', 'password' => 'secret', 'type' => 'student', 'status' => 'active']);
        $otherStudent = Student::create(['user_id' => $otherUser->id, 'student_code' => 'STU-OTHER', 'status' => 'active']);

        $tokenData = TenantToken::createTokenFor($parentUser, 'parent_token');

        // Parent accessing own child dashboard → 200 (Fixes T-RBAC-08)
        $responseChild = $this->withHeaders([
            'X-Tenant-Slug' => 'scope-academy',
            'Authorization' => "Bearer {$tokenData['plainTextToken']}",
        ])->getJson("/api/v1/students/{$childStudent->id}/dashboard");

        $responseChild->assertStatus(200)
            ->assertJsonPath('data.student_id', $childStudent->id);

        // Parent accessing other student dashboard → 403 Forbidden
        $responseOther = $this->withHeaders([
            'X-Tenant-Slug' => 'scope-academy',
            'Authorization' => "Bearer {$tokenData['plainTextToken']}",
        ])->getJson("/api/v1/students/{$otherStudent->id}/dashboard");

        $responseOther->assertStatus(403);
    }
}
