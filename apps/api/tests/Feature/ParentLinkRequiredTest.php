<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Domain\Identity\Services\StudentImportService;
use App\Models\Role;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ParentLinkRequiredTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;

    protected TenantUser $adminUser;

    protected string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cleanupTenantDbs();

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $this->tenant = Tenant::create([
            'name' => 'أكاديمية النجاح',
            'slug' => 'p9-success-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'academy',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $this->tenant->id,
            'connection_identifier' => 'tenant_'.$this->tenant->slug,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($this->tenant);
        $context->setTenant($this->tenant);
        $dbManager->configureConnection($this->tenant);

        app(RoleSynchronizer::class)->sync();

        $this->adminUser = TenantUser::create([
            'name' => 'الأدمن المسؤول',
            'email' => 'admin@p9.test',
            'password' => 'SecurePass123!',
            'type' => 'staff',
            'status' => 'active',
        ]);
        $ownerRole = Role::where('name', 'owner')->first();
        $this->adminUser->roles()->attach($ownerRole->id);

        $this->adminToken = TenantToken::createTokenFor($this->adminUser)['plainTextToken'];
    }

    protected function tearDown(): void
    {
        DB::purge('tenant');
        $this->cleanupTenantDbs();
        parent::tearDown();
    }

    private function cleanupTenantDbs(): void
    {
        $tenantPath = database_path('tenants');
        if (is_dir($tenantPath)) {
            $files = glob("{$tenantPath}/*.sqlite*");
            foreach ($files as $file) {
                @unlink($file);
            }
        }
    }

    private function headers(): array
    {
        return [
            'Authorization' => "Bearer {$this->adminToken}",
            'X-Tenant-Slug' => $this->tenant->slug,
        ];
    }

    public function test_creating_student_without_parent_is_rejected_with_422(): void
    {
        $response = $this->postJson('/api/v1/students', [
            'name' => 'علي كمال',
            'phone' => '01011112222',
            'grade_level' => 'الصف الأول الثانوي',
        ], $this->headers());

        $response->assertStatus(422);
        $this->assertSame('VALIDATION_FAILED', $response->json('error.code'));
        $this->assertArrayHasKey('parent', $response->json('error.details'));
    }

    public function test_creating_student_with_parent_name_and_phone_creates_student_and_parent(): void
    {
        $response = $this->postJson('/api/v1/students', [
            'name' => 'طارق زياد',
            'phone' => '01033334444',
            'grade_level' => 'الصف الأول الثانوي',
            'parent_name' => 'زياد محمود',
            'parent_phone' => '01099998888',
            'relation_type' => 'father',
        ], $this->headers());

        $response->assertStatus(201);
        $studentId = $response->json('data.student.id');
        $this->assertNotNull($studentId);

        $student = Student::with('parents.user')->find($studentId);
        $this->assertCount(1, $student->parents);
        $this->assertSame('زياد محمود', $student->parents->first()->user->name);
        $this->assertSame('01099998888', $student->parents->first()->user->phone);
        $this->assertTrue($student->parents->first()->whatsapp_opt_in);
    }

    public function test_creating_second_student_with_same_parent_phone_links_siblings(): void
    {
        // Student 1
        $res1 = $this->postJson('/api/v1/students', [
            'name' => 'محمد أحمد',
            'phone' => '01011110001',
            'parent_name' => 'أحمد إبراهيم',
            'parent_phone' => '01055554444',
        ], $this->headers());
        $res1->assertStatus(201);
        $student1Id = $res1->json('data.student.id');

        // Student 2 with identical parent phone
        $res2 = $this->postJson('/api/v1/students', [
            'name' => 'فاطمة أحمد',
            'phone' => '01011110002',
            'parent_name' => 'أحمد إبراهيم',
            'parent_phone' => '01055554444',
        ], $this->headers());
        $res2->assertStatus(201);
        $student2Id = $res2->json('data.student.id');

        $student1 = Student::with('parents')->find($student1Id);
        $student2 = Student::with('parents')->find($student2Id);

        $this->assertCount(1, $student1->parents);
        $this->assertCount(1, $student2->parents);
        // Linked to the exact same parent profile
        $this->assertSame($student1->parents->first()->id, $student2->parents->first()->id);
    }

    public function test_creating_student_with_parent_id_links_existing_parent(): void
    {
        // First create a parent
        $parentRes = $this->postJson('/api/v1/parents', [
            'name' => 'خالد عبد الله',
            'phone' => '01077776666',
        ], $this->headers());
        $parentRes->assertStatus(201);
        $parentId = $parentRes->json('data.parent.id');

        // Create student with parent_id
        $studentRes = $this->postJson('/api/v1/students', [
            'name' => 'عمر خالد',
            'phone' => '01022223333',
            'parent_id' => $parentId,
            'relation_type' => 'father',
        ], $this->headers());

        $studentRes->assertStatus(201);
        $studentId = $studentRes->json('data.student.id');
        $student = Student::with('parents')->find($studentId);

        $this->assertSame($parentId, $student->parents->first()->id);
    }

    public function test_csv_import_row_without_parent_is_marked_failed(): void
    {
        Queue::fake();

        $csvContent = "name,phone,email,grade_level,parent_name,parent_phone\n"
            ."سالم حسن,01012345671,,الصف الأول,حسن علي,01098765431\n"
            ."محمود نادر,01012345672,,الصف الأول,,\n"; // Missing parent

        $tempFile = tempnam(sys_get_temp_dir(), 'csv_test');
        file_put_contents($tempFile, $csvContent);

        $uploaded = new UploadedFile($tempFile, 'students.csv', 'text/csv', null, true);

        $importService = app(StudentImportService::class);
        $import = $importService->importCsv($uploaded, $this->adminUser);

        // Process directly since queue was faked
        $processed = $importService->process($import, "imports/{$this->tenant->id}/{$import->id}.csv");

        $this->assertSame(1, $processed->successful_rows);
        $this->assertSame(1, $processed->failed_rows);

        $results = $processed->results;
        $this->assertSame('success', $results[0]['status']);
        $this->assertSame('failed', $results[1]['status']);
        $this->assertStringContainsString('ولي الأمر', $results[1]['error']);
    }

    public function test_link_and_unlink_child_endpoints_manage_relationships(): void
    {
        // Create parent
        $parentRes = $this->postJson('/api/v1/parents', [
            'name' => 'ياسر سالم',
            'phone' => '01066665555',
        ], $this->headers());
        $parentId = $parentRes->json('data.parent.id');

        // Create student with another parent
        $studentRes = $this->postJson('/api/v1/students', [
            'name' => 'كريم ياسر',
            'parent_name' => 'أم كريم',
            'parent_phone' => '01066665556',
        ], $this->headers());
        $studentId = $studentRes->json('data.student.id');

        // Link student to parent
        $linkRes = $this->postJson("/api/v1/parents/{$parentId}/children", [
            'student_id' => $studentId,
            'relation_type' => 'father',
        ], $this->headers());
        $linkRes->assertOk();

        $student = Student::with('parents')->find($studentId);
        $this->assertTrue($student->parents->contains('id', $parentId));

        // Unlink student from parent
        $unlinkRes = $this->deleteJson("/api/v1/parents/{$parentId}/children/{$studentId}", [], $this->headers());
        $unlinkRes->assertOk();

        $student = Student::with('parents')->find($studentId);
        $this->assertFalse($student->parents->contains('id', $parentId));
    }

    public function test_students_without_parent_filter(): void
    {
        // Create student manually without parent link (e.g. legacy data)
        $legacyUser = TenantUser::create([
            'name' => 'طالب قديم',
            'phone' => '01000000001',
            'password' => 'Pass12345!',
            'type' => 'student',
            'status' => 'active',
        ]);
        $legacyStudent = Student::create([
            'user_id' => $legacyUser->id,
            'student_code' => 'LEG-001',
            'status' => 'active',
        ]);

        // Create student with parent
        $this->postJson('/api/v1/students', [
            'name' => 'طالب جديد',
            'parent_name' => 'ولي أمر جديد',
            'parent_phone' => '01000000002',
        ], $this->headers());

        $res = $this->getJson('/api/v1/students?without_parent=1', $this->headers());
        $res->assertOk();
        $students = $res->json('data.students');

        $this->assertCount(1, $students);
        $this->assertSame($legacyStudent->id, $students[0]['id']);
    }
}
