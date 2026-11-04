<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\User;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SupportAccessGateTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected User $platformUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'slug' => 'test-support',
            'name' => 'Test Support Academy',
            'type' => 'school',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => 'tenant_'.$this->tenant->slug,
            'status' => 'ready',
        ]);

        TenantDomain::create([
            'tenant_id' => $this->tenant->id,
            'domain' => 'test-support.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);

        // Platform Admin (Global DB)
        $this->platformUser = User::create([
            'name' => 'Global Support',
            'email' => 'admin@platform.com',
            'password' => 'secret',
        ]);
    }

    protected function tearDown(): void
    {
        app(TenantDatabaseManager::class)->configureConnection($this->tenant);
        DB::disconnect('tenant_'.$this->tenant->slug);

        $dbPath = database_path('tenants/tenant_'.$this->tenant->slug.'.sqlite');
        if (file_exists($dbPath)) {
            @unlink($dbPath);
        }

        parent::tearDown();
    }

    public function test_can_generate_support_access_token()
    {
        $platformToken = 'support-gate-platform-token-secret';
        config(['platform.admin_token' => $platformToken]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$platformToken,
        ])->postJson("/api/v1/tenants/{$this->tenant->id}/support-access", [
            'reason' => 'Debugging payment gateway issue.',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'message',
                    'tenant',
                    'support_code',
                    'support_code_ttl',
                    'audit_log_id',
                ],
            ]);

        // Verify the audit log was created in the global DB
        $this->assertDatabaseHas('support_access_logs', [
            'tenant_id' => $this->tenant->id,
            'reason' => 'Debugging payment gateway issue.',
        ]);

        $supportCode = $response->json('data.support_code');

        // Exchange code for tenant bearer token
        $exchangeResponse = $this->withHeaders([
            'X-Tenant-Slug' => $this->tenant->slug,
        ])->postJson('/api/v1/auth/support/exchange', [
            'code' => $supportCode,
        ]);

        $exchangeResponse->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'token',
                    'expires_at',
                ],
            ]);

        // Verify the support user was created in the tenant DB
        app(TenantDatabaseManager::class)->configureConnection($this->tenant);
        $this->assertDatabaseHas('tenant_users', [
            'email' => 'support@platform.local',
            'type' => 'support',
        ], 'tenant');
    }
}
