<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Entitlement;
use App\Models\Role;
use App\Models\Student;
use App\Models\StudentAnalyticsSnapshot;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Data is loaded in pages with a constant number of queries, so a slow or remote database does not turn lists into
 * N+1 storms: paged students with batched analytics, and course access decisions preloaded per list.
 */
class ProgressiveLoadingTest extends TestCase
{
    use RefreshDatabase;

    private function tenant(): array
    {
        $slug = 'pl-'.Str::lower(Str::random(6));
        $tenant = Tenant::create(['name' => 'Perf School', 'slug' => $slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => 'tenant_'.$slug, 'status' => 'ready']);

        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        $db->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);
        app(RoleSynchronizer::class)->sync();

        $user = function (string $role, string $type) use ($slug) {
            $u = TenantUser::create(['name' => $role, 'email' => "$role@$slug.test", 'password' => Hash::make('secret123'), 'type' => $type, 'status' => 'active']);
            $u->roles()->attach(Role::where('name', $role)->firstOrFail()->id);

            return $u;
        };

        $admin = $user('center_admin', 'staff');
        $studentUser = $user('student', 'student');
        $studentProfile = Student::create(['user_id' => $studentUser->id, 'student_code' => 'S-ME', 'status' => 'active']);

        return [
            'slug' => $slug,
            'adminToken' => TenantToken::createTokenFor($admin)['plainTextToken'],
            'studentToken' => TenantToken::createTokenFor($studentUser)['plainTextToken'],
            'me' => $studentProfile,
        ];
    }

    private function as(array $env, string $token)
    {
        return $this->withHeaders(['X-Tenant-Slug' => $env['slug'], 'Authorization' => 'Bearer '.$env[$token]]);
    }

    private function seedStudents(int $count): void
    {
        foreach (range(1, $count) as $i) {
            $u = TenantUser::create(['name' => "طالب $i", 'email' => "s$i@x.test", 'password' => Hash::make('secret123'), 'type' => 'student', 'status' => 'active']);
            $s = Student::create(['user_id' => $u->id, 'student_code' => sprintf('STU-%03d', $i), 'status' => 'active']);
            StudentAnalyticsSnapshot::create(['student_id' => $s->id, 'course_id' => null, 'attendance_rate' => 80 + $i, 'overall_score' => 70 + $i]);
        }
    }

    public function test_students_list_is_paged_with_analytics_batched_in_one_query(): void
    {
        $env = $this->tenant();
        $this->seedStudents(25);

        $snapshotQueries = 0;
        DB::connection('tenant')->listen(function ($q) use (&$snapshotQueries) {
            if (str_contains($q->sql, 'student_analytics_snapshots') && str_starts_with(strtolower($q->sql), 'select')) {
                $snapshotQueries++;
            }
        });

        $page1 = $this->as($env, 'adminToken')->getJson('/api/v1/students?page=1&per_page=10&include=analytics')->assertOk();
        $page1->assertJsonCount(10, 'data.students')
            ->assertJsonPath('meta.pagination.total', 26) // 25 + the logged-in student
            ->assertJsonPath('meta.pagination.last_page', 3)
            ->assertJsonPath('meta.pagination.per_page', 10);
        $this->assertSame(1, $snapshotQueries, 'one snapshot query for the whole page, not one per student');
        $this->assertNotNull($page1->json('data.students.0.analytics') ?? $page1->json('data.students.1.analytics'), 'snapshots are attached');
        $this->assertArrayNotHasKey('national_id', $page1->json('data.students.0'));

        // Pages do not overlap and cover everything.
        $ids = collect();
        foreach ([1, 2, 3] as $n) {
            $rows = $this->as($env, 'adminToken')->getJson('/api/v1/students?page='.$n.'&per_page=10')->json('data.students');
            $ids = $ids->merge(collect($rows)->pluck('id'));
        }
        $this->assertCount(26, $ids->unique());

        // per_page is capped at 100.
        $this->as($env, 'adminToken')->getJson('/api/v1/students?per_page=1000')->assertOk()->assertJsonPath('meta.pagination.per_page', 100);
    }

    public function test_students_list_without_paging_params_is_unchanged_and_analytics_is_opt_in(): void
    {
        $env = $this->tenant();
        $this->seedStudents(5);

        $all = $this->as($env, 'adminToken')->getJson('/api/v1/students')->assertOk();
        $all->assertJsonCount(6, 'data.students');
        $this->assertNull($all->json('meta.pagination'));
        $this->assertArrayNotHasKey('analytics', $all->json('data.students.0'));

        // Search is applied on the server before paging.
        $this->as($env, 'adminToken')->getJson('/api/v1/students?page=1&per_page=10&search=STU-003')->assertOk()
            ->assertJsonCount(1, 'data.students')->assertJsonPath('meta.pagination.total', 1);
    }

    public function test_a_student_only_ever_sees_their_own_row_and_analytics(): void
    {
        $env = $this->tenant();
        $this->seedStudents(3);
        StudentAnalyticsSnapshot::create(['student_id' => $env['me']->id, 'course_id' => null, 'attendance_rate' => 91, 'overall_score' => 88]);

        $resp = $this->as($env, 'studentToken')->getJson('/api/v1/students?page=1&per_page=20&include=analytics')->assertOk();

        $resp->assertJsonCount(1, 'data.students')->assertJsonPath('data.students.0.id', $env['me']->id);
        $this->assertEquals(88, $resp->json('data.students.0.analytics.overall_score'));
    }

    public function test_course_list_access_decisions_use_a_constant_number_of_queries(): void
    {
        $env = $this->tenant();
        // Warm-up: the first request of a token also records `last_used_at` (throttled afterwards).
        $this->as($env, 'studentToken')->getJson('/api/v1/courses')->assertOk();
        $queries = fn () => $this->countQueries(fn () => $this->as($env, 'studentToken')->getJson('/api/v1/courses')->assertOk());

        foreach (range(1, 3) as $i) {
            $c = Course::create(['title' => "Course $i", 'status' => 'published', 'is_free' => $i === 1]);
            Enrollment::create(['student_id' => $env['me']->id, 'course_id' => $c->id, 'status' => 'active', 'mode' => 'online']);
        }
        $few = $queries();

        foreach (range(4, 12) as $i) {
            $c = Course::create(['title' => "Course $i", 'status' => 'published', 'is_free' => false]);
            Enrollment::create(['student_id' => $env['me']->id, 'course_id' => $c->id, 'status' => 'active', 'mode' => 'online']);
        }
        Entitlement::create(['student_id' => $env['me']->id, 'entitlement_key' => 'all_courses', 'status' => 'active', 'starts_at' => now()->subDay(), 'expires_at' => now()->addMonth()]);
        $many = $queries();

        $this->assertSame($few, $many, "12 courses must cost the same number of queries as 3 (got $few vs $many)");

        $resp = $this->as($env, 'studentToken')->getJson('/api/v1/courses')->assertOk();
        $this->assertCount(12, $resp->json('data.courses'));
        $this->assertTrue(collect($resp->json('data.courses'))->every(fn ($c) => isset($c['access']['allowed']) || isset($c['access'])));
    }

    private function countQueries(callable $fn): int
    {
        $n = 0;
        $listener = function () use (&$n) { $n++; };
        DB::connection('tenant')->listen($listener);
        DB::listen($listener);
        $fn();

        return $n;
    }
}
