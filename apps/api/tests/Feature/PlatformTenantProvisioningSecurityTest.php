<?php

namespace Tests\Feature;

use App\Models\PlatformUser;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PlatformTenantProvisioningSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected string $platformToken = 'platform-test-token-ps1';

    protected PlatformUser $platformAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['platform.admin_token' => $this->platformToken]);

        $this->platformAdmin = PlatformUser::create([
            'email' => 'superadmin@platform.test',
            'name' => 'Super Admin',
            'password' => 'SecurePass1234!',
            'role' => 'platform_super_admin',
            'is_active' => true,
        ]);
    }

    protected function tearDown(): void
    {
        // Clean up test sqlite database files
        $databases = DB::table('tenant_databases')->pluck('connection_identifier');
        foreach ($databases as $conn) {
            DB::disconnect($conn);
            $file = database_path("tenants/{$conn}.sqlite");
            if (file_exists($file)) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }

    protected function platformHeaders(): array
    {
        return [
            'Authorization' => 'Bearer '.$this->platformToken,
            'Accept' => 'application/json',
        ];
    }

    /**
     * Test: Creating a tenant without an owner password is rejected with 422.
     */
    public function test_creating_tenant_without_password_is_rejected_with_422(): void
    {
        $payload = [
            'name' => 'Al-Noor Academy',
            'slug' => 'al-noor-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'academy',
            'owner' => [
                'name' => 'Sheikh Ahmed',
                'email' => 'ahmed@alnoor.test',
                // password omitted intentionally!
            ],
        ];

        $response = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);

        $response->assertStatus(422);
        $this->assertEquals('VALIDATION_FAILED', $response->json('error.code'));
        $details = (array) $response->json('error.details');
        $this->assertArrayHasKey('owner.password', $details);
    }

    /**
     * Test: Creating a tenant with an empty owner password is rejected with 422.
     */
    public function test_creating_tenant_with_empty_password_is_rejected_with_422(): void
    {
        $payload = [
            'name' => 'Al-Noor Academy',
            'slug' => 'al-noor-'.uniqid(),
            'type' => 'individual_teacher',
            'owner' => [
                'name' => 'Teacher Tariq',
                'email' => 'tariq@test.com',
                'password' => '', // empty password!
            ],
        ];

        $response = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);

        $response->assertStatus(422);
        $this->assertEquals('VALIDATION_FAILED', $response->json('error.code'));
        $details = (array) $response->json('error.details');
        $this->assertArrayHasKey('owner.password', $details);
    }

    /**
     * Test: Creating a tenant with an invalid type returns 422.
     */
    public function test_creating_tenant_with_invalid_type_returns_422(): void
    {
        $payload = [
            'name' => 'Invalid Type Academy',
            'slug' => 'invalid-'.uniqid(),
            'type' => 'مدرسة خاصة / دولية', // free-form / invalid value
            'owner' => [
                'name' => 'Owner',
                'email' => 'owner@test.com',
                'password' => 'SecurePass1234!',
            ],
        ];

        $response = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);

        $response->assertStatus(422);
        $this->assertEquals('VALIDATION_FAILED', $response->json('error.code'));
        $details = (array) $response->json('error.details');
        $this->assertArrayHasKey('type', $details);
    }

    /**
     * Test: Updating a tenant with an invalid type returns 422.
     */
    public function test_updating_tenant_with_invalid_type_returns_422(): void
    {
        $slug = 'valid-'.uniqid();
        $createRes = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', [
            'name' => 'Valid Tenant',
            'slug' => $slug,
            'type' => 'individual_teacher',
            'owner' => [
                'name' => 'Owner',
                'email' => "owner@{$slug}.test",
                'password' => 'SecurePass1234!',
            ],
        ]);
        $createRes->assertCreated();
        $tenantId = $createRes->json('data.tenant.id');

        $updateRes = $this->withHeaders($this->platformHeaders())->putJson("/api/v1/tenants/{$tenantId}", [
            'type' => 'completely_invalid_type_123',
        ]);

        $updateRes->assertStatus(422);
        $this->assertEquals('VALIDATION_FAILED', $updateRes->json('error.code'));
        $details = (array) $updateRes->json('error.details');
        $this->assertArrayHasKey('type', $details);
    }

    /**
     * Test: Valid OD-23 types (individual_teacher, organization) succeed.
     */
    public function test_creating_tenant_with_valid_od23_types_succeeds(): void
    {
        // 1. individual_teacher
        $slug1 = 'teacher-'.uniqid();
        $res1 = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', [
            'name' => 'الأستاذ أحمد فؤاد',
            'slug' => $slug1,
            'type' => 'individual_teacher',
            'owner' => [
                'name' => 'أحمد فؤاد',
                'email' => "ahmed@{$slug1}.test",
                'password' => 'SecurePass1234!',
            ],
        ]);
        $res1->assertCreated()
            ->assertJsonPath('data.tenant.type', 'individual_teacher');

        // 2. organization with organization_kind
        $slug2 = 'org-'.uniqid();
        $res2 = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', [
            'name' => 'مركز الفلاح التعليمي',
            'slug' => $slug2,
            'type' => 'organization',
            'organization_kind' => 'center',
            'owner' => [
                'name' => 'إدارة الفلاح',
                'email' => "admin@{$slug2}.test",
                'password' => 'SecurePass1234!',
            ],
        ]);
        $res2->assertCreated()
            ->assertJsonPath('data.tenant.type', 'organization');
    }

    /**
     * Test: Custom domain is saved in tenant_domains and resolved.
     */
    public function test_creating_tenant_persists_custom_domain(): void
    {
        $slug = 'custom-dom-'.uniqid();
        $customDomain = "{$slug}.edu.sa";

        $response = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', [
            'name' => 'Custom Domain Academy',
            'slug' => $slug,
            'type' => 'organization',
            'domain' => $customDomain,
            'owner' => [
                'name' => 'Admin User',
                'email' => "admin@{$slug}.test",
                'password' => 'SecurePass1234!',
            ],
        ]);

        $response->assertCreated();
        $tenantId = $response->json('data.tenant.id');

        $this->assertDatabaseHas('tenant_domains', [
            'tenant_id' => $tenantId,
            'domain' => $customDomain,
            'type' => 'custom',
            'active' => true,
        ]);

        $this->assertDatabaseHas('tenant_domains', [
            'tenant_id' => $tenantId,
            'domain' => "{$slug}.localhost",
            'type' => 'subdomain',
        ]);
    }

    /**
     * Test: Verification that no 'password123' default exists in the tenant creation code.
     */
    public function test_no_password123_default_exists_in_tenant_creation_code(): void
    {
        $modalFile = base_path('../web/src/features/platform/components/create-tenant-modal.tsx');
        $pageFile = base_path('../web/src/app/platform/tenants/page.tsx');

        $this->assertFileExists($modalFile);
        $this->assertFileExists($pageFile);

        $modalContent = file_get_contents($modalFile);
        $pageContent = file_get_contents($pageFile);

        $this->assertStringNotContainsString('password123', $modalContent, 'create-tenant-modal.tsx must not contain password123 default or placeholder');
        $this->assertStringNotContainsString('password123', $pageContent, 'platform/tenants/page.tsx must not default to password123');
    }
}
