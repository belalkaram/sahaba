<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Course;
use App\Models\Entitlement;
use App\Models\Lesson;
use App\Models\Package;
use App\Models\PackageEntitlement;
use App\Models\Role;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ContentAccessPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'access_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'Access Academy',
            'slug' => 'access-'.uniqid(),
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
            'domain' => $this->tenant->slug.'.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        $this->tenant->features()->create(['feature_key' => 'courses', 'enabled' => true]);
        $this->tenant->features()->create(['feature_key' => 'billing', 'enabled' => true]);
        $this->tenant->features()->create(['feature_key' => 'core', 'enabled' => true]);

        app(RoleSynchronizer::class)->sync();
    }

    protected function tearDown(): void
    {
        $this->cleanupTenantDb();
        parent::tearDown();
    }

    protected function cleanupTenantDb(): void
    {
        if (isset($this->tenantConn)) {
            $db = database_path("tenants/tenant_{$this->tenantConn}.sqlite");
            if (file_exists($db)) {
                @unlink($db);
            }
        }
    }

    protected function createStudentUser(string $suffix = ''): array
    {
        $user = TenantUser::create([
            'name' => 'Tariq Student'.$suffix,
            'email' => 'tariq'.$suffix.'@test.com',
            'phone' => '+2010111'.rand(1000, 9999),
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);

        $student = Student::create([
            'user_id' => $user->id,
            'student_code' => 'STD-ACCESS-'.rand(1000, 9999),
            'status' => 'active',
        ]);

        $role = Role::where('name', 'student')->first();
        if ($role) {
            $user->roles()->attach($role->id);
        }

        $tokenData = TenantToken::createTokenFor($user);

        return [$user, $student, $tokenData['plainTextToken']];
    }

    protected function createFinanceStaffUser(): array
    {
        $user = TenantUser::create([
            'name' => 'Finance Reviewer',
            'email' => 'finance@test.com',
            'phone' => '+2010333'.rand(1000, 9999),
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);

        $role = Role::where('name', 'finance')->first();
        if ($role) {
            $user->roles()->attach($role->id);
        }

        $tokenData = TenantToken::createTokenFor($user);

        return [$user, $tokenData['plainTextToken']];
    }

    public function test_unpaid_student_cannot_access_paid_course_content()
    {
        [$user, $student, $token] = $this->createStudentUser();

        $course = Course::create([
            'title' => 'Physics 101',
            'status' => 'published',
            'is_free' => false,
        ]);

        $lesson = Lesson::create([
            'course_id' => $course->id,
            'title' => 'Newton Laws',
            'content' => 'Full lesson content',
            'status' => 'published',
            'is_free_preview' => false,
        ]);

        // Attempt course show
        $res = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->getJson("/api/v1/courses/{$course->id}");

        $res->assertStatus(403);
        $res->assertJsonPath('error.code', 'ACCESS_REQUIRES_SUBSCRIPTION');

        // Attempt lesson show
        $lessonRes = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->getJson("/api/v1/courses/{$course->id}/lessons/{$lesson->id}");

        $lessonRes->assertStatus(403);
        $lessonRes->assertJsonPath('error.code', 'ACCESS_REQUIRES_SUBSCRIPTION');
    }

    public function test_student_can_access_free_preview_lesson_without_subscription()
    {
        [$user, $student, $token] = $this->createStudentUser();

        $course = Course::create([
            'title' => 'Chemistry 101',
            'status' => 'published',
            'is_free' => false,
        ]);

        $previewLesson = Lesson::create([
            'course_id' => $course->id,
            'title' => 'Intro to Atoms',
            'content' => 'Free preview atom structure',
            'status' => 'published',
            'is_free_preview' => true,
        ]);

        $res = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->getJson("/api/v1/courses/{$course->id}/lessons/{$previewLesson->id}");

        $res->assertStatus(200);
        $res->assertJsonPath('data.lesson.title', 'Intro to Atoms');
        $res->assertJsonPath('data.lesson.access.allowed', true);
    }

    public function test_student_cannot_self_enroll_in_paid_course_without_entitlement()
    {
        [$user, $student, $token] = $this->createStudentUser();

        $course = Course::create([
            'title' => 'Biology Advanced',
            'status' => 'published',
            'is_free' => false,
        ]);

        $res = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->postJson("/api/v1/courses/{$course->id}/enroll");

        $res->assertStatus(403);
        $res->assertJsonPath('error.code', 'ENROLLMENT_REQUIRES_PAYMENT');
    }

    public function test_student_can_self_enroll_in_free_course()
    {
        [$user, $student, $token] = $this->createStudentUser();

        $course = Course::create([
            'title' => 'Free Orientation Course',
            'status' => 'published',
            'is_free' => true,
        ]);

        $res = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->postJson("/api/v1/courses/{$course->id}/enroll");

        $res->assertStatus(201);
        $res->assertJsonPath('data.enrollment.status', 'active');
    }

    public function test_approved_payment_unlocks_content_and_auto_enrolls_student()
    {
        [$studentUser, $student, $studentToken] = $this->createStudentUser();
        [$financeUser, $financeToken] = $this->createFinanceStaffUser();

        $course = Course::create([
            'title' => 'Math Masterclass',
            'status' => 'published',
            'is_free' => false,
        ]);

        $package = Package::create([
            'name' => 'Math Package',
            'price' => 250,
            'status' => 'active',
        ]);

        PackageEntitlement::create([
            'package_id' => $package->id,
            'entitlement_key' => 'course:'.$course->id,
        ]);

        // Student submits payment request
        $payRes = $this->withHeaders([
            'Authorization' => "Bearer {$studentToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->postJson('/api/v1/payment-requests', [
            'package_id' => $package->id,
            'amount' => 250,
            'payment_method' => 'instapay',
            'sender_phone' => '01011112222',
            'reference_code' => 'TXN-9988',
        ]);

        $payRes->assertStatus(201);
        $paymentRequestId = $payRes->json('data.payment_request.id');

        // Finance approves payment
        $approveRes = $this->withHeaders([
            'Authorization' => "Bearer {$financeToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->postJson("/api/v1/payment-requests/{$paymentRequestId}/approve", [
            'notes' => 'Payment verified on bank statement',
        ]);

        $approveRes->assertStatus(200);

        // Student now accesses course immediately without relogin!
        $courseRes = $this->withHeaders([
            'Authorization' => "Bearer {$studentToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->getJson("/api/v1/courses/{$course->id}");

        $courseRes->assertStatus(200);
        $courseRes->assertJsonPath('data.course.access.allowed', true);
    }

    public function test_expired_entitlement_locks_course_access()
    {
        [$studentUser, $student, $studentToken] = $this->createStudentUser();

        $course = Course::create([
            'title' => 'History of Egypt',
            'status' => 'published',
            'is_free' => false,
        ]);

        // Student enrolled
        $course->enrollments()->create([
            'student_id' => $student->id,
            'status' => 'active',
        ]);

        // Entitlement expired yesterday
        Entitlement::create([
            'student_id' => $student->id,
            'subscription_id' => null,
            'entitlement_key' => 'course:'.$course->id,
            'is_active' => true,
            'expires_at' => now()->subDay(),
        ]);

        $res = $this->withHeaders([
            'Authorization' => "Bearer {$studentToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->getJson("/api/v1/courses/{$course->id}");

        $res->assertStatus(403);
        $res->assertJsonPath('error.code', 'ACCESS_REQUIRES_SUBSCRIPTION');
        $res->assertJsonPath('error.details.reason', 'expired');
    }

    public function test_manual_entitlement_grant_and_revoke_with_audit()
    {
        [$studentUser, $student] = $this->createStudentUser();
        [$financeUser, $financeToken] = $this->createFinanceStaffUser();

        // 1. Grant manual entitlement
        $grantRes = $this->withHeaders([
            'Authorization' => "Bearer {$financeToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->postJson("/api/v1/students/{$student->id}/entitlements", [
            'entitlement_key' => 'all_courses',
            'expires_at' => now()->addMonths(3)->toIso8601String(),
            'reason' => 'Scholarship recipient',
        ]);

        $grantRes->assertStatus(201);
        $entitlementId = $grantRes->json('data.entitlement.id');

        $this->assertDatabaseHas('entitlements', [
            'id' => $entitlementId,
            'student_id' => $student->id,
            'is_active' => 1,
            'reason' => 'Scholarship recipient',
        ], 'tenant');

        // 2. Revoke entitlement
        $revokeRes = $this->withHeaders([
            'Authorization' => "Bearer {$financeToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->postJson("/api/v1/entitlements/{$entitlementId}/revoke", [
            'reason' => 'Scholarship cancelled',
        ]);

        $revokeRes->assertStatus(200);

        $this->assertDatabaseHas('entitlements', [
            'id' => $entitlementId,
            'is_active' => 0,
            'reason' => 'Scholarship cancelled',
        ], 'tenant');
    }

    public function test_payment_proof_upload_and_authorized_access()
    {
        Storage::fake('local');

        [$studentUser, $student, $studentToken] = $this->createStudentUser();
        [$financeUser, $financeToken] = $this->createFinanceStaffUser();

        $package = Package::create([
            'name' => 'Monthly Plan',
            'price' => 100,
            'status' => 'active',
        ]);

        $file = UploadedFile::fake()->create('receipt.png', 500, 'image/png');

        $res = $this->withHeaders([
            'Authorization' => "Bearer {$studentToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->post('/api/v1/payment-requests', [
            'package_id' => $package->id,
            'amount' => 100,
            'payment_method' => 'instapay',
            'proof' => $file,
        ]);

        $res->assertStatus(201);
        $paymentRequestId = $res->json('data.payment_request.id');

        // Student owner can access proof
        $proofRes = $this->withHeaders([
            'Authorization' => "Bearer {$studentToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->get("/api/v1/payment-requests/{$paymentRequestId}/proof");

        $proofRes->assertStatus(200);

        // Finance reviewer can access proof
        $financeProofRes = $this->withHeaders([
            'Authorization' => "Bearer {$financeToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->get("/api/v1/payment-requests/{$paymentRequestId}/proof");

        $financeProofRes->assertStatus(200);

        // Another unrelated student CANNOT access proof
        [$otherUser, $otherStudent, $otherToken] = $this->createStudentUser('_other');
        $unauthorizedRes = $this->withHeaders([
            'Authorization' => "Bearer {$otherToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->get("/api/v1/payment-requests/{$paymentRequestId}/proof");

        $unauthorizedRes->assertStatus(403);
    }
}
