<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Permission;
use App\Models\PlatformUser;
use App\Models\PublicDirectoryEntry;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Tests for PS-2 (F-1 to F-4):
 * - Teacher public profile and photo sync to platform-wide public directory.
 * - Cache-busting versioned URLs for photos, covers, and logos.
 * - Tenant logo upload, deletion, and public serving.
 * - Super admin featured teacher toggling.
 */
class PublicDirectoryAndBrandingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function createTenantEnv(string $slug, string $name = 'Test Academy'): array
    {
        $tenant = Tenant::create([
            'name' => $name,
            'slug' => $slug,
            'status' => 'active',
            'type' => 'organization',
        ]);
        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => 'tenant_'.$slug,
            'status' => 'ready',
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $dbManager->configureConnection($tenant);

        $teacherRole = Role::firstOrCreate(['name' => 'teacher'], ['label' => 'Teacher']);
        $teacherRole->permissions()->syncWithoutDetaching([
            Permission::firstOrCreate(['name' => 'courses.update'], ['module' => 'education'])->id,
        ]);

        $adminRole = Role::firstOrCreate(['name' => 'owner'], ['label' => 'Owner']);
        $adminRole->permissions()->syncWithoutDetaching([
            Permission::firstOrCreate(['name' => 'tenant.settings'], ['module' => 'core'])->id,
            Permission::firstOrCreate(['name' => 'staff.manage'], ['module' => 'core'])->id,
        ]);

        $teacherUser = TenantUser::create([
            'name' => 'Teacher Tariq',
            'email' => 'tariq_'.$slug.'@test.com',
            'password' => bcrypt('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherUser->roles()->attach($teacherRole->id);
        $staff = Staff::create([
            'user_id' => $teacherUser->id,
            'staff_type' => 'teacher',
            'status' => 'active',
        ]);

        $adminUser = TenantUser::create([
            'name' => 'Owner Admin',
            'email' => 'admin_'.$slug.'@test.com',
            'password' => bcrypt('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $adminUser->roles()->attach($adminRole->id);

        $course = Course::create([
            'teacher_staff_id' => $staff->id,
            'title' => 'Biology 101',
            'description' => 'Basics of biology',
            'status' => 'published',
            'is_free' => true,
        ]);

        return [
            'tenant' => $tenant,
            'slug' => $slug,
            'staff' => $staff,
            'teacherUser' => $teacherUser,
            'adminUser' => $adminUser,
            'course' => $course,
            'teacherToken' => TenantToken::createTokenFor($teacherUser)['plainTextToken'],
            'adminToken' => TenantToken::createTokenFor($adminUser)['plainTextToken'],
        ];
    }

    private function platformAdminToken(): string
    {
        $platformAdmin = PlatformUser::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@sahaba.test',
            'password' => bcrypt('password123'),
            'role' => 'platform_super_admin',
            'is_active' => true,
        ]);

        return $platformAdmin->createToken('test')['plainTextToken'];
    }

    public function test_teacher_public_profile_and_photo_syncs_to_public_directory(): void
    {
        $env = $this->createTenantEnv('academy-alpha', 'أكاديمية ألفا');
        $headers = [
            'X-Tenant-Slug' => $env['slug'],
            'Authorization' => 'Bearer '.$env['teacherToken'],
            'Accept' => 'application/json',
        ];

        // 1. Initial state: no directory entries
        $this->getJson('/api/v1/public/directory/teachers')
            ->assertOk()
            ->assertJsonCount(0, 'data.teachers');

        // 2. Upload teacher photo
        $photo = UploadedFile::fake()->image('avatar.jpg', 400, 400);
        $this->post("/api/v1/staff/{$env['staff']->id}/photo", ['image' => $photo], $headers)
            ->assertOk();

        // 3. Update public profile with is_public = true
        $this->putJson("/api/v1/staff/{$env['staff']->id}/public-profile", [
            'headline' => 'معلم أحياء متميز',
            'public_bio' => 'خبرة ١٢ عاماً في تدريس الأحياء.',
            'is_public' => true,
        ], $headers)->assertOk();

        // 4. Verify entry exists in Control DB public_directory_entries
        $entry = PublicDirectoryEntry::where('tenant_id', $env['tenant']->id)
            ->where('staff_id', $env['staff']->id)
            ->first();

        $this->assertNotNull($entry);
        $this->assertSame('Teacher Tariq', $entry->name);
        $this->assertSame('أكاديمية ألفا', $entry->tenant_name);
        $this->assertSame('academy-alpha', $entry->tenant_slug);
        $this->assertSame('معلم أحياء متميز', $entry->headline);
        $this->assertStringContainsString('&v=', $entry->photo_url);

        // 5. Verify public endpoint returns the teacher
        $resp = $this->getJson('/api/v1/public/directory/teachers')
            ->assertOk()
            ->assertJsonCount(1, 'data.teachers');

        $resp->assertJsonPath('data.teachers.0.name', 'Teacher Tariq');
        $resp->assertJsonPath('data.teachers.0.tenant_name', 'أكاديمية ألفا');
        $resp->assertJsonPath('data.teachers.0.academy_url', '/a/academy-alpha/teachers');
        $this->assertStringContainsString('&v=', $resp->json('data.teachers.0.photo_url'));

        // 6. Opting out (is_public = false) removes from public directory
        $this->putJson("/api/v1/staff/{$env['staff']->id}/public-profile", [
            'is_public' => false,
        ], $headers)->assertOk();

        $this->getJson('/api/v1/public/directory/teachers')
            ->assertOk()
            ->assertJsonCount(0, 'data.teachers');

        $this->assertDatabaseMissing('public_directory_entries', [
            'tenant_id' => $env['tenant']->id,
            'staff_id' => $env['staff']->id,
        ]);
    }

    public function test_super_admin_can_toggle_featured_teacher(): void
    {
        $env = $this->createTenantEnv('academy-beta', 'أكاديمية بيتا');
        $teacherHeaders = [
            'X-Tenant-Slug' => $env['slug'],
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ];

        // Make teacher public
        $this->putJson("/api/v1/staff/{$env['staff']->id}/public-profile", [
            'headline' => 'معلم فيزياء',
            'is_public' => true,
        ], $teacherHeaders)->assertOk();

        $entry = PublicDirectoryEntry::where('staff_id', $env['staff']->id)->firstOrFail();
        $this->assertFalse($entry->is_featured);

        $platformToken = $this->platformAdminToken();
        $adminHeaders = [
            'Authorization' => 'Bearer '.$platformToken,
            'Accept' => 'application/json',
        ];

        // Toggle featured
        $this->postJson("/api/v1/platform/directory/teachers/{$entry->id}/toggle-featured", [], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('data.entry.is_featured', true);

        $this->assertTrue($entry->fresh()->is_featured);

        // Verify featured filter on public endpoint
        $this->getJson('/api/v1/public/directory/teachers?featured=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.teachers')
            ->assertJsonPath('data.teachers.0.is_featured', true);
    }

    public function test_tenant_logo_upload_serving_and_deletion(): void
    {
        $env = $this->createTenantEnv('academy-gamma', 'أكاديمية غاما');
        $headers = [
            'X-Tenant-Slug' => $env['slug'],
            'Authorization' => 'Bearer '.$env['adminToken'],
            'Accept' => 'application/json',
        ];

        // 1. Initial state: no logo
        $this->withHeaders(['X-Tenant-Slug' => $env['slug']])
            ->get('/api/v1/public/academy/logo')
            ->assertNotFound();

        // 2. Upload logo
        $logoFile = UploadedFile::fake()->image('logo.png', 200, 200);
        $res = $this->post('/api/v1/tenant/logo', ['image' => $logoFile], $headers)
            ->assertOk();

        $logoUrl = $res->json('data.logo_url');
        $this->assertNotNull($logoUrl);
        $this->assertStringContainsString('/public/academy/logo?tenant=academy-gamma&v=', $logoUrl);

        // Verify file stored on disk
        $path = $env['tenant']->fresh()->brand_settings['logo_path'];
        $this->assertNotNull($path);
        Storage::disk('local')->assertExists($path);

        // 3. Public endpoint serves the logo
        $this->withHeaders(['X-Tenant-Slug' => $env['slug']])
            ->get('/api/v1/public/academy/logo')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');

        // 4. Delete logo
        $this->deleteJson('/api/v1/tenant/logo', [], $headers)
            ->assertOk();

        Storage::disk('local')->assertMissing($path);
        $this->assertNull($env['tenant']->fresh()->logo_url);

        $this->withHeaders(['X-Tenant-Slug' => $env['slug']])
            ->get('/api/v1/public/academy/logo')
            ->assertNotFound();
    }

    public function test_public_academy_cards_have_cache_busting_hashes(): void
    {
        $env = $this->createTenantEnv('academy-delta', 'أكاديمية دلتا');
        $headers = [
            'X-Tenant-Slug' => $env['slug'],
            'Authorization' => 'Bearer '.$env['teacherToken'],
        ];

        // Upload photo and set public
        $photo = UploadedFile::fake()->image('teacher.png', 300, 300);
        $this->post("/api/v1/staff/{$env['staff']->id}/photo", ['image' => $photo], $headers)->assertOk();
        $this->putJson("/api/v1/staff/{$env['staff']->id}/public-profile", ['is_public' => true], $headers)->assertOk();

        // Upload course cover and set public
        $cover = UploadedFile::fake()->image('cover.jpg', 800, 450);
        $this->post("/api/v1/courses/{$env['course']->id}/cover", ['image' => $cover], $headers)->assertOk();
        $this->putJson("/api/v1/courses/{$env['course']->id}", ['is_public' => true], $headers)->assertOk();

        $guestHeaders = ['X-Tenant-Slug' => $env['slug']];

        // Check teacher card image_url has &v=
        $teachers = $this->withHeaders($guestHeaders)->getJson('/api/v1/public/academy/teachers')->assertOk();
        $teacherImageUrl = $teachers->json('data.teachers.0.image_url');
        $this->assertNotNull($teacherImageUrl);
        $this->assertStringContainsString('&v=', $teacherImageUrl);

        // Check course card image_url has &v=
        $courses = $this->withHeaders($guestHeaders)->getJson('/api/v1/public/academy/courses')->assertOk();
        $courseImageUrl = $courses->json('data.courses.0.image_url');
        $this->assertNotNull($courseImageUrl);
        $this->assertStringContainsString('&v=', $courseImageUrl);
    }
}
