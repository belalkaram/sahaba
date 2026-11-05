<?php

namespace Tests\Feature;

use App\Models\PlatformRole;
use App\Models\PlatformToken;
use App\Models\PlatformUser;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantFeature;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TenantTypeProfileTest extends TestCase
{
    use RefreshDatabase;

    protected string $platformToken;

    protected PlatformUser $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cleanupTenantDbs();

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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'tenant_type_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    protected function platformHeaders(): array
    {
        return [
            'Authorization' => 'Bearer '.$this->platformToken,
        ];
    }

    public function test_provision_individual_teacher_has_restricted_roles_and_teacher_staff(): void
    {
        $slug = 'type-tchr-'.uniqid();
        $payload = [
            'name' => 'الأستاذ أحمد فؤاد',
            'slug' => $slug,
            'type' => 'individual_teacher',
            'city' => 'الرياض',
            'contact_phone' => '+966500000001',
            'services' => ['online'],
            'owner' => [
                'name' => 'أحمد فؤاد',
                'email' => 'ahmed.'.uniqid().'@teacher.local',
                'password' => 'ValidPassword123!',
            ],
        ];

        $res = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);
        $res->assertStatus(201);

        $tenantId = $res->json('data.tenant.id');
        $tenant = Tenant::findOrFail($tenantId);

        $this->assertSame('individual_teacher', $tenant->type);
        $this->assertNull($tenant->organization_kind);
        $this->assertSame('الرياض', $tenant->city);
        $this->assertSame(['online'], $tenant->services);

        // Connect to tenant DB and inspect roles & staff
        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);

        $roles = Role::pluck('name')->all();
        $expectedRoles = ['owner', 'assistant', 'student', 'parent'];
        sort($roles);
        sort($expectedRoles);
        $this->assertSame($expectedRoles, $roles, 'Individual teacher must only have 4 roles');

        // Staff profile must be teacher
        $staff = Staff::first();
        $this->assertNotNull($staff);
        $this->assertSame('teacher', $staff->staff_type);
    }

    public function test_provision_organization_has_all_roles_and_admin_staff(): void
    {
        $slug = 'type-org-'.uniqid();
        $payload = [
            'name' => 'مركز النخبة التعليمي',
            'slug' => $slug,
            'type' => 'organization',
            'organization_kind' => 'center',
            'city' => 'جدة',
            'contact_phone' => '+966500000002',
            'services' => ['online', 'offline'],
            'owner' => [
                'name' => 'المدير العام',
                'email' => 'admin.'.uniqid().'@center.local',
                'password' => 'ValidPassword123!',
            ],
        ];

        $res = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);
        $res->assertStatus(201);

        $tenantId = $res->json('data.tenant.id');
        $tenant = Tenant::findOrFail($tenantId);

        $this->assertSame('organization', $tenant->type);
        $this->assertSame('center', $tenant->organization_kind);
        $this->assertSame('جدة', $tenant->city);
        $this->assertSame(['online', 'offline'], $tenant->services);

        // Connect to tenant DB and inspect roles & staff
        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);

        $roles = Role::pluck('name')->all();
        $expectedRoles = ['owner', 'center_admin', 'branch_manager', 'teacher', 'assistant', 'finance', 'student', 'parent'];
        sort($roles);
        sort($expectedRoles);
        $this->assertSame($expectedRoles, $roles, 'Organization must have all 8 roles');

        // Staff profile must be admin
        $staff = Staff::first();
        $this->assertNotNull($staff);
        $this->assertSame('admin', $staff->staff_type);
    }

    public function test_validation_rejects_invalid_tenant_type(): void
    {
        $payload = [
            'name' => 'جهة غير صالحة',
            'slug' => 'invalid-type-'.uniqid(),
            'type' => 'unsupported_archetype',
            'owner' => [
                'name' => 'فرد',
                'email' => 'invalid.'.uniqid().'@test.local',
                'password' => 'ValidPassword123!',
            ],
        ];

        $res = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);
        $res->assertStatus(422);
        $this->assertEquals('VALIDATION_FAILED', $res->json('error.code'));
        $this->assertArrayHasKey('type', (array) $res->json('error.details'));
    }

    public function test_validation_rejects_invalid_organization_kind(): void
    {
        $payload = [
            'name' => 'مؤسسة غير صالحة',
            'slug' => 'invalid-kind-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'university_campus',
            'owner' => [
                'name' => 'مشرف',
                'email' => 'invalid.'.uniqid().'@test.local',
                'password' => 'ValidPassword123!',
            ],
        ];

        $res = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);
        $res->assertStatus(422);
        $this->assertEquals('VALIDATION_FAILED', $res->json('error.code'));
        $this->assertArrayHasKey('organization_kind', (array) $res->json('error.details'));
    }

    public function test_service_bundling_enables_and_disables_modules(): void
    {
        $slug = 'serv-bundle-'.uniqid();
        $payload = [
            'name' => 'أكاديمية عن بعد',
            'slug' => $slug,
            'type' => 'organization',
            'organization_kind' => 'academy',
            'services' => ['online'],
            'owner' => [
                'name' => 'مشرف عن بعد',
                'email' => 'online.'.uniqid().'@academy.local',
                'password' => 'ValidPassword123!',
            ],
        ];

        $res = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);
        $res->assertStatus(201);

        $tenantId = $res->json('data.tenant.id');

        $features = TenantFeature::where('tenant_id', $tenantId)->get()->keyBy('feature_key');

        // Online features enabled
        $this->assertTrue((bool) $features['online']->enabled);

        // Offline features disabled
        $this->assertFalse((bool) $features['offline']->enabled);
    }

    public function test_convert_individual_teacher_to_organization(): void
    {
        // 1. Provision individual teacher
        $slug = 'convert-test-'.uniqid();
        $payload = [
            'name' => 'المعلم علي سالم',
            'slug' => $slug,
            'type' => 'individual_teacher',
            'owner' => [
                'name' => 'علي سالم',
                'email' => 'ali.'.uniqid().'@teacher.local',
                'password' => 'ValidPassword123!',
            ],
        ];

        $res = $this->withHeaders($this->platformHeaders())->postJson('/api/v1/tenants', $payload);
        $res->assertStatus(201);
        $tenantId = $res->json('data.tenant.id');
        $tenant = Tenant::findOrFail($tenantId);

        // Verify pre-conversion role count
        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $this->assertCount(4, Role::all());

        // 2. Convert to organization
        $convertRes = $this->withHeaders($this->platformHeaders())->postJson("/api/v1/tenants/{$tenantId}/convert-to-organization", [
            'organization_kind' => 'center',
        ]);

        $convertRes->assertStatus(200);
        $this->assertSame('organization', $convertRes->json('data.tenant.type'));
        $this->assertSame('center', $convertRes->json('data.tenant.organization_kind'));

        // 3. Verify roles expanded to all 8 roles without data loss
        $dbManager->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $this->assertCount(8, Role::all());
        $this->assertNotNull(Role::where('name', 'center_admin')->first());
        $this->assertNotNull(Role::where('name', 'branch_manager')->first());
    }

    public function test_tenant_current_endpoint_returns_profile_and_services(): void
    {
        $tenant = Tenant::create([
            'name' => 'معهد الفلاح',
            'slug' => 'al-falah-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'institute',
            'city' => 'الدمام',
            'contact_phone' => '+966500000003',
            'status' => 'active',
        ]);

        TenantFeature::create([
            'tenant_id' => $tenant->id,
            'feature_key' => 'attendance',
            'enabled' => true,
        ]);

        $res = $this->getJson('/api/v1/tenant/current', [
            'X-Tenant-Slug' => $tenant->slug,
        ]);

        $res->assertStatus(200);
        $res->assertJsonPath('data.type', 'organization');
        $res->assertJsonPath('data.organization_kind', 'institute');
        $res->assertJsonPath('data.city', 'الدمام');
        $res->assertJsonPath('data.contact_phone', '+966500000003');
        $this->assertSame(['offline'], $res->json('data.services'));
    }
}
