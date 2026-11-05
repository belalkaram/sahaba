<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\AuditLog;
use App\Models\PaymentRequest;
use App\Models\PlatformPaymentReview;
use App\Models\PlatformRole;
use App\Models\PlatformUser;
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

class PlatformPaymentReviewTest extends TestCase
{
    use RefreshDatabase;

    protected string $tenantConn;

    protected PlatformUser $superAdmin;

    protected string $platformToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'test_pay_'.uniqid();
        $this->cleanupTestDatabases();

        $role = PlatformRole::firstOrCreate(
            ['name' => 'platform_super_admin'],
            ['label' => 'Platform Super Admin', 'description' => 'Full access']
        );

        $this->superAdmin = PlatformUser::create([
            'name' => 'Super Admin Belal',
            'email' => 'super@sahaba.test',
            'password' => Hash::make('AdminSecret2026!'),
            'status' => 'active',
        ]);
        $this->superAdmin->roles()->attach($role->id);

        $login = $this->postJson('/api/v1/platform/auth/login', [
            'email' => 'super@sahaba.test',
            'password' => 'AdminSecret2026!',
        ]);
        $login->assertOk();
        $this->platformToken = $login->json('data.token');
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'test_pay_*.sqlite') as $file) {
                if (file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    private function setupTenant(string $slug = 'alnahda'): array
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $tenant = Tenant::create([
            'name' => 'Al-Nahda Academy',
            'slug' => $slug,
            'type' => 'organization',
            'organization_kind' => 'academy',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => $this->tenantConn,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($tenant);
        $context->setTenant($tenant);
        $dbManager->configureConnection($tenant);

        app(RoleSynchronizer::class)->sync();

        // Teacher User (using system teacher role)
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $teacherUser = TenantUser::create([
            'name' => 'Ustaz Ahmad',
            'email' => 'ahmad@'.$slug.'.edu',
            'password' => Hash::make('TeacherSecret123!'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherUser->roles()->attach($teacherRole->id);
        Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $teacherToken = TenantToken::createTokenFor($teacherUser)['plainTextToken'];

        // Student User
        $studentRole = Role::where('name', 'student')->firstOrFail();
        $studentUser = TenantUser::create([
            'name' => 'Student Youssef',
            'email' => 'youssef@'.$slug.'.edu',
            'password' => Hash::make('StudentSecret123!'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $student = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-001',
            'grade_level' => 'Grade 11',
            'status' => 'active',
        ]);
        $studentToken = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        // Create a PaymentRequest for 10 SAR for 2026-11
        $paymentRequest = PaymentRequest::create([
            'student_id' => $student->id,
            'period_month' => '2026-11',
            'amount' => 10.00,
            'currency' => 'SAR',
            'payment_method' => 'bank_transfer',
            'reference_code' => 'TX-SAH-7788',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        return [
            'tenant' => $tenant,
            'teacher' => $teacherUser,
            'teacher_token' => $teacherToken,
            'student' => $studentUser,
            'student_profile' => $student,
            'student_token' => $studentToken,
            'payment_request' => $paymentRequest,
        ];
    }

    /**
     * Requirement 1: Teacher/Staff cannot approve payments (OD-27 -> HTTP 403).
     */
    public function test_teacher_role_cannot_approve_payment_returns_403(): void
    {
        $data = $this->setupTenant();

        $response = $this->withHeaders([
            'X-Tenant-Slug' => $data['tenant']->slug,
            'Authorization' => 'Bearer '.$data['teacher_token'],
        ])->postJson('/api/v1/payment-requests/'.$data['payment_request']->id.'/approve');

        $response->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    /**
     * Requirement 2: Super admin can view payment requests across all tenants with filters.
     */
    public function test_super_admin_can_view_cross_tenant_payments(): void
    {
        $data = $this->setupTenant();

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->platformToken,
        ])->getJson('/api/v1/platform/payments');

        $response->assertOk()
            ->assertJsonPath('data.metrics.pending_count', 1)
            ->assertJsonCount(1, 'data.payment_requests')
            ->assertJsonPath('data.payment_requests.0.tenant.slug', 'alnahda')
            ->assertJsonPath('data.payment_requests.0.amount', '10.00')
            ->assertJsonPath('data.payment_requests.0.period_month', '2026-11');
    }

    /**
     * Requirement 3 & 4: Super admin approves payment request.
     * Activates subscription for that month only.
     * Records platform review and audit ledger.
     */
    public function test_super_admin_approves_payment_activates_subscription_for_that_month_only(): void
    {
        $data = $this->setupTenant();
        $tenantId = $data['tenant']->id;
        $payId = $data['payment_request']->id;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->platformToken,
        ])->postJson("/api/v1/platform/payments/{$tenantId}/{$payId}/approve", [
            'notes' => 'IBAN transfer verified with Al Rajhi statement.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.payment_request.status', 'approved')
            ->assertJsonPath('data.subscription.status', 'active')
            ->assertJsonPath('data.subscription.period_month', '2026-11');

        // Check subscription dates bound to 2026-11
        $startsAt = $response->json('data.subscription.starts_at');
        $endsAt = $response->json('data.subscription.ends_at');
        $this->assertStringStartsWith('2026-11-01', $startsAt);
        $this->assertStringStartsWith('2026-11-30', $endsAt);

        // Verify PlatformPaymentReview record in Control DB
        $review = PlatformPaymentReview::where('payment_request_id', $payId)->first();
        $this->assertNotNull($review);
        $this->assertEquals('approved', $review->action);
        $this->assertEquals('2026-11', $review->period_month);
        $this->assertEquals(10.00, (float) $review->amount);
        $this->assertEquals($this->superAdmin->id, $review->reviewer_id);

        // Verify AuditLog in Control DB
        $this->assertTrue(AuditLog::where('action', 'platform.payment.approved')->exists());
    }

    /**
     * Requirement 5: Re-approval is idempotent and returns 422 ALREADY_PROCESSED without duplicates.
     */
    public function test_super_admin_reapproval_is_idempotent(): void
    {
        $data = $this->setupTenant();
        $tenantId = $data['tenant']->id;
        $payId = $data['payment_request']->id;

        // First approval
        $this->withHeaders([
            'Authorization' => 'Bearer '.$this->platformToken,
        ])->postJson("/api/v1/platform/payments/{$tenantId}/{$payId}/approve")->assertOk();

        // Second approval attempt
        $dupResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->platformToken,
        ])->postJson("/api/v1/platform/payments/{$tenantId}/{$payId}/approve");

        $dupResponse->assertStatus(422)
            ->assertJsonPath('error.code', 'ALREADY_PROCESSED');

        // Verify exactly 1 platform review was created
        $this->assertEquals(1, PlatformPaymentReview::where('payment_request_id', $payId)->count());
    }

    /**
     * Requirement 6: Super admin can reject payment with required reason.
     */
    public function test_super_admin_can_reject_payment_with_reason(): void
    {
        $data = $this->setupTenant();
        $tenantId = $data['tenant']->id;
        $payId = $data['payment_request']->id;

        // Missing reason returns 422
        $this->withHeaders([
            'Authorization' => 'Bearer '.$this->platformToken,
        ])->postJson("/api/v1/platform/payments/{$tenantId}/{$payId}/reject", [])
            ->assertStatus(422);

        // Rejection with reason
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->platformToken,
        ])->postJson("/api/v1/platform/payments/{$tenantId}/{$payId}/reject", [
            'reason' => 'رقم الإيصال غير مطابق للتحويل البنكي.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.payment_request.status', 'rejected');

        $review = PlatformPaymentReview::where('payment_request_id', $payId)->first();
        $this->assertNotNull($review);
        $this->assertEquals('rejected', $review->action);
        $this->assertEquals('رقم الإيصال غير مطابق للتحويل البنكي.', $review->notes);
    }

    /**
     * Requirement 7: Dynamic pricing endpoints (public /pricing and tenant /billing/pricing).
     */
    public function test_pricing_endpoints_return_configured_pricing_and_can_be_updated(): void
    {
        // 1. Unauthenticated public pricing endpoint
        $publicResp = $this->getJson('/api/v1/public/pricing');
        $publicResp->assertOk()
            ->assertJsonPath('data.student_monthly_fee', 10)
            ->assertJsonPath('data.currency', 'SAR')
            ->assertJsonPath('data.teacher_fee', 0)
            ->assertJsonPath('data.organization_fee', 0);

        // 2. Tenant billing pricing endpoint
        $data = $this->setupTenant();
        $tenantResp = $this->withHeaders([
            'X-Tenant-Slug' => $data['tenant']->slug,
            'Authorization' => 'Bearer '.$data['student_token'],
        ])->getJson('/api/v1/billing/pricing');

        $tenantResp->assertOk()
            ->assertJsonPath('data.student_monthly_fee', 10)
            ->assertJsonPath('data.currency', 'SAR');

        // 3. Super admin updates platform pricing
        $updateResp = $this->withHeaders([
            'Authorization' => 'Bearer '.$this->platformToken,
        ])->putJson('/api/v1/platform/pricing', [
            'student_monthly_fee' => 12.00,
            'currency' => 'SAR',
            'receiving_account_type' => 'platform',
            'bank_name' => 'بنك الرياض',
            'account_holder_name' => 'مؤسسة سحابة للتقنية',
            'iban' => 'SA9999999999999999999999',
            'transfer_instructions' => 'الاشتراك 12 ريال شهرياً.',
        ]);

        $updateResp->assertOk()
            ->assertJsonPath('data.pricing.student_monthly_fee', '12.00')
            ->assertJsonPath('data.pricing.bank_name', 'بنك الرياض');

        // Verify updated price in public pricing
        $this->getJson('/api/v1/public/pricing')
            ->assertJsonPath('data.student_monthly_fee', 12);
    }
}
