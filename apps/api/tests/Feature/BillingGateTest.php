<?php

namespace Tests\Feature;

use App\Models\Package;
use App\Models\PaymentRequest;
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

class BillingGateTest extends TestCase
{
    use RefreshDatabase;

    protected string $tenantConnA;

    protected string $tenantConnB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConnA = 'test_bil_a_'.uniqid();
        $this->tenantConnB = 'test_bil_b_'.uniqid();
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'test_bil_*.sqlite') as $file) {
                if (file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    /**
     * Phase J §33 — Billing Gate:
     * - submit payment
     * - review
     * - approve
     * - reject
     * - duplicate approval
     * - wrong reviewer
     * - wrong tenant
     * - subscription activation
     * - entitlement grant
     * - notification / audit
     * - invariants: Payment ≠ Subscription, Subscription ≠ Entitlement
     */
    public function test_billing_gate_complete_lifecycle(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        // -------------------------------------------------------------
        // 1. Provision Tenant A (Al-Nahda Academy)
        // -------------------------------------------------------------
        $tenantA = Tenant::create([
            'name' => 'Al-Nahda Academy',
            'slug' => 'alnahda',
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
        $permPkgCreate = Permission::create(['name' => 'packages.create', 'module' => 'billing']);
        $permPayView = Permission::create(['name' => 'payments.view', 'module' => 'billing']);
        $permPayApprove = Permission::create(['name' => 'payments.approve', 'module' => 'billing']);
        $permPayReject = Permission::create(['name' => 'payments.reject', 'module' => 'billing']);
        $permSubView = Permission::create(['name' => 'subscriptions.view', 'module' => 'billing']);
        $permEntView = Permission::create(['name' => 'entitlements.view', 'module' => 'billing']);

        // Roles in Tenant A
        $adminRole = Role::create(['name' => 'billing_admin', 'label' => 'Billing Administrator', 'is_system' => true]);
        $adminRole->permissions()->attach([
            $permPkgCreate->id,
            $permPayView->id,
            $permPayApprove->id,
            $permPayReject->id,
            $permSubView->id,
            $permEntView->id,
        ]);

        $assistantRole = Role::create(['name' => 'assistant', 'label' => 'General Assistant', 'is_system' => true]);
        $assistantRole->permissions()->attach([
            $permPayView->id, // Can view but cannot approve/reject
        ]);

        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        // Users in Tenant A
        // A1: Admin
        $adminUser = TenantUser::create([
            'name' => 'Admin Fouad',
            'email' => 'fouad@alnahda.edu',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $adminUser->roles()->attach($adminRole->id);
        Staff::create(['user_id' => $adminUser->id, 'staff_type' => 'admin', 'status' => 'active']);
        $adminToken = TenantToken::createTokenFor($adminUser)['plainTextToken'];

        // A2: Assistant (Without approve permission)
        $assistantUser = TenantUser::create([
            'name' => 'Assistant Karim',
            'email' => 'karim@alnahda.edu',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $assistantUser->roles()->attach($assistantRole->id);
        Staff::create(['user_id' => $assistantUser->id, 'staff_type' => 'assistant', 'status' => 'active']);
        $assistantToken = TenantToken::createTokenFor($assistantUser)['plainTextToken'];

        // A3: Student
        $studentUser = TenantUser::create([
            'name' => 'Student Nour',
            'email' => 'nour@alnahda.edu',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $studentProfile = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-NAH-001',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);
        $studentToken = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        // -------------------------------------------------------------
        // 2. Provision Tenant B (Al-Qimma Center)
        // -------------------------------------------------------------
        $tenantB = Tenant::create([
            'name' => 'Al-Qimma Center',
            'slug' => 'alqimma',
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

        $pkgB = Package::create([
            'name' => 'Tenant B Package',
            'price' => 100,
            'status' => 'active',
        ]);
        $userB = TenantUser::create([
            'name' => 'Tenant B Student',
            'email' => 'studentb@alqimma.edu',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentB = Student::create([
            'user_id' => $userB->id,
            'student_code' => 'STU-QIM-001',
            'status' => 'active',
        ]);
        $payReqB = PaymentRequest::create([
            'student_id' => $studentB->id,
            'package_id' => $pkgB->id,
            'amount' => 100,
            'payment_method' => 'cash',
            'status' => 'pending',
        ]);

        // -------------------------------------------------------------
        // 3. EXECUTE BILLING GATE VERIFICATIONS (Phase J §33)
        // -------------------------------------------------------------

        // 1. Create Package in Tenant A
        $pkgResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson('/api/v1/packages', [
            'name' => 'Full Semester VIP Package',
            'code' => 'VIP-SEM-1',
            'description' => 'Online lectures, exams, and priority sessions.',
            'price' => 500.00,
            'currency' => 'EGP',
            'billing_cycle' => 'term',
            'entitlements' => ['ONLINE_ACCESS', 'EXAM_ACCESS', 'LIVE_SESSIONS'],
        ]);
        $pkgResp->assertStatus(201);
        $packageId = $pkgResp->json('data.package.id');

        // 1b. Students only ever see active packages, even when they ask for status=all.
        $draft = Package::create(['name' => 'Draft package', 'price' => 10, 'currency' => 'EGP', 'status' => 'draft']);
        $studentHeaders = ['X-Tenant-Slug' => 'alnahda', 'Authorization' => 'Bearer '.$studentToken];
        $listAll = $this->withHeaders($studentHeaders)->getJson('/api/v1/packages?status=all');
        $listAll->assertStatus(200);
        $this->assertNotContains($draft->id, collect($listAll->json('data.packages'))->pluck('id')->all());
        $this->assertContains($packageId, collect($listAll->json('data.packages'))->pluck('id')->all());
        $this->withHeaders($studentHeaders)->getJson('/api/v1/packages/'.$draft->id)->assertStatus(404);

        // 1c. PAY-SET-1: nothing is accepted until the academy configures its methods; students cannot configure them.
        $this->withHeaders($studentHeaders)->postJson('/api/v1/payment-requests', [
            'package_id' => $packageId, 'payment_method' => 'instapay', 'reference_code' => 'X-1',
        ])->assertStatus(422)->assertJsonPath('error.code', 'PAYMENT_METHOD_NOT_ACCEPTED');
        $this->withHeaders($studentHeaders)->putJson('/api/v1/billing/payment-settings', ['accepted_methods' => ['cash']])
            ->assertStatus(403);
        $this->withHeaders($studentHeaders)->getJson('/api/v1/billing/payment-settings')
            ->assertStatus(200)->assertJsonPath('data.accepted_methods', []);
        $context->setTenant($tenantA);
        $dbManager->configureConnection($tenantA);
        \App\Models\TenantSetting::setValue(\App\Models\TenantSetting::PAYMENT_SETTINGS, [
            'accepted_methods' => ['instapay', 'cash'], 'instapay_address' => 'alnahda@instapay',
        ]);

        // 2. Student Submits Payment Request
        $submitPayResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson('/api/v1/payment-requests', [
            'package_id' => $packageId,
            'amount' => 500.00,
            'payment_method' => 'instapay',
            'sender_phone' => '01012345678',
            'reference_code' => 'INSTA-TX-990011',
            'proof_url' => 'https://storage.alnahda.edu/proofs/tx990011.jpg',
        ]);

        $submitPayResp->assertStatus(201)
            ->assertJsonPath('data.payment_request.status', 'pending')
            ->assertJsonPath('data.payment_request.amount', '500.00')
            ->assertJsonPath('data.payment_request.payment_method', 'instapay');

        $payReqId = $submitPayResp->json('data.payment_request.id');

        // Verify Student has NO entitlements yet
        $this->assertFalse($studentProfile->fresh()->hasEntitlement('ONLINE_ACCESS'));

        // 3. Review (Admin and Assistant can view pending payments)
        $reviewResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$adminToken,
        ])->getJson('/api/v1/payment-requests');

        $reviewResp->assertStatus(200)
            ->assertJsonCount(1, 'data.payment_requests')
            ->assertJsonPath('data.payment_requests.0.id', $payReqId);

        // 4. Wrong Reviewer Check (Assistant without payments.approve is denied)
        $wrongReviewerResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$assistantToken,
        ])->postJson("/api/v1/payment-requests/{$payReqId}/approve");

        $wrongReviewerResp->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        // 5. Approve Payment Request (Admin approves)
        $approveResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson("/api/v1/payment-requests/{$payReqId}/approve", [
            'notes' => 'InstaPay transaction reference confirmed on bank statement.',
        ]);

        $approveResp->assertStatus(200)
            ->assertJsonPath('data.payment_request.status', 'approved')
            ->assertJsonPath('data.subscription.status', 'active')
            ->assertJsonCount(3, 'data.entitlements');

        // 6. Invariants Verification:
        // - Subscription is active and separate from payment (Payment ≠ Subscription)
        $subId = $approveResp->json('data.subscription.id');
        $this->assertNotEmpty($subId);

        // - Student now has active entitlements (Subscription ≠ Entitlement)
        $this->assertTrue($studentProfile->fresh()->hasEntitlement('ONLINE_ACCESS'));
        $this->assertTrue($studentProfile->fresh()->hasEntitlement('EXAM_ACCESS'));
        $this->assertTrue($studentProfile->fresh()->hasEntitlement('LIVE_SESSIONS'));

        // - Audit Log Recorded
        $payRequest = PaymentRequest::with('reviewLogs')->findOrFail($payReqId);
        $this->assertCount(1, $payRequest->reviewLogs);
        $this->assertEquals('approved', $payRequest->reviewLogs->first()->action);
        $this->assertEquals($adminUser->id, $payRequest->reviewLogs->first()->reviewed_by_user_id);

        // 7. Duplicate Approval Check
        $dupApproveResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson("/api/v1/payment-requests/{$payReqId}/approve");

        $dupApproveResp->assertStatus(422)
            ->assertJsonPath('error.code', 'ALREADY_PROCESSED');

        // 8. Reject Payment Lifecycle
        // Student submits a 2nd payment request
        $payReq2Resp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$studentToken,
        ])->postJson('/api/v1/payment-requests', [
            'package_id' => $packageId,
            'amount' => 500.00,
            'payment_method' => 'cash',
        ]);
        $payReq2Id = $payReq2Resp->json('data.payment_request.id');

        // Admin rejects payment request 2
        $rejectResp = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson("/api/v1/payment-requests/{$payReq2Id}/reject", [
            'reason' => 'Cash was not handed over to the front desk cashier.',
        ]);

        $rejectResp->assertStatus(200)
            ->assertJsonPath('data.payment_request.status', 'rejected');

        $payReq2 = PaymentRequest::with('reviewLogs')->findOrFail($payReq2Id);
        $this->assertEquals('rejected', $payReq2->status);
        $this->assertEquals('Cash was not handed over to the front desk cashier.', $payReq2->rejection_reason);
        $this->assertCount(1, $payReq2->reviewLogs);
        $this->assertEquals('rejected', $payReq2->reviewLogs->first()->action);

        // 9. Wrong Tenant Check (Cross-tenant security)
        // Attempting to query Tenant B's payment request from Tenant A -> 404
        $crossTenantQuery = $this->withHeaders([
            'X-Tenant-Slug' => 'alnahda',
            'Authorization' => 'Bearer '.$adminToken,
        ])->getJson("/api/v1/payment-requests/{$payReqB->id}");

        $crossTenantQuery->assertStatus(404);

        // Attempting to approve Tenant B's payment request with Tenant A admin token -> 401
        $crossTenantAuth = $this->withHeaders([
            'X-Tenant-Slug' => 'alqimma',
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson("/api/v1/payment-requests/{$payReqB->id}/approve");

        $crossTenantAuth->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }
}
