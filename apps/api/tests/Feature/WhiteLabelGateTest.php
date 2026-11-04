<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WhiteLabelGateTest extends TestCase
{
    use RefreshDatabase;

    protected string $platformToken = 'whitelabel-gate-platform-token-secret';

    protected function setUp(): void
    {
        parent::setUp();
        config(['platform.admin_token' => $this->platformToken]);
    }

    protected function platformHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->platformToken];
    }

    public function test_can_provision_tenant_with_custom_branding()
    {
        $payload = [
            'name' => 'Al-Noor Academy',
            'slug' => 'al-noor',
            'type' => 'educational_center',
            'logo_url' => 'https://assets.example.com/logos/al-noor.png',
            'primary_color' => '#8b5cf6',
            'secondary_color' => '#ec4899',
            'brand_tagline' => 'منصة النور للتعليم المتميز',
            'brand_settings' => [
                'font' => 'IBM Plex Sans Arabic',
                'custom_css' => ':root { --radius: 12px; }',
            ],
        ];

        $response = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('data.tenant.logo_url', 'https://assets.example.com/logos/al-noor.png')
            ->assertJsonPath('data.tenant.primary_color', '#8b5cf6')
            ->assertJsonPath('data.tenant.secondary_color', '#ec4899')
            ->assertJsonPath('data.tenant.brand_tagline', 'منصة النور للتعليم المتميز');

        $this->assertDatabaseHas('tenants', [
            'slug' => 'al-noor',
            'primary_color' => '#8b5cf6',
            'secondary_color' => '#ec4899',
            'brand_tagline' => 'منصة النور للتعليم المتميز',
        ]);

        // Cleanup created tenant sqlite database file
        $dbPath = database_path('tenants/tenant_al-noor.sqlite');
        if (file_exists($dbPath)) {
            DB::disconnect('tenant_al-noor');
            @unlink($dbPath);
        }
    }

    public function test_can_update_tenant_branding()
    {
        $tenant = Tenant::create([
            'name' => 'Initial Name',
            'slug' => 'initial-slug',
            'type' => 'individual_teacher',
            'status' => 'active',
            'primary_color' => '#04c3c9',
        ]);

        $updatePayload = [
            'name' => 'Updated Academy Name',
            'logo_url' => 'https://assets.example.com/new-logo.svg',
            'primary_color' => '#f59e0b',
            'secondary_color' => '#10b981',
            'brand_tagline' => 'الريادة في تعليم المستقبل',
        ];

        $response = $this->withHeaders($this->platformHeaders())->putJson("/api/v1/tenants/{$tenant->id}", $updatePayload);

        $response->assertStatus(200)
            ->assertJsonPath('data.tenant.name', 'Updated Academy Name')
            ->assertJsonPath('data.tenant.primary_color', '#f59e0b')
            ->assertJsonPath('data.tenant.secondary_color', '#10b981')
            ->assertJsonPath('data.tenant.brand_tagline', 'الريادة في تعليم المستقبل');

        $this->assertDatabaseHas('tenants', [
            'id' => $tenant->id,
            'name' => 'Updated Academy Name',
            'primary_color' => '#f59e0b',
            'brand_tagline' => 'الريادة في تعليم المستقبل',
        ]);
    }

    public function test_current_tenant_endpoint_reflects_white_label_branding()
    {
        $tenant = Tenant::create([
            'name' => 'Branded School',
            'slug' => 'branded-school',
            'type' => 'school',
            'status' => 'active',
            'logo_url' => 'https://example.com/school-logo.png',
            'primary_color' => '#3b82f6',
            'secondary_color' => '#6366f1',
            'brand_tagline' => 'شعار الأكاديمية الخاص',
        ]);

        TenantDomain::create([
            'tenant_id' => $tenant->id,
            'domain' => 'branded-school.localhost',
            'active' => true,
        ]);

        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => 'tenant_branded-school',
            'status' => 'ready',
        ]);

        $response = $this->withHeaders([
            'X-Tenant-Slug' => 'branded-school',
        ])->getJson('/api/v1/tenant/current');

        $response->assertStatus(200)
            ->assertJsonPath('data.name', 'Branded School')
            ->assertJsonPath('data.logo_url', 'https://example.com/school-logo.png')
            ->assertJsonPath('data.primary_color', '#3b82f6')
            ->assertJsonPath('data.secondary_color', '#6366f1')
            ->assertJsonPath('data.brand_tagline', 'شعار الأكاديمية الخاص');
    }
}
