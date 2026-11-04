<?php

namespace Tests\Feature;

use App\Models\Meeting;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class GoogleServicesIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected string $tenantConn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenantConn = 'test_google_'.uniqid();
        $this->cleanupTestDatabases();
    }

    protected function tearDown(): void
    {
        $this->cleanupTestDatabases();
        parent::tearDown();
    }

    protected function cleanupTestDatabases(): void
    {
        app(TenantDatabaseManager::class)->purgeConnection();
        $dir = database_path('tenants');
        if (is_dir($dir)) {
            foreach (glob($dir.DIRECTORY_SEPARATOR.'test_google_*.sqlite') as $file) {
                if (file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    protected function setupTenant(): array
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $tenant = Tenant::create([
            'name' => 'Google Test Academy',
            'slug' => 'google-academy',
            'type' => 'educational_center',
            'status' => 'active',
        ]);

        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => $this->tenantConn,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($tenant);
        $context->setTenant($tenant);
        $dbManager->configureConnection($tenant);

        $perms = [
            'meetings.view' => Permission::create(['name' => 'meetings.view', 'module' => 'meetings']),
            'meetings.create' => Permission::create(['name' => 'meetings.create', 'module' => 'meetings']),
            'media.view' => Permission::create(['name' => 'media.view', 'module' => 'media']),
            'media.upload' => Permission::create(['name' => 'media.upload', 'module' => 'media']),
        ];

        $teacherRole = Role::create(['name' => 'teacher', 'label' => 'Teacher']);
        foreach ($perms as $p) {
            $teacherRole->permissions()->attach($p->id);
        }

        $teacherUser = TenantUser::create([
            'name' => 'Dr. Ahmed Google',
            'email' => 'teacher@google-academy.local',
            'password' => Hash::make('password123'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        Staff::create(['user_id' => $teacherUser->id, 'staff_type' => 'teacher']);
        $teacherUser->roles()->attach($teacherRole->id);

        $token = TenantToken::createTokenFor($teacherUser)['plainTextToken'];

        return [
            'tenant' => $tenant,
            'token' => $token,
            'headers' => [
                'X-Tenant-Slug' => 'google-academy',
                'Authorization' => 'Bearer '.$token,
            ],
        ];
    }

    public function test_google_credentials_configuration(): void
    {
        if (empty(Config::get('services.google.client_id'))) {
            Config::set('services.google.client_id', '978486739253-testmockclientid.apps.googleusercontent.com');
            Config::set('services.google.client_secret', 'GOCSPX-mocktestsecrettoken12345');
        }

        $clientId = Config::get('services.google.client_id');
        $clientSecret = Config::get('services.google.client_secret');

        $this->assertNotEmpty($clientId);
        $this->assertStringContainsString('978486739253', $clientId);
        $this->assertNotEmpty($clientSecret);
        $this->assertStringContainsString('GOCSPX-', $clientSecret);
    }

    public function test_google_meet_without_a_link_is_refused_and_no_code_is_generated(): void
    {
        $setup = $this->setupTenant();

        $res = $this->postJson('/api/v1/meetings', [
            'title' => 'Live Math Session via Google Meet',
            'provider' => 'google_meet',
            'duration_minutes' => 60,
        ], $setup['headers']);

        $res->assertStatus(422)->assertJsonPath('error.code', 'GOOGLE_NOT_CONNECTED');
        $this->assertSame(0, Meeting::count());
    }

    public function test_google_meet_creation_with_custom_code_or_url(): void
    {
        $setup = $this->setupTenant();

        $res = $this->postJson('/api/v1/meetings', [
            'title' => 'Custom Google Meet Lecture',
            'provider' => 'google_meet',
            'meeting_code' => 'https://meet.google.com/xyz-pqrs-uvw',
            'duration_minutes' => 45,
        ], $setup['headers']);

        $res->assertStatus(201);
        $meeting = $res->json('data.meeting');

        $this->assertEquals('manual', $meeting['provider']);
        $this->assertEquals('xyz-pqrs-uvw', $meeting['external_meeting_id']);
        $this->assertEquals('https://meet.google.com/xyz-pqrs-uvw', $meeting['join_url']);
    }

    public function test_google_drive_video_registration_and_url_extraction(): void
    {
        $setup = $this->setupTenant();

        // Register with full Google Drive sharing link
        $res = $this->postJson('/api/v1/media', [
            'title' => 'Biology Lecture Chapter 1',
            'provider' => 'google_drive',
            'external_id' => 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing',
            'media_type' => 'video',
        ], $setup['headers']);

        $res->assertStatus(201);
        $media = $res->json('data.media_asset');

        $this->assertEquals('google_drive', $media['provider']);
        $this->assertEquals('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', $media['external_media_id']);
        $this->assertEquals('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview', $media['embed_url']);
        $this->assertEquals('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view', $media['playback_url']);

        // Test embed endpoint
        $embedRes = $this->getJson("/api/v1/media/{$media['id']}/embed", $setup['headers']);
        $embedRes->assertStatus(200)
            ->assertJsonPath('data.embed_url', 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview');
    }
}
