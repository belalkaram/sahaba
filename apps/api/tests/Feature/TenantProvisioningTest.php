<?php

namespace Tests\Feature;

use App\Models\PlatformRole;
use App\Models\PlatformToken;
use App\Models\PlatformUser;
use App\Models\Tenant;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TenantProvisioningTest extends TestCase
{
    use RefreshDatabase;

    protected string $platformToken;

    protected PlatformUser $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cleanupTenantDbs();

        // Setup platform super admin
        $superAdminRole = PlatformRole::firstOrCreate(
            ['name' => 'super_admin'],
            ['label' => 'Super Administrator', 'description' => 'Full access', 'permissions' => ['*']]
        );

        $this->superAdmin = PlatformUser::create([
            'name' => 'Platform Super Admin',
            'email' => 'superadmin@system.local',
            'password' => Hash::make('secret_platform_pass'),
            'role_id' => $superAdminRole->id,
            'status' => 'active',
        ]);

        $tokenData = PlatformToken::createTokenFor($this->superAdmin, 'Test Token');
        $this->platformToken = $tokenData['plainTextToken'];
    }

    protected function tearDown(): void
    {
        $this->cleanupTenantDbs();
        parent::tearDown();
    }

    protected function cleanupTenantDbs(): void
    {
        app(TenantDatabaseManager::class)->purgeConnection();
        $dir = database_path('tenants');
        if (is_dir($dir)) {
            foreach (glob($dir.DIRECTORY_SEPARATOR.'tenant_prov_*.sqlite') as $file) {
                @unlink($file);
            }
            foreach (glob($dir.DIRECTORY_SEPARATOR.'tenant_reg_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_tenant_provisioning_creates_control_and_tenant_records_with_owner(): void
    {
        $slug = 'prov-'.uniqid();
        $response = $this->withHeaders([
            'Authorization' => "Bearer {$this->platformToken}",
        ])->postJson('/api/v1/tenants', [
            'name' => 'Prov Academy',
            'slug' => $slug,
            'type' => 'school',
            'owner' => [
                'name' => 'Prov Owner',
                'email' => "owner@{$slug}.test",
                'password' => 'OwnerPass123',
            ],
            'modules' => ['courses', 'attendance', 'offline'],
        ]);

        $response->assertCreated();
        $tenantData = $response->json('data.tenant');
        $this->assertEquals($slug, $tenantData['slug']);
        $this->assertEquals('active', $tenantData['status']);

        // Control DB records
        $this->assertDatabaseHas('tenants', ['slug' => $slug]);
        $this->assertDatabaseHas('tenant_databases', ['connection_identifier' => "tenant_{$slug}"]);
        $this->assertDatabaseHas('tenant_domains', ['domain' => "{$slug}.localhost"]);
        $this->assertDatabaseHas('tenant_features', ['feature_key' => 'courses', 'enabled' => true]);

        // Owner can login immediately to the new tenant
        $loginRes = $this->withHeaders([
            'X-Tenant' => $slug,
        ])->postJson('/api/v1/auth/login', [
            'identifier' => "owner@{$slug}.test",
            'password' => 'OwnerPass123',
        ]);

        $loginRes->assertOk();
        $token = $loginRes->json('data.token');
        $this->assertNotNull($token);

        // /auth/me returns owner role and admin experience
        $meRes = $this->withHeaders([
            'X-Tenant' => $slug,
            'Authorization' => "Bearer {$token}",
        ])->getJson('/api/v1/auth/me');

        $meRes->assertOk();
        $this->assertEquals('admin', $meRes->json('data.experience'));
        $this->assertEquals('Prov Owner', $meRes->json('data.user.name'));
    }

    public function test_self_service_registration_creates_active_tenant(): void
    {
        $slug = 'reg-'.uniqid();
        $response = $this->postJson('/api/v1/public/register-school', [
            'school_name' => 'Self Registered Academy',
            'slug' => $slug,
            'type' => 'school',
            'admin_name' => 'Principal Huda',
            'admin_email' => "huda@{$slug}.test",
            'password' => 'PrincipalPass123',
        ]);

        $response->assertCreated();
        $this->assertEquals($slug, $response->json('data.tenant.slug'));
        $this->assertEquals("/login?tenant={$slug}", $response->json('data.login_url'));

        // Can log in
        $loginRes = $this->withHeaders([
            'X-Tenant' => $slug,
        ])->postJson('/api/v1/auth/login', [
            'identifier' => "huda@{$slug}.test",
            'password' => 'PrincipalPass123',
        ]);
        $loginRes->assertOk();
    }

    public function test_registration_rejects_reserved_slug_and_honeypot(): void
    {
        // 1. Reserved slug
        $reservedRes = $this->postJson('/api/v1/public/register-school', [
            'school_name' => 'Admin Academy',
            'slug' => 'admin',
            'admin_name' => 'Admin',
            'admin_email' => 'admin@admin.com',
            'password' => 'password123',
        ]);
        $reservedRes->assertStatus(422);

        // 2. Honeypot filled
        $spamRes = $this->postJson('/api/v1/public/register-school', [
            'school_name' => 'Spam Academy',
            'slug' => 'spam-academy',
            'admin_name' => 'Spammer',
            'admin_email' => 'spam@spam.com',
            'password' => 'password123',
            '_hp' => 'I am a bot',
        ]);
        $spamRes->assertStatus(422);
        $this->assertEquals('SPAM_DETECTED', $spamRes->json('error.code'));
    }

    public function test_platform_metrics_and_tenant_suspension(): void
    {
        $slug = 'prov-'.uniqid();
        $tenantRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->platformToken}",
        ])->postJson('/api/v1/tenants', [
            'name' => 'Metric School',
            'slug' => $slug,
            'type' => 'school',
            'owner' => [
                'name' => 'Metric Owner',
                'email' => "metric@{$slug}.test",
                'password' => 'Secret123',
            ],
        ]);
        $tenantId = $tenantRes->json('data.tenant.id');

        // Suspend tenant
        $suspendRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->platformToken}",
        ])->postJson("/api/v1/tenants/{$tenantId}/suspend");
        $suspendRes->assertOk();
        $this->assertEquals('suspended', $suspendRes->json('data.tenant.status'));

        // Activate tenant
        $activateRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->platformToken}",
        ])->postJson("/api/v1/tenants/{$tenantId}/activate");
        $activateRes->assertOk();
        $this->assertEquals('active', $activateRes->json('data.tenant.status'));

        // Update modules
        $moduleRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->platformToken}",
        ])->putJson("/api/v1/tenants/{$tenantId}/modules", [
            'modules' => ['courses', 'attendance'],
        ]);
        $moduleRes->assertOk();

        // Metrics are read from snapshots computed by the scheduled job (R8-7)
        $this->artisan('lms:refresh-platform-metrics')->assertSuccessful();

        // Get platform metrics
        $metricsRes = $this->withHeaders([
            'Authorization' => "Bearer {$this->platformToken}",
        ])->getJson('/api/v1/platform/metrics');
        $metricsRes->assertOk();
        $this->assertGreaterThanOrEqual(1, $metricsRes->json('data.summary.total_tenants'));
        $this->assertNotEmpty($metricsRes->json('data.tenants'));
    }
}
