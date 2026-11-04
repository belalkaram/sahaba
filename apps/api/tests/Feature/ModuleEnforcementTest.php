<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * ModuleEnforcementTest (R1-A5)
 *
 * Verifies that the tenant.module:<key> middleware strictly enforces organization-level
 * module enablement. When a module is disabled in tenant_features:
 *  - Routes in that module return 403 Forbidden with error "MODULE_DISABLED".
 *  - Core routes (/auth/me, /students) remain accessible.
 */
class ModuleEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected TenantUser $adminUser;

    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'module_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'Module Test Org',
            'slug' => 'module-org',
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
            'domain' => 'module-org.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        // Sync standard catalog system roles
        app(RoleSynchronizer::class)->sync();

        $this->adminUser = TenantUser::create([
            'name' => 'Module Admin',
            'email' => 'admin@module-org.test',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);

        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $this->adminUser->roles()->attach($ownerRole->id);

        $tokenResult = TenantToken::createTokenFor($this->adminUser);
        $this->token = $tokenResult['plainTextToken'];
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'module_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_offline_module_accessible_when_enabled(): void
    {
        TenantFeature::create([
            'tenant_id' => $this->tenant->id,
            'feature_key' => 'offline',
            'enabled' => true,
        ]);

        $response = $this->withHeaders([
            'X-Tenant' => 'module-org',
            'Authorization' => 'Bearer '.$this->token,
        ])->getJson('/api/v1/classes');

        $response->assertStatus(200);
    }

    public function test_offline_module_returns_403_module_disabled_when_toggled_off(): void
    {
        TenantFeature::create([
            'tenant_id' => $this->tenant->id,
            'feature_key' => 'offline',
            'enabled' => false,
        ]);

        $response = $this->withHeaders([
            'X-Tenant' => 'module-org',
            'Authorization' => 'Bearer '.$this->token,
        ])->getJson('/api/v1/classes');

        $response->assertStatus(403);
        $response->assertJson([
            'error' => [
                'code' => 'MODULE_DISABLED',
            ],
        ]);
        $this->assertStringContainsString('offline', $response->json('error.message'));
    }

    public function test_billing_module_returns_403_when_disabled(): void
    {
        TenantFeature::create([
            'tenant_id' => $this->tenant->id,
            'feature_key' => 'billing',
            'enabled' => false,
        ]);

        $response = $this->withHeaders([
            'X-Tenant' => 'module-org',
            'Authorization' => 'Bearer '.$this->token,
        ])->getJson('/api/v1/packages');

        $response->assertStatus(403);
        $response->assertJson([
            'error' => [
                'code' => 'MODULE_DISABLED',
            ],
        ]);
    }

    public function test_core_endpoints_remain_accessible_when_optional_modules_are_disabled(): void
    {
        foreach (['online', 'offline', 'assessment', 'billing', 'credentials', 'analytics'] as $mod) {
            TenantFeature::create([
                'tenant_id' => $this->tenant->id,
                'feature_key' => $mod,
                'enabled' => false,
            ]);
        }

        // Core students endpoint should still respond 200
        $response = $this->withHeaders([
            'X-Tenant' => 'module-org',
            'Authorization' => 'Bearer '.$this->token,
        ])->getJson('/api/v1/students');

        $response->assertStatus(200);

        // Core auth/me endpoint should still respond 200
        $meResponse = $this->withHeaders([
            'X-Tenant' => 'module-org',
            'Authorization' => 'Bearer '.$this->token,
        ])->getJson('/api/v1/auth/me');

        $meResponse->assertStatus(200);
    }
}
