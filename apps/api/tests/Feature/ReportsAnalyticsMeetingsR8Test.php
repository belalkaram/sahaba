<?php

namespace Tests\Feature;

use App\Domain\Analytics\Services\AnalyticsCalculationService;
use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Jobs\GenerateReport;
use App\Models\AttendanceRecord;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Meeting;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\Student;
use App\Models\StudentAnalyticsSnapshot;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantMetricSnapshot;
use App\Models\TenantSetting;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * R8-4 analytics honesty, R8-5 reports (async, scoped), R8-6 meeting access, R8-7 metrics.
 */
class ReportsAnalyticsMeetingsR8Test extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $conn;

    protected TenantUser $owner;

    protected TenantUser $studentUser;

    protected Student $student;

    protected TenantUser $otherStudentUser;

    protected Student $otherStudent;

    protected TenantUser $parentUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->conn = 'r8_test_'.uniqid();

        $this->tenant = Tenant::create(['name' => 'R8 Academy', 'slug' => 'r8-'.uniqid(), 'type' => 'school', 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $this->tenant->id, 'connection_identifier' => $this->conn, 'status' => 'ready']);
        TenantDomain::create(['tenant_id' => $this->tenant->id, 'domain' => $this->tenant->slug.'.localhost', 'active' => true]);

        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($this->tenant);
        $db->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        foreach (array_keys(config('authorization.modules')) as $module) {
            $this->tenant->features()->create(['feature_key' => $module, 'enabled' => true]);
        }

        app(RoleSynchronizer::class)->sync();

        $this->owner = $this->makeUser('owner@test.com', 'staff', 'owner');
        Staff::create(['user_id' => $this->owner->id, 'staff_type' => 'admin', 'status' => 'active']);

        [$this->studentUser, $this->student] = $this->makeStudent('a');
        [$this->otherStudentUser, $this->otherStudent] = $this->makeStudent('b');

        $this->parentUser = $this->makeUser('parent@test.com', 'parent', 'parent');
        ParentProfile::create(['user_id' => $this->parentUser->id, 'status' => 'active'])
            ->students()->attach($this->student->id, ['relation_type' => 'father']);
    }

    protected function tearDown(): void
    {
        // Windows cannot delete the file while the connection is open.
        DB::purge('tenant');
        $path = database_path("tenants/{$this->conn}.sqlite");
        if (file_exists($path)) {
            @unlink($path);
        }
        parent::tearDown();
    }

    private function makeUser(string $email, string $type, string $role): TenantUser
    {
        $user = TenantUser::create([
            'name' => "User {$email}",
            'email' => $email,
            'phone' => '+2010'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'type' => $type,
            'status' => 'active',
        ]);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);

        return $user;
    }

    /** @return array{0: TenantUser, 1: Student} */
    private function makeStudent(string $suffix): array
    {
        $user = $this->makeUser("student{$suffix}@test.com", 'student', 'student');

        return [$user, Student::create(['user_id' => $user->id, 'student_code' => "STD-{$suffix}", 'status' => 'active'])];
    }

    private function headers(TenantUser $user): array
    {
        return [
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => 'Bearer '.TenantToken::createTokenFor($user)['plainTextToken'],
        ];
    }

    // ---- R8-4 ----------------------------------------------------------

    public function test_dashboard_says_not_computed_instead_of_inventing_100_percent(): void
    {
        $this->getJson("/api/v1/students/{$this->student->id}/dashboard", $this->headers($this->studentUser))
            ->assertOk()
            ->assertJsonPath('data.status', 'not_computed')
            ->assertJsonPath('data.dashboard', null);
    }

    public function test_metrics_without_data_are_null_and_overall_uses_only_available_metrics(): void
    {
        $snapshot = app(AnalyticsCalculationService::class)->computeStudentSnapshot($this->student);

        $this->assertNull($snapshot->attendance_rate);
        $this->assertNull($snapshot->assignment_completion_rate);
        $this->assertNull($snapshot->exam_average);
        $this->assertNull($snapshot->overall_score);

        $class = SchoolClass::create(['name' => 'شعبة', 'status' => 'active']);
        $session = ClassSession::create(['class_id' => $class->id, 'title' => 'حصة', 'status' => 'completed']);
        AttendanceRecord::create(['session_id' => $session->id, 'student_id' => $this->student->id, 'status' => 'present', 'mode' => 'manual']);

        $snapshot = app(AnalyticsCalculationService::class)->computeStudentSnapshot($this->student);
        $this->assertEquals(100.0, $snapshot->attendance_rate);
        $this->assertEquals(100.0, $snapshot->overall_score);
        $this->assertNotNull($snapshot->last_activity_at);
    }

    public function test_at_risk_uses_tenant_thresholds_and_never_flags_uncomputed_students(): void
    {
        StudentAnalyticsSnapshot::create(['student_id' => $this->student->id, 'course_id' => null, 'attendance_rate' => 50, 'overall_score' => 90]);
        StudentAnalyticsSnapshot::create(['student_id' => $this->otherStudent->id, 'course_id' => null]);

        $headers = $this->headers($this->owner);
        $list = $this->getJson('/api/v1/analytics/at-risk', $headers)->assertOk()->json('data.students');
        $this->assertSame([$this->student->id], array_column($list, 'student_id'));

        TenantSetting::setValue(TenantSetting::AT_RISK_ATTENDANCE_BELOW, 40);
        $this->assertSame([], $this->getJson('/api/v1/analytics/at-risk', $headers)->assertOk()->json('data.students'));

        // Scope: another student sees nothing, a parent has no analytics permission path here.
        TenantSetting::setValue(TenantSetting::AT_RISK_ATTENDANCE_BELOW, 75);
        $this->assertSame([], $this->getJson('/api/v1/analytics/at-risk', $this->headers($this->otherStudentUser))->assertOk()->json('data.students'));
    }

    public function test_academic_settings_require_permission(): void
    {
        $this->putJson('/api/v1/tenant/academic-settings', ['notify_parents_on_absence' => false], $this->headers($this->owner))
            ->assertOk()
            ->assertJsonPath('data.notify_parents_on_absence', false);

        $this->putJson('/api/v1/tenant/academic-settings', ['notify_parents_on_absence' => true], $this->headers($this->studentUser))
            ->assertForbidden();
    }

    // ---- R8-5 ----------------------------------------------------------

    public function test_report_is_queued_not_generated_during_the_request(): void
    {
        Queue::fake();

        $res = $this->postJson('/api/v1/reports', [
            'title' => 'تقرير',
            'type' => 'student',
            'format' => 'csv',
            'parameters' => ['student_id' => $this->student->id],
        ], $this->headers($this->owner))->assertCreated();

        $this->assertSame('queued', $res->json('data.report.status'));
        Queue::assertPushed(GenerateReport::class);
    }

    public function test_csv_report_is_downloadable_only_by_authorized_users(): void
    {
        Storage::fake('local');

        $id = $this->postJson('/api/v1/reports', [
            'title' => 'حضور',
            'type' => 'student',
            'format' => 'csv',
            'parameters' => ['student_id' => $this->student->id],
        ], $this->headers($this->owner))->assertCreated()->json('data.report.id');

        $this->assertSame('completed', $this->getJson("/api/v1/reports/{$id}", $this->headers($this->owner))->json('data.report.status'));

        $this->get("/api/v1/reports/{$id}/file", $this->headers($this->owner))->assertOk();
        $this->getJson("/api/v1/reports/{$id}/file", $this->headers($this->otherStudentUser))->assertForbidden();
        $this->getJson("/api/v1/reports/{$id}", $this->headers($this->otherStudentUser))->assertForbidden();
    }

    public function test_parent_can_report_on_own_child_only(): void
    {
        $headers = $this->headers($this->parentUser);

        $this->postJson('/api/v1/reports', [
            'title' => 'تقرير ابني',
            'type' => 'parent',
            'format' => 'json',
            'parameters' => ['student_id' => $this->student->id],
        ], $headers)->assertCreated();

        $this->postJson('/api/v1/reports', [
            'title' => 'طالب آخر',
            'type' => 'parent',
            'format' => 'json',
            'parameters' => ['student_id' => $this->otherStudent->id],
        ], $headers)->assertForbidden();
    }

    public function test_student_cannot_generate_payments_report_and_pdf_is_explicitly_unavailable(): void
    {
        $this->postJson('/api/v1/reports', ['title' => 'مدفوعات', 'type' => 'payments', 'format' => 'csv'], $this->headers($this->studentUser))
            ->assertForbidden();

        $this->postJson('/api/v1/reports', ['title' => 'مدفوعات', 'type' => 'payments', 'format' => 'pdf'], $this->headers($this->owner))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'REPORT_FORMAT_UNAVAILABLE');
    }

    public function test_csv_neutralizes_formula_injection(): void
    {
        Storage::fake('local');
        $this->studentUser->update(['name' => '=HYPERLINK("http://evil")']);
        $class = SchoolClass::create(['name' => 'شعبة', 'status' => 'active']);
        $class->students()->attach($this->student->id, ['id' => (string) Str::uuid()]);

        $id = $this->postJson('/api/v1/reports', [
            'title' => 'حضور',
            'type' => 'class_attendance',
            'format' => 'csv',
            'parameters' => ['class_id' => $class->id],
        ], $this->headers($this->owner))->assertCreated()->json('data.report.id');

        $path = $this->getJson("/api/v1/reports/{$id}", $this->headers($this->owner))->json('data.report.file_path');
        $this->assertStringContainsString("'=HYPERLINK", Storage::disk('local')->get($path));
    }

    // ---- R8-6 ----------------------------------------------------------

    public function test_manual_link_is_labelled_and_invalid_links_are_rejected(): void
    {
        $headers = $this->headers($this->owner);

        $this->postJson('/api/v1/meetings', ['title' => 'بدون رابط'], $headers)
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MEETING_LINK_REQUIRED');

        $this->postJson('/api/v1/meetings', ['title' => 'رابط خطر', 'meet_url' => 'javascript:alert(1)'], $headers)
            ->assertStatus(502);

        $this->postJson('/api/v1/meetings', ['title' => 'حصة', 'meet_url' => 'https://meet.google.com/abc-defg-hij'], $headers)
            ->assertCreated()
            ->assertJsonPath('data.meeting.provider', 'manual')
            ->assertJsonPath('data.meeting.join_url', 'https://meet.google.com/abc-defg-hij');
    }

    public function test_students_never_receive_links_from_the_list_and_join_is_enforced(): void
    {
        $course = Course::create(['title' => 'مقرر', 'status' => 'published', 'is_free' => true]);
        Enrollment::create(['student_id' => $this->student->id, 'course_id' => $course->id, 'status' => 'active', 'enrolled_at' => now()]);

        $make = fn (array $extra = []) => Meeting::create([
            'title' => 'حصة',
            'provider' => 'manual',
            'external_meeting_id' => 'manual-'.uniqid(),
            'join_url' => 'https://meet.google.com/abc-defg-hij',
            'host_url' => 'https://meet.google.com/abc-defg-hij',
            'status' => 'scheduled',
            'course_id' => $course->id,
            'start_time' => now(),
            'duration_minutes' => 60,
            ...$extra,
        ]);

        $live = $make();
        $future = $make(['start_time' => now()->addDays(3)]);

        $list = $this->getJson('/api/v1/meetings', $this->headers($this->studentUser))->assertOk()->json('data.meetings');
        $this->assertCount(2, $list);
        $this->assertArrayNotHasKey('join_url', $list[0]);
        $this->assertArrayNotHasKey('host_url', $list[0]);

        $this->assertSame([], $this->getJson('/api/v1/meetings', $this->headers($this->otherStudentUser))->assertOk()->json('data.meetings'));

        $this->getJson("/api/v1/meetings/{$live->id}/join", $this->headers($this->studentUser))
            ->assertOk()
            ->assertJsonPath('data.join_url', 'https://meet.google.com/abc-defg-hij');

        $this->getJson("/api/v1/meetings/{$future->id}/join", $this->headers($this->studentUser))
            ->assertForbidden()
            ->assertJsonPath('error.code', 'MEETING_NOT_OPEN');

        $this->getJson("/api/v1/meetings/{$future->id}/join", $this->headers($this->owner))->assertOk();
    }

    // ---- R8-7 ----------------------------------------------------------

    public function test_media_needs_a_real_link_and_simulated_providers_are_refused_outside_testing(): void
    {
        $headers = $this->headers($this->owner);

        $this->postJson('/api/v1/media', ['title' => 'بلا رابط', 'provider' => 'google_drive'], $headers)
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MEDIA_LINK_REQUIRED');

        $this->postJson('/api/v1/media', ['title' => 'فيميو', 'provider' => 'vimeo', 'external_id' => 'https://vimeo.com/123456789'], $headers)
            ->assertSuccessful()
            ->assertJsonPath('data.media_asset.embed_url', 'https://player.vimeo.com/video/123456789');

        $this->app->detectEnvironment(fn () => 'production');
        $this->postJson('/api/v1/media', ['title' => 'وهمي', 'provider' => 'mock'], $headers)->assertStatus(422);
        $this->app->detectEnvironment(fn () => 'testing');
    }

    public function test_platform_metrics_come_from_snapshots_and_include_queue_health(): void
    {
        config(['platform.admin_token' => 'test-platform-token']);
        $headers = ['Authorization' => 'Bearer test-platform-token'];

        $before = $this->getJson('/api/v1/platform/metrics', $headers)->assertOk();
        $this->assertNull($before->json('data.summary.total_students'));
        $this->assertSame('not_computed', $before->json('data.tenants.0.metrics_status'));
        $this->assertArrayHasKey('failed', $before->json('data.queue'));

        $this->artisan('lms:refresh-platform-metrics')->assertSuccessful();

        $after = $this->getJson('/api/v1/platform/metrics', $headers)->assertOk();
        $this->assertSame(2, $after->json('data.summary.total_students'));
        $this->assertSame('ok', $after->json('data.tenants.0.metrics_status'));
        $this->assertTrue(TenantMetricSnapshot::where('tenant_id', $this->tenant->id)->exists());
    }
}
