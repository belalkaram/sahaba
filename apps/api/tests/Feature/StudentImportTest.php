<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Role;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StudentImportTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected string $tenantConn;

    protected TenantUser $adminUser;

    protected string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'import_test_'.uniqid();
        $this->cleanupTenantDb();

        $this->tenant = Tenant::create([
            'name' => 'Import Academy',
            'slug' => 'import-academy',
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
            'domain' => 'import-academy.localhost',
            'active' => true,
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);

        app(RoleSynchronizer::class)->sync();

        $this->adminUser = TenantUser::create([
            'name' => 'Import Admin',
            'email' => 'admin@import-academy.test',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $this->adminUser->roles()->attach($ownerRole->id);

        $tokenResult = TenantToken::createTokenFor($this->adminUser);
        $this->adminToken = $tokenResult['plainTextToken'];
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'import_test_*.sqlite') as $file) {
                @unlink($file);
            }
        }
    }

    public function test_import_students_csv_valid_and_invalid_rows(): void
    {
        $csvContent = "name,phone,email,grade_level,parent_name,parent_phone\n"
            ."Zaid Khaled,+966512345678,zaid@test.com,11,Abu Zaid,+966598765432\n"
            ."Fatima Ahmed,,fatima@test.com,10,,\n"
            .',+966500000000,noname@test.com,12,,'; // Invalid: missing name

        $file = UploadedFile::fake()->createWithContent('students.csv', $csvContent);

        $response = $this->withHeaders([
            'X-Tenant' => 'import-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students/import', [
            'file' => $file,
        ]);

        $response->assertCreated();
        $import = $response->json('data.import');

        $this->assertEquals(3, $import['total_rows']);
        $this->assertEquals(2, $import['successful_rows']);
        $this->assertEquals(1, $import['failed_rows']);

        // Check students created
        $this->assertEquals(2, Student::count());
        $this->assertDatabaseHas('students', ['grade_level' => '11'], 'tenant');

        // Check results list
        $results = $import['results'];
        $this->assertCount(3, $results);
        $this->assertEquals('success', $results[0]['status']);
        $this->assertEquals('success', $results[1]['status']);
        $this->assertEquals('failed', $results[2]['status']);
    }

    public function test_get_import_results(): void
    {
        $csvContent = "name,email\nLayla Noor,layla@test.com\n";
        $file = UploadedFile::fake()->createWithContent('batch.csv', $csvContent);

        $createRes = $this->withHeaders([
            'X-Tenant' => 'import-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->postJson('/api/v1/students/import', ['file' => $file]);

        $importId = $createRes->json('data.import.id');

        $response = $this->withHeaders([
            'X-Tenant' => 'import-academy',
            'Authorization' => "Bearer {$this->adminToken}",
        ])->getJson("/api/v1/imports/{$importId}");

        $response->assertOk();
        $this->assertEquals('batch.csv', $response->json('data.import.filename'));
        $this->assertEquals(1, $response->json('data.import.successful_rows'));
    }
}
