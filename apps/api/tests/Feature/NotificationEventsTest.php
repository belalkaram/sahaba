<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Jobs\SendNotificationEmail;
use App\Models\Assignment;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Grade;
use App\Models\NotificationPreference;
use App\Models\Package;
use App\Models\ParentProfile;
use App\Models\PaymentRequest;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\Student;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantSetting;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * R8-1: event => recipients => stored notifications, plus user preferences.
 */
class NotificationEventsTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $conn;

    protected TenantUser $studentUser;

    protected Student $student;

    protected TenantUser $parentUser;

    protected TenantUser $otherStudentUser;

    protected TenantUser $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->conn = 'notify_test_'.uniqid();

        $this->tenant = Tenant::create([
            'name' => 'Notify Academy',
            'slug' => 'notify-'.uniqid(),
            'type' => 'school',
            'status' => 'active',
        ]);
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

        [$this->studentUser, $this->student] = $this->makeStudent('a');
        [$this->otherStudentUser] = $this->makeStudent('b');
        $this->owner = $this->makeUser('owner@test.com', 'staff', 'owner');
        Staff::create(['user_id' => $this->owner->id, 'staff_type' => 'admin', 'status' => 'active']);

        $this->parentUser = $this->makeUser('parent@test.com', 'parent', 'parent');
        $parent = ParentProfile::create(['user_id' => $this->parentUser->id, 'status' => 'active']);
        $parent->students()->attach($this->student->id, ['relation_type' => 'father']);
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
        $student = Student::create(['user_id' => $user->id, 'student_code' => "STD-{$suffix}", 'status' => 'active']);

        return [$user, $student];
    }

    private function headers(TenantUser $user): array
    {
        return [
            'X-Tenant-Slug' => $this->tenant->slug,
            'Authorization' => 'Bearer '.TenantToken::createTokenFor($user)['plainTextToken'],
        ];
    }

    private function events(TenantUser $user): array
    {
        return $user->notifications()->get()->map(fn ($n) => $n->data['event'] ?? null)->all();
    }

    private function pendingPayment(): PaymentRequest
    {
        $package = Package::create(['name' => 'الباقة الذهبية', 'price' => 100, 'status' => 'active']);

        return PaymentRequest::create([
            'student_id' => $this->student->id,
            'package_id' => $package->id,
            'amount' => 100,
            'currency' => 'SAR',
            'payment_method' => 'bank_transfer',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);
    }

    public function test_payment_approval_notifies_student_and_parent_but_not_others(): void
    {
        $payment = $this->pendingPayment();

        $this->postJson("/api/v1/payment-requests/{$payment->id}/approve", [], $this->headers($this->owner))->assertOk();

        $this->assertContains(NotificationCatalog::PAYMENT_APPROVED, $this->events($this->studentUser));
        $this->assertContains(NotificationCatalog::PAYMENT_APPROVED, $this->events($this->parentUser));
        $this->assertSame([], $this->events($this->otherStudentUser));

        $stored = $this->studentUser->notifications()->first();
        $this->assertStringContainsString('الباقة الذهبية', $stored->data['message']);
        $this->assertSame('/student/subscriptions', $stored->data['url']);
    }

    public function test_payment_approval_queues_email_when_enabled(): void
    {
        Queue::fake();
        $payment = $this->pendingPayment();

        $this->postJson("/api/v1/payment-requests/{$payment->id}/approve", [], $this->headers($this->owner))->assertOk();

        Queue::assertPushed(SendNotificationEmail::class, fn ($job) => $job->email === $this->studentUser->email);
    }

    public function test_preferences_turn_channels_off(): void
    {
        Queue::fake();
        NotificationPreference::create([
            'user_id' => $this->studentUser->id,
            'event_key' => NotificationCatalog::PAYMENT_APPROVED,
            'in_app' => false,
            'mail' => false,
        ]);

        $payment = $this->pendingPayment();
        $this->postJson("/api/v1/payment-requests/{$payment->id}/approve", [], $this->headers($this->owner))->assertOk();

        $this->assertSame([], $this->events($this->studentUser));
        Queue::assertNotPushed(SendNotificationEmail::class, fn ($job) => $job->email === $this->studentUser->email);
    }

    public function test_preferences_api_reads_and_updates_own_preferences(): void
    {
        $headers = $this->headers($this->studentUser);

        $list = $this->getJson('/api/v1/me/notification-preferences', $headers)->assertOk()->json('data.preferences');
        $this->assertCount(count(NotificationCatalog::all()), $list);

        $this->putJson('/api/v1/me/notification-preferences', [
            'preferences' => [['event' => NotificationCatalog::GRADE_PUBLISHED, 'in_app' => false, 'mail' => true]],
        ], $headers)->assertOk();

        $this->assertDatabaseHas('notification_preferences', [
            'user_id' => $this->studentUser->id,
            'event_key' => NotificationCatalog::GRADE_PUBLISHED,
            'in_app' => false,
        ], 'tenant');

        $this->putJson('/api/v1/me/notification-preferences', [
            'preferences' => [['event' => 'not_a_real_event', 'in_app' => true, 'mail' => true]],
        ], $headers)->assertStatus(422);
    }

    public function test_absence_notifies_parents_unless_tenant_disables_it(): void
    {
        $class = SchoolClass::create(['name' => 'شعبة أ', 'status' => 'active']);
        $class->students()->attach($this->student->id, ['id' => (string) Str::uuid()]);
        $session = ClassSession::create([
            'class_id' => $class->id,
            'title' => 'حصة الفيزياء',
            'starts_at' => now(),
            'status' => 'in_progress',
            'attendance_mode' => 'both',
            'timing_mode' => 'open',
        ]);
        $headers = $this->headers($this->owner);

        $this->postJson("/api/v1/sessions/{$session->id}/attendance", ['student_id' => $this->student->id, 'status' => 'absent'], $headers)->assertSuccessful();
        $this->assertContains(NotificationCatalog::ATTENDANCE_ABSENT, $this->events($this->parentUser));
        $this->assertNotContains(NotificationCatalog::ATTENDANCE_ABSENT, $this->events($this->studentUser));

        $this->parentUser->notifications()->delete();
        TenantSetting::setValue(TenantSetting::NOTIFY_PARENTS_ON_ABSENCE, false);

        $this->postJson("/api/v1/sessions/{$session->id}/attendance", ['student_id' => $this->student->id, 'status' => 'absent'], $headers)->assertSuccessful();
        $this->assertSame([], $this->events($this->parentUser));
    }

    public function test_publishing_grades_notifies_only_students_with_new_grades(): void
    {
        $course = Course::create(['title' => 'الرياضيات', 'status' => 'published']);
        $assignment = Assignment::create(['course_id' => $course->id, 'title' => 'الواجب الأول', 'points_possible' => 100, 'status' => 'published']);
        Grade::create([
            'student_id' => $this->student->id,
            'gradable_type' => 'assignment',
            'gradable_id' => $assignment->id,
            'score' => 90,
            'max_score' => 100,
            'percentage' => 90,
            'is_published' => false,
        ]);

        $headers = $this->headers($this->owner);
        $this->postJson("/api/v1/courses/{$course->id}/assignments/{$assignment->id}/publish-grades", [], $headers)->assertOk();

        $this->assertContains(NotificationCatalog::GRADE_PUBLISHED, $this->events($this->studentUser));
        $this->assertSame([], $this->events($this->otherStudentUser));

        // Publishing again must not notify twice.
        $this->postJson("/api/v1/courses/{$course->id}/assignments/{$assignment->id}/publish-grades", [], $headers)->assertOk();
        $this->assertCount(1, $this->events($this->studentUser));
    }

    public function test_scheduled_command_notifies_once_for_expiring_subscription_and_due_assignment(): void
    {
        $package = Package::create(['name' => 'باقة', 'price' => 10, 'status' => 'active']);
        Subscription::create(['student_id' => $this->student->id, 'package_id' => $package->id, 'status' => 'active', 'starts_at' => now()->subMonth(), 'ends_at' => now()->addDays(3)]);

        $course = Course::create(['title' => 'الفيزياء', 'status' => 'published']);
        Enrollment::create(['student_id' => $this->student->id, 'course_id' => $course->id, 'status' => 'active', 'enrolled_at' => now()]);
        Assignment::create(['course_id' => $course->id, 'title' => 'واجب', 'points_possible' => 10, 'status' => 'published', 'due_at' => now()->addHours(5)]);

        $this->artisan('lms:notify-scheduled')->assertSuccessful();
        $this->artisan('lms:notify-scheduled')->assertSuccessful();

        $events = $this->events($this->studentUser);
        $this->assertSame(1, collect($events)->filter(fn ($e) => $e === NotificationCatalog::SUBSCRIPTION_EXPIRING)->count());
        $this->assertSame(1, collect($events)->filter(fn ($e) => $e === NotificationCatalog::ASSIGNMENT_DUE)->count());
        $this->assertContains(NotificationCatalog::SUBSCRIPTION_EXPIRING, $this->events($this->parentUser));
    }

    public function test_failed_delivery_does_not_break_the_caller_and_inactive_users_are_skipped(): void
    {
        $this->studentUser->update(['status' => 'suspended']);

        $count = app(NotificationService::class)->send(NotificationCatalog::EXAM_OPENED, [$this->studentUser], ['title' => 'x']);

        $this->assertSame(0, $count);
        $this->assertSame(0, app(NotificationService::class)->send('unknown_event', [$this->otherStudentUser]));
    }
}
