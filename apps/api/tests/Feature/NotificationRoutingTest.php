<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Models\NotificationPreference;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NotificationRoutingTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected TenantUser $studentUser;

    protected Student $student;

    protected TenantUser $parentUser;

    protected ParentProfile $parent;

    protected function setUp(): void
    {
        parent::setUp();

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $this->tenant = Tenant::create([
            'name' => 'أكاديمية الإشعار',
            'slug' => 'p9-notify-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'school',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => 'tenant_'.$this->tenant->slug,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($this->tenant);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        app(RoleSynchronizer::class)->sync();

        $this->studentUser = TenantUser::create([
            'name' => 'سامي يوسف',
            'email' => 'student.sami@p9.test',
            'phone' => '01011113333',
            'password' => 'SecurePass123!',
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentRole = Role::where('name', 'student')->first();
        $this->studentUser->roles()->attach($studentRole->id);

        $this->student = Student::create([
            'user_id' => $this->studentUser->id,
            'student_code' => 'STD-P9-01',
            'status' => 'active',
        ]);

        $this->parentUser = TenantUser::create([
            'name' => 'يوسف خليل',
            'email' => 'parent.youssef@p9.test',
            'phone' => '01099991111',
            'password' => 'SecurePass123!',
            'type' => 'parent',
            'status' => 'active',
        ]);
        $parentRole = Role::where('name', 'parent')->first();
        $this->parentUser->roles()->attach($parentRole->id);

        $this->parent = ParentProfile::create([
            'user_id' => $this->parentUser->id,
            'status' => 'active',
            'whatsapp_opt_in' => true,
        ]);
        $this->student->parents()->attach($this->parent->id, ['relation_type' => 'father']);
    }

    protected function tearDown(): void
    {
        DB::purge('tenant');
        parent::tearDown();
    }

    private function studentEvents(): array
    {
        return $this->studentUser->notifications()->get()->map(fn ($n) => $n->data['event'] ?? null)->all();
    }

    private function parentEvents(): array
    {
        return $this->parentUser->notifications()->get()->map(fn ($n) => $n->data['event'] ?? null)->all();
    }

    public function test_attendance_absent_routes_to_both_student_and_parent(): void
    {
        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::ATTENDANCE_ABSENT,
            $this->student,
            ['title' => 'الفيزياء الحديثة']
        );

        $this->assertContains(NotificationCatalog::ATTENDANCE_ABSENT, $this->studentEvents());
        $this->assertContains(NotificationCatalog::ATTENDANCE_ABSENT, $this->parentEvents());
    }

    public function test_attendance_late_routes_to_both_student_and_parent(): void
    {
        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::ATTENDANCE_LATE,
            $this->student,
            ['title' => 'الكيمياء العضوية']
        );

        $this->assertContains(NotificationCatalog::ATTENDANCE_LATE, $this->studentEvents());
        $this->assertContains(NotificationCatalog::ATTENDANCE_LATE, $this->parentEvents());
    }

    public function test_homework_missing_routes_to_both_student_and_parent(): void
    {
        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::HOMEWORK_MISSING,
            $this->student,
            ['title' => 'الأحياء - واجب الأسبوع الأول']
        );

        $this->assertContains(NotificationCatalog::HOMEWORK_MISSING, $this->studentEvents());
        $this->assertContains(NotificationCatalog::HOMEWORK_MISSING, $this->parentEvents());
    }

    public function test_grade_published_routes_to_both_student_and_parent(): void
    {
        $service = app(NotificationService::class);
        $service->gradesPublished([$this->student->id], 'كويز الجبر والهندسة');

        $this->assertContains(NotificationCatalog::GRADE_PUBLISHED, $this->studentEvents());
        $this->assertContains(NotificationCatalog::GRADE_PUBLISHED, $this->parentEvents());
    }

    public function test_session_reminder_routes_to_student_only(): void
    {
        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::SESSION_REMINDER,
            $this->student,
            ['title' => 'حصة المراجعة النهائية', 'time' => '10:00 AM']
        );

        $this->assertContains(NotificationCatalog::SESSION_REMINDER, $this->studentEvents());
        $this->assertNotContains(NotificationCatalog::SESSION_REMINDER, $this->parentEvents());
    }

    public function test_weekly_report_routes_to_parent_only(): void
    {
        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::WEEKLY_REPORT,
            $this->student,
            ['student' => $this->studentUser->name]
        );

        $this->assertNotContains(NotificationCatalog::WEEKLY_REPORT, $this->studentEvents());
        $this->assertContains(NotificationCatalog::WEEKLY_REPORT, $this->parentEvents());
    }

    public function test_user_preference_can_disable_in_app_notification(): void
    {
        NotificationPreference::create([
            'user_id' => $this->parentUser->id,
            'event_key' => NotificationCatalog::ATTENDANCE_ABSENT,
            'in_app' => false,
            'mail' => false,
        ]);

        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::ATTENDANCE_ABSENT,
            $this->student,
            ['title' => 'اللغة العربية']
        );

        // Student still receives it, but parent disabled it
        $this->assertContains(NotificationCatalog::ATTENDANCE_ABSENT, $this->studentEvents());
        $this->assertNotContains(NotificationCatalog::ATTENDANCE_ABSENT, $this->parentEvents());
    }
}
