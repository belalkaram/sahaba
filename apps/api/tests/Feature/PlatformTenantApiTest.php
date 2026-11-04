<?php

namespace Tests\Feature;

use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PlatformTenantApiTest extends TestCase
{
    use RefreshDatabase;

    protected string $platformToken = 'test-platform-admin-token-for-tests';

    protected function setUp(): void
    {
        parent::setUp();
        config(['platform.admin_token' => $this->platformToken]);
    }

    protected function platformHeaders(): array
    {
        return [
            'Authorization' => 'Bearer '.$this->platformToken,
        ];
    }

    public function test_can_list_tenants()
    {
        $tenant = Tenant::create([
            'name' => 'Test Tenant',
            'slug' => 'test-tenant',
            'type' => 'school',
            'status' => 'active',
        ]);

        $response = $this->withHeaders($this->platformHeaders())->getJson('/api/v1/tenants');

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['tenants']]);

        $this->assertGreaterThan(0, count($response->json('data.tenants')));
    }

    public function test_can_provision_new_tenant()
    {
        $payload = [
            'name' => 'New Academy',
            'slug' => 'new-academy',
            'type' => 'university',
        ];

        $response = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'tenant' => ['id', 'name', 'slug', 'type'],
                ],
            ]);

        $this->assertDatabaseHas('tenants', [
            'slug' => 'new-academy',
        ]);

        $this->assertDatabaseHas('tenant_databases', [
            'connection_identifier' => 'tenant_new-academy',
        ]);

        $this->assertDatabaseHas('tenant_domains', [
            'domain' => 'new-academy.localhost',
        ]);

        // Clean up the created sqlite db file
        $dbConfig = DB::table('tenant_databases')->where('connection_identifier', 'tenant_new-academy')->first();
        if ($dbConfig) {
            $dbPath = database_path('tenants/tenant_new-academy.sqlite');
            if (file_exists($dbPath)) {
                DB::disconnect('tenant_new-academy');
                @unlink($dbPath);
            }
        }
    }
}
