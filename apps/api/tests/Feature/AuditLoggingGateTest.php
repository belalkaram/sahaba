<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuditLoggingGateTest extends TestCase
{
    use RefreshDatabase;

    protected string $platformToken = 'audit-gate-platform-token-secret';

    protected function setUp(): void
    {
        parent::setUp();
        config(['platform.admin_token' => $this->platformToken]);
    }

    protected function platformHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->platformToken];
    }

    public function test_audit_logger_records_event_accurately()
    {
        $log = AuditLogger::log(
            action: 'security.firewall_triggered',
            tenantId: null,
            entityType: 'IpBlock',
            entityId: '192.168.1.1',
            payload: ['attempt_count' => 5],
            actorType: 'system'
        );

        $this->assertNotNull($log);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'security.firewall_triggered',
            'actor_type' => 'system',
            'entity_type' => 'IpBlock',
        ]);
    }

    public function test_tenant_creation_and_update_produce_audit_logs()
    {
        $payload = [
            'name' => 'Audit Academy',
            'slug' => 'audit-academy',
            'type' => 'school',
        ];

        $res = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);
        $res->assertStatus(201);
        $tenantId = $res->json('data.tenant.id');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'tenant.created',
            'tenant_id' => $tenantId,
            'actor_type' => 'platform_admin',
        ]);

        // Now update
        $updateRes = $this->withHeaders($this->platformHeaders())->putJson("/api/v1/tenants/{$tenantId}", [
            'name' => 'Updated Audit Academy',
            'primary_color' => '#123456',
        ]);
        $updateRes->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'tenant.updated',
            'tenant_id' => $tenantId,
        ]);

        // Cleanup created tenant sqlite database file
        $dbPath = database_path('tenants/tenant_audit-academy.sqlite');
        if (file_exists($dbPath)) {
            DB::disconnect('tenant_audit-academy');
            @unlink($dbPath);
        }
    }

    public function test_platform_can_query_and_filter_centralized_audit_logs()
    {
        AuditLog::create([
            'action' => 'test.action.one',
            'actor_type' => 'platform_admin',
            'created_at' => now(),
        ]);

        AuditLog::create([
            'action' => 'test.action.two',
            'actor_type' => 'system',
            'created_at' => now(),
        ]);

        $res = $this->withHeaders($this->platformHeaders())->getJson('/api/v1/platform/audit-logs?action=test.action.one');
        $res->assertStatus(200)
            ->assertJsonPath('data.pagination.total', 1)
            ->assertJsonPath('data.audit_logs.0.action', 'test.action.one');
    }

    public function test_tenant_audit_logs_endpoint_enforces_tenant_isolation()
    {
        $tenantA = Tenant::create([
            'name' => 'Tenant A',
            'slug' => 'tenant-a',
            'type' => 'school',
            'status' => 'active',
        ]);
        TenantDomain::create(['tenant_id' => $tenantA->id, 'domain' => 'tenant-a.localhost', 'active' => true]);
        TenantDatabase::create(['tenant_id' => $tenantA->id, 'connection_identifier' => 'tenant_'.$tenantA->slug, 'status' => 'ready']);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($tenantA);
        $dbManager->configureConnection($tenantA);

        $tenantB = Tenant::create([
            'name' => 'Tenant B',
            'slug' => 'tenant-b',
            'type' => 'school',
            'status' => 'active',
        ]);

        // Create log for A and log for B
        AuditLog::create([
            'tenant_id' => $tenantA->id,
            'action' => 'tenant.a.action',
            'actor_type' => 'user',
            'created_at' => now(),
        ]);

        AuditLog::create([
            'tenant_id' => $tenantB->id,
            'action' => 'tenant.b.action',
            'actor_type' => 'user',
            'created_at' => now(),
        ]);

        // Authenticate a user in Tenant A with audit.view permission (R0-4)
        $perm = Permission::firstOrCreate(['name' => 'audit.view'], ['module' => 'audit']);
        $role = Role::firstOrCreate(['name' => 'auditor'], ['label' => 'Auditor', 'is_system' => true]);
        if (! $role->permissions()->where('permissions.id', $perm->id)->exists()) {
            $role->permissions()->attach($perm->id);
        }

        $user = TenantUser::create([
            'name' => 'Admin User A',
            'email' => 'admin@tenant-a.local',
            'password' => 'secret',
            'type' => 'staff',
            'status' => 'active',
        ]);
        $user->roles()->attach($role->id);
        $tokenData = TenantToken::createTokenFor($user, 'test_token');

        $res = $this->withHeaders([
            'X-Tenant-Slug' => 'tenant-a',
            'Authorization' => "Bearer {$tokenData['plainTextToken']}",
        ])->getJson('/api/v1/audit-logs');

        $res->assertStatus(200);
        $logs = $res->json('data.audit_logs');
        $this->assertCount(1, $logs);
        $this->assertEquals('tenant.a.action', $logs[0]['action']);

        // Teardown sqlite DB
        DB::disconnect('tenant_'.$tenantA->slug);
        $dbPath = database_path('tenants/tenant_'.$tenantA->slug.'.sqlite');
        if (file_exists($dbPath)) {
            @unlink($dbPath);
        }
    }
}
