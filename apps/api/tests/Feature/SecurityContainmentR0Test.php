<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Exam;
use App\Models\Package;
use App\Models\PaymentRequest;
use App\Models\Permission;
use App\Models\Question;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Student;
use App\Models\SupportExchangeCode;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * R0 — Security Containment Tests
 *
 * Each test documents the BEFORE (broken) and AFTER (fixed) behaviour.
 * All tests must pass after R0 changes are applied.
 */
class SecurityContainmentR0Test extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'r0_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'R0 Security Test Academy',
            'slug' => 'r0-security',
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
            'domain' => 'r0-security.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'r0_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // R0-1: Platform routes require platform.auth token
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_platform_list_tenants_returns_401_without_token(): void
    {
        // BEFORE: no middleware → 200 with tenant list (data leak)
        // AFTER:  platform.auth middleware → 401

        Config::set('platform.admin_token', 'test-platform-secret-32-chars-long');

        $response = $this->getJson('/api/v1/tenants');
        $response->assertStatus(401);
    }

    /** @test */
    public function test_platform_provision_tenant_returns_401_without_token(): void
    {
        Config::set('platform.admin_token', 'test-platform-secret-32-chars-long');

        $response = $this->postJson('/api/v1/tenants', [
            'name' => 'New School',
            'slug' => 'new-school',
            'type' => 'school',
        ]);
        $response->assertStatus(401);
    }

    /** @test */
    public function test_platform_support_access_returns_401_without_token(): void
    {
        Config::set('platform.admin_token', 'test-platform-secret-32-chars-long');

        $response = $this->postJson("/api/v1/tenants/{$this->tenant->id}/support-access", [
            'reason' => 'Test access',
        ]);
        $response->assertStatus(401);
    }

    /** @test */
    public function test_platform_routes_return_401_with_wrong_token(): void
    {
        Config::set('platform.admin_token', 'correct-platform-secret-32-chars');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer wrong-token',
        ])->getJson('/api/v1/tenants');

        $response->assertStatus(401);
    }

    /** @test */
    public function test_platform_routes_return_401_when_env_token_is_empty(): void
    {
        // If PLATFORM_ADMIN_TOKEN is empty, all requests must be denied (deny-by-default)
        Config::set('platform.admin_token', '');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer anything',
        ])->getJson('/api/v1/tenants');

        $response->assertStatus(401);
    }

    /** @test */
    public function test_platform_list_tenants_succeeds_with_correct_token(): void
    {
        $secret = 'test-platform-secret-exactly-32x';
        Config::set('platform.admin_token', $secret);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$secret,
        ])->getJson('/api/v1/tenants');

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['tenants']]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // R0-2: Exam questions — correct_answer never returned to students
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_student_exam_list_does_not_expose_correct_answer(): void
    {
        // BEFORE: questions returned with correct_answer in JSON
        // AFTER:  students get withCount only; correct_answer is hidden

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        // Create minimal permissions + student user
        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        $studentUser = TenantUser::create([
            'name' => 'Nour Student',
            'email' => 'nour@r0test.edu',
            'password' => Hash::make('password123'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $student = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-R0-001',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);
        $studentToken = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        // Create a course + exam with a question that has a correct_answer
        $course = Course::create([
            'title' => 'Test Course',
            'code' => 'TC-001',
            'description' => 'Test',
            'status' => 'active',
        ]);

        $exam = Exam::create([
            'course_id' => $course->id,
            'title' => 'Test Exam',
            'description' => 'R0 Test',
            'duration' => 60,
            'status' => 'published',
        ]);

        Question::create([
            'exam_id' => $exam->id,
            'question_text' => 'What is 2+2?',
            'question_type' => 'mcq',
            'correct_answer' => '4',
            'points' => 5,
            'sort_order' => 1,
        ]);

        // Student requests exam list → must NOT see correct_answer
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$studentToken,
            'X-Tenant-Slug' => 'r0-security',
        ])->getJson("/api/v1/courses/{$course->id}/exams");

        $response->assertStatus(200);

        // The response body must not contain the string "correct_answer"
        $this->assertStringNotContainsString(
            'correct_answer',
            $response->getContent(),
            'correct_answer must not be present in student exam response'
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // R0-3: Payment request IDOR fix
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_student_cannot_view_another_students_payment_request(): void
    {
        // BEFORE: any authenticated user could GET /payment-requests/{id}
        // AFTER:  403 if not owner and no payments.view permission

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        // Student A (owner of payment)
        $studentUserA = TenantUser::create([
            'name' => 'Student A',
            'email' => 'student-a@r0test.edu',
            'password' => Hash::make('pass'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUserA->roles()->attach($studentRole->id);
        $studentA = Student::create([
            'user_id' => $studentUserA->id,
            'student_code' => 'STU-A',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);

        // Student B (attacker)
        $studentUserB = TenantUser::create([
            'name' => 'Student B',
            'email' => 'student-b@r0test.edu',
            'password' => Hash::make('pass'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUserB->roles()->attach($studentRole->id);
        $studentB = Student::create([
            'user_id' => $studentUserB->id,
            'student_code' => 'STU-B',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);

        $tokenB = TenantToken::createTokenFor($studentUserB)['plainTextToken'];

        $package = Package::create([
            'name' => 'Test Package',
            'description' => 'Test',
            'price' => 100,
            'duration' => 30,
            'status' => 'active',
        ]);

        // Payment request belongs to Student A
        $payment = PaymentRequest::create([
            'student_id' => $studentA->id,
            'package_id' => $package->id,
            'amount' => 100,
            'currency' => 'USD',
            'payment_method' => 'bank_transfer',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        // Student B tries to view Student A's payment → must get 403
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$tokenB,
            'X-Tenant-Slug' => 'r0-security',
        ])->getJson("/api/v1/payment-requests/{$payment->id}");

        $response->assertStatus(403);
    }

    /** @test */
    public function test_student_can_view_own_payment_request(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        $studentUser = TenantUser::create([
            'name' => 'Student Owner',
            'email' => 'owner@r0test.edu',
            'password' => Hash::make('pass'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $student = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STU-OWN',
            'grade_level' => 'Grade 10',
            'status' => 'active',
        ]);
        $token = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        $package = Package::create([
            'name' => 'Package Own',
            'description' => 'Test',
            'price' => 100,
            'duration' => 30,
            'status' => 'active',
        ]);

        $payment = PaymentRequest::create([
            'student_id' => $student->id,
            'package_id' => $package->id,
            'amount' => 100,
            'currency' => 'USD',
            'payment_method' => 'bank_transfer',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Slug' => 'r0-security',
        ])->getJson("/api/v1/payment-requests/{$payment->id}");

        $response->assertStatus(200);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // R0-4: Audit logs require audit.view permission
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_student_cannot_view_audit_logs(): void
    {
        // BEFORE: any authenticated user could access audit logs
        // AFTER:  403 without audit.view permission

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        $studentRole = Role::create(['name' => 'student', 'label' => 'Student', 'is_system' => true]);

        $studentUser = TenantUser::create([
            'name' => 'Audit Attacker',
            'email' => 'attacker@r0test.edu',
            'password' => Hash::make('pass'),
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentUser->roles()->attach($studentRole->id);
        $token = TenantToken::createTokenFor($studentUser)['plainTextToken'];

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Slug' => 'r0-security',
        ])->getJson('/api/v1/audit-logs');

        $response->assertStatus(403);
    }

    /** @test */
    public function test_staff_with_audit_view_permission_can_view_audit_logs(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        $auditPerm = Permission::create(['name' => 'audit.view', 'module' => 'audit']);
        $adminRole = Role::create(['name' => 'auditor', 'label' => 'Auditor', 'is_system' => true]);
        $adminRole->permissions()->attach($auditPerm->id);

        $staffUser = TenantUser::create([
            'name' => 'Auditor Ali',
            'email' => 'ali@r0test.edu',
            'password' => Hash::make('pass'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $staffUser->roles()->attach($adminRole->id);
        Staff::create(['user_id' => $staffUser->id, 'staff_type' => 'admin', 'status' => 'active']);
        $token = TenantToken::createTokenFor($staffUser)['plainTextToken'];

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Slug' => 'r0-security',
        ])->getJson('/api/v1/audit-logs');

        $response->assertStatus(200);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // R0-5: Support exchange code is one-time use
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_support_exchange_code_can_only_be_redeemed_once(): void
    {
        // BEFORE: no exchange endpoint; token was passed directly in URL
        // AFTER:  POST /auth/support/exchange burns the code on first use; second use → 401

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        // Create a valid exchange code (simulating what SupportAccessController returns)
        $plainCode = Str::random(64);
        $codeHash = hash('sha256', $plainCode);

        SupportExchangeCode::create([
            'code_hash' => $codeHash,
            'tenant_id' => $this->tenant->id,
            'actor_id' => 1,
            'actor_type' => 'platform',
            'reason' => 'Test access for R0 verification',
            'expires_at' => now()->addMinutes(1),
            'used_at' => null,
        ]);

        // First redemption → should succeed (200)
        $firstResponse = $this->withHeaders([
            'X-Tenant-Slug' => 'r0-security',
        ])->postJson('/api/v1/auth/support/exchange', [
            'code' => $plainCode,
        ]);

        $firstResponse->assertStatus(200)
            ->assertJsonStructure(['data' => ['token']]);

        // Second redemption with same code → must be rejected (401)
        $secondResponse = $this->withHeaders([
            'X-Tenant-Slug' => 'r0-security',
        ])->postJson('/api/v1/auth/support/exchange', [
            'code' => $plainCode,
        ]);

        $secondResponse->assertStatus(401);
    }

    /** @test */
    public function test_expired_support_exchange_code_returns_401(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        $plainCode = Str::random(64);
        $codeHash = hash('sha256', $plainCode);

        // Create an already-expired code
        SupportExchangeCode::create([
            'code_hash' => $codeHash,
            'tenant_id' => $this->tenant->id,
            'actor_id' => 1,
            'actor_type' => 'platform',
            'reason' => 'Expired code test',
            'expires_at' => now()->subMinutes(5), // expired 5 minutes ago
            'used_at' => null,
        ]);

        $response = $this->withHeaders([
            'X-Tenant-Slug' => 'r0-security',
        ])->postJson('/api/v1/auth/support/exchange', [
            'code' => $plainCode,
        ]);

        $response->assertStatus(401);
    }
}
