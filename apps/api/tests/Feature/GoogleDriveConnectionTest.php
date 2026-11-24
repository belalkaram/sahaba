<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\AuditLog;
use App\Models\IntegrationConnection;
use App\Models\MediaAsset;
use App\Models\MediaUpload;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * R4-3 / ADR-008: tenant Google connection and Drive media, with Google faked at the HTTP layer.
 */
class GoogleDriveConnectionTest extends TestCase
{
    use RefreshDatabase;

    private const FILE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

    private const FOLDER_ID = 'folder_1234567890abcdefghij';

    private const SESSION_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=SESSION123';

    private Tenant $tenant;

    private string $slug;

    private string $ownerToken;

    private string $teacherToken;

    private string $otherTeacherToken;

    private string $studentToken;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('services.google.client_id', 'test-client.apps.googleusercontent.com');
        Config::set('services.google.client_secret', 'test-secret-value');
        Config::set('services.google.redirect_uri', 'http://localhost:8000/api/v1/integrations/google/callback');
        Config::set('services.google.connect_return_url', 'http://web.test/admin/integrations');

        $this->slug = 'gd-'.strtolower(Str::random(6));
        $this->tenant = Tenant::create(['name' => 'Drive Academy', 'slug' => $this->slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $this->tenant->id, 'connection_identifier' => 'tenant_'.$this->slug, 'status' => 'ready']);
        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);
        $db->configureConnection($this->tenant);
        app(RoleSynchronizer::class)->sync();

        $this->ownerToken = $this->user('owner', 'owner', 'staff')[1];
        [$teacher, $this->teacherToken] = $this->user('teacher', 'teacher', 'staff');
        Staff::create(['user_id' => $teacher->id, 'staff_type' => 'teacher', 'status' => 'active']);
        [$other, $this->otherTeacherToken] = $this->user('other', 'teacher', 'staff');
        Staff::create(['user_id' => $other->id, 'staff_type' => 'teacher', 'status' => 'active']);
        $this->studentToken = $this->user('student', 'student', 'student')[1];
    }

    /** @return array{0: TenantUser, 1: string} */
    private function user(string $tag, string $role, string $type): array
    {
        $user = TenantUser::create(['name' => "U $tag", 'email' => "$tag@gd.test", 'password' => bcrypt('x'), 'type' => $type, 'status' => 'active']);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);

        return [$user, TenantToken::createTokenFor($user)['plainTextToken']];
    }

    private function as(string $token)
    {
        return $this->flushHeaders()->withHeaders(['X-Tenant-Slug' => $this->slug, 'Authorization' => 'Bearer '.$token]);
    }

    /** $this->fakeGoogle() stubs accumulate and the first match wins, so each step starts from a fresh factory. */
    private function fakeGoogle(array $stubs = []): void
    {
        Http::swap(new HttpFactory);
        Http::fake($stubs);
    }

    private function connect(array $overrides = []): IntegrationConnection
    {
        return IntegrationConnection::create($overrides + [
            'provider' => 'google',
            'status' => 'connected',
            'account_email' => 'owner@gmail.test',
            'access_token' => 'ya29.access',
            'refresh_token' => '1//refresh',
            'token_expires_at' => now()->addHour(),
            'scopes' => ['https://www.googleapis.com/auth/drive.file'],
            'connected_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    private function driveFile(array $overrides = []): array
    {
        return $overrides + [
            'id' => self::FILE_ID,
            'name' => 'lecture.mp4',
            'mimeType' => 'video/mp4',
            'size' => '1048576',
            'trashed' => false,
            'parents' => [self::FOLDER_ID],
            'videoMediaMetadata' => ['durationMillis' => '125400', 'width' => 1280, 'height' => 720],
        ];
    }

    // ---- Connection --------------------------------------------------------------------------------------

    public function test_owner_connects_google_through_a_single_use_state(): void
    {
        $this->fakeGoogle([
            'oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'ya29.new', 'refresh_token' => '1//new', 'expires_in' => 3599,
                'scope' => 'openid email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events',
            ]),
            'openidconnect.googleapis.com/*' => Http::response(['email' => 'academy@gmail.test']),
        ]);

        $url = $this->as($this->ownerToken)->getJson('/api/v1/integrations/google/connect')
            ->assertOk()->json('data.authorization_url');

        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/v2/auth?', $url);
        $this->assertSame('offline', $query['access_type']);
        $this->assertStringContainsString('drive.file', $query['scope']);
        $this->assertStringContainsString('calendar.events', $query['scope']);
        $this->assertArrayNotHasKey('client_secret', $query);

        // Google calls back without tenant header or token.
        $this->get('/api/v1/integrations/google/callback?state='.$query['state'].'&code=auth-code')
            ->assertRedirect('http://web.test/admin/integrations?google=connected');

        $connection = IntegrationConnection::google();
        $this->assertNotNull($connection);
        $this->assertSame('academy@gmail.test', $connection->account_email);
        $this->assertSame('ya29.new', $connection->access_token);
        $this->assertSame('1//new', $connection->refresh_token);
        $raw = DB::connection('tenant')->table('integration_connections')->first();
        $this->assertNotSame('ya29.new', $raw->access_token, 'tokens are encrypted at rest');
        $this->assertStringNotContainsString('1//new', (string) $raw->refresh_token);
        $this->assertTrue(AuditLog::where('action', 'integrations.google.connected')->exists());

        // The state cannot be replayed.
        $this->get('/api/v1/integrations/google/callback?state='.$query['state'].'&code=auth-code')
            ->assertRedirect('http://web.test/admin/integrations?google=error&reason=state');

        $this->as($this->ownerToken)->getJson('/api/v1/integrations/google')
            ->assertOk()
            ->assertJsonPath('data.google.connected', true)
            ->assertJsonPath('data.google.account_email', 'academy@gmail.test')
            ->assertJsonMissingPath('data.google.access_token');
    }

    public function test_callback_rejects_unknown_state_and_user_denial_without_storing_anything(): void
    {
        $this->fakeGoogle();

        $this->get('/api/v1/integrations/google/callback?state=forged&code=x')
            ->assertRedirect('http://web.test/admin/integrations?google=error&reason=state');
        $this->get('/api/v1/integrations/google/callback?error=access_denied&state=x')
            ->assertRedirect('http://web.test/admin/integrations?google=error&reason=denied');

        Http::assertNothingSent();
        $this->assertNull(IntegrationConnection::google());
    }

    public function test_only_settings_managers_can_connect_view_or_disconnect(): void
    {
        foreach ([$this->teacherToken, $this->studentToken] as $token) {
            $this->as($token)->getJson('/api/v1/integrations/google/connect')->assertForbidden();
            $this->as($token)->getJson('/api/v1/integrations/google')->assertForbidden();
            $this->as($token)->deleteJson('/api/v1/integrations/google')->assertForbidden();
        }
        $this->flushHeaders()->withHeaders(['X-Tenant-Slug' => $this->slug])->getJson('/api/v1/integrations/google/connect')->assertUnauthorized();
    }

    public function test_connect_reports_missing_server_configuration(): void
    {
        Config::set('services.google.client_secret', null);

        $this->as($this->ownerToken)->getJson('/api/v1/integrations/google/connect')
            ->assertStatus(503)->assertJsonPath('error.code', 'GOOGLE_NOT_CONFIGURED');
    }

    public function test_disconnect_revokes_at_google_and_removes_the_tokens(): void
    {
        $this->connect();
        $this->fakeGoogle(['oauth2.googleapis.com/revoke' => Http::response([], 200)]);

        $this->as($this->ownerToken)->deleteJson('/api/v1/integrations/google')
            ->assertOk()->assertJsonPath('data.google.connected', false);

        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), '/revoke') && $r['token'] === '1//refresh');
        $this->assertNull(IntegrationConnection::google());
        $this->assertTrue(AuditLog::where('action', 'integrations.google.disconnected')->exists());
    }

    public function test_expired_token_is_refreshed_and_revoked_grant_marks_the_connection_broken(): void
    {
        $this->connect(['token_expires_at' => now()->subMinute()]);
        $this->fakeGoogle([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.fresh', 'expires_in' => 3600]),
            'www.googleapis.com/drive/v3/files/*' => Http::response($this->driveFile()),
        ]);

        $this->as($this->teacherToken)->postJson('/api/v1/media', [
            'title' => 'L1', 'provider' => 'google_drive', 'external_id' => self::FILE_ID,
        ])->assertCreated()->assertJsonPath('data.media_asset.metadata.verification', 'verified');
        $this->assertSame('ya29.fresh', IntegrationConnection::google()->access_token);
        $this->assertSame('1//refresh', IntegrationConnection::google()->refresh_token);

        IntegrationConnection::google()->update(['token_expires_at' => now()->subMinute()]);
        $this->fakeGoogle(['oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant'], 400)]);

        $this->as($this->teacherToken)->postJson('/api/v1/media/uploads', [
            'title' => 'L2', 'file_name' => 'l2.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => 10,
        ])->assertStatus(409)->assertJsonPath('error.code', 'GOOGLE_NOT_CONNECTED');
        $this->assertSame('error', IntegrationConnection::google()->status);
    }

    // ---- Direct upload --------------------------------------------------------------------------------------

    public function test_teacher_uploads_a_video_into_the_tenant_folder(): void
    {
        $this->connect();
        $this->fakeGoogle([
            'www.googleapis.com/drive/v3/files?fields=id' => Http::response(['id' => self::FOLDER_ID]),
            'www.googleapis.com/upload/drive/v3/files?uploadType=resumable*' => Http::response([], 200, ['Location' => self::SESSION_URL]),
        ]);

        $start = $this->as($this->teacherToken)->withHeaders(['Origin' => 'http://web.test'])->postJson('/api/v1/media/uploads', [
            'title' => 'Algebra 1', 'file_name' => 'algebra-1.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => 1048576,
        ])->assertCreated()->assertJsonPath('data.upload_url', self::SESSION_URL);

        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'uploadType=resumable')
            && $r->hasHeader('Origin', 'http://web.test')
            && $r['parents'] === [self::FOLDER_ID]
            && $r->hasHeader('Authorization', 'Bearer ya29.access'));
        $this->assertSame(self::FOLDER_ID, IntegrationConnection::google()->drive_folder_id);
        $raw = DB::connection('tenant')->table('media_uploads')->first();
        $this->assertNotSame(self::SESSION_URL, $raw->session_url, 'session URL encrypted at rest');

        $uploadId = $start->json('data.upload_id');

        // Not finished yet.
        $this->fakeGoogle([
            self::SESSION_URL => Http::response('', 308),
            'www.googleapis.com/drive/v3/files/*' => Http::response(['id' => self::FOLDER_ID, 'trashed' => false]),
        ]);
        $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/{$uploadId}/complete")
            ->assertStatus(409)->assertJsonPath('error.code', 'UPLOAD_INCOMPLETE');

        // Another uploader cannot complete it.
        $this->as($this->otherTeacherToken)->postJson("/api/v1/media/uploads/{$uploadId}/complete")->assertForbidden();

        $this->fakeGoogle([
            self::SESSION_URL => Http::response(['id' => self::FILE_ID]),
            'www.googleapis.com/drive/v3/files/'.self::FOLDER_ID.'*' => Http::response(['id' => self::FOLDER_ID, 'trashed' => false]),
            'www.googleapis.com/drive/v3/files/'.self::FILE_ID.'/permissions*' => Http::response(['id' => 'anyoneWithLink']),
            'www.googleapis.com/drive/v3/files/'.self::FILE_ID.'*' => Http::response($this->driveFile()),
        ]);

        $media = $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/{$uploadId}/complete")
            ->assertCreated()
            ->assertJsonPath('data.media_asset.external_media_id', self::FILE_ID)
            ->assertJsonPath('data.media_asset.status', 'ready')
            ->assertJsonPath('data.media_asset.duration_seconds', 125)
            ->assertJsonPath('data.media_asset.metadata.verification', 'verified')
            ->json('data.media_asset');

        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), '/permissions') && $r['type'] === 'anyone' && $r['role'] === 'reader');
        Http::assertSent(fn (HttpRequest $r) => $r->url() === self::SESSION_URL && $r->hasHeader('Content-Range', 'bytes */1048576'));
        $this->assertSame('completed', MediaUpload::find($uploadId)->status);
        $this->assertTrue(AuditLog::where('action', 'media.uploaded')->where('entity_id', $media['id'])->exists());

        // Completing twice returns the same asset.
        $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/{$uploadId}/complete")
            ->assertCreated()->assertJsonPath('data.media_asset.id', $media['id']);
        $this->assertSame(1, MediaAsset::count());
    }

    public function test_completion_rejects_a_file_outside_the_tenant_folder(): void
    {
        $this->connect(['drive_folder_id' => self::FOLDER_ID]);
        $upload = MediaUpload::create([
            'title' => 'X', 'file_name' => 'x.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => 10,
            'session_url' => self::SESSION_URL, 'created_by' => TenantUser::where('email', 'teacher@gd.test')->value('id'),
        ]);

        $this->fakeGoogle([
            self::SESSION_URL => Http::response(['id' => self::FILE_ID]),
            'www.googleapis.com/drive/v3/files/'.self::FOLDER_ID.'*' => Http::response(['id' => self::FOLDER_ID, 'trashed' => false]),
            'www.googleapis.com/drive/v3/files/'.self::FILE_ID.'*' => Http::response($this->driveFile(['parents' => ['someone-elses-folder']])),
        ]);

        $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/{$upload->id}/complete")
            ->assertStatus(422)->assertJsonPath('error.code', 'INVALID_UPLOAD');
        $this->assertSame(0, MediaAsset::count());
    }

    public function test_upload_requires_a_connection_permission_and_a_video(): void
    {
        $payload = ['title' => 'A', 'file_name' => 'a.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => 10];
        $this->fakeGoogle();

        $this->as($this->teacherToken)->postJson('/api/v1/media/uploads', $payload)
            ->assertStatus(409)->assertJsonPath('error.code', 'GOOGLE_NOT_CONNECTED');

        $this->connect();
        $this->as($this->studentToken)->postJson('/api/v1/media/uploads', $payload)->assertForbidden();
        $this->as($this->teacherToken)->postJson('/api/v1/media/uploads', ['mime_type' => 'application/pdf'] + $payload)
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED')->assertJsonStructure(['error' => ['details' => ['mime_type']]]);
        Http::assertNothingSent();
    }

    // ---- Pasted links ---------------------------------------------------------------------------------------

    public function test_pasted_link_is_verified_when_visible_and_unverified_otherwise(): void
    {
        $link = 'https://drive.google.com/file/d/'.self::FILE_ID.'/view?usp=sharing';

        // Not connected: accepted, unverified, no Google call.
        $this->fakeGoogle();
        $this->as($this->teacherToken)->postJson('/api/v1/media', ['title' => 'A', 'provider' => 'google_drive', 'external_id' => $link])
            ->assertCreated()
            ->assertJsonPath('data.media_asset.external_media_id', self::FILE_ID)
            ->assertJsonPath('data.media_asset.metadata.verification', 'unverified');
        Http::assertNothingSent();

        // Connected but invisible to drive.file: still unverified.
        $this->connect();
        $this->fakeGoogle(['www.googleapis.com/drive/v3/files/*' => Http::response(['error' => ['code' => 404]], 404)]);
        $this->as($this->teacherToken)->postJson('/api/v1/media', ['title' => 'B', 'provider' => 'google_drive', 'external_id' => $link])
            ->assertCreated()->assertJsonPath('data.media_asset.metadata.verification', 'unverified');

        // Connected and visible: verified with real duration.
        $this->fakeGoogle(['www.googleapis.com/drive/v3/files/*' => Http::response($this->driveFile())]);
        $this->as($this->teacherToken)->postJson('/api/v1/media', ['title' => 'C', 'provider' => 'google_drive', 'external_id' => $link])
            ->assertCreated()
            ->assertJsonPath('data.media_asset.metadata.verification', 'verified')
            ->assertJsonPath('data.media_asset.duration_seconds', 125);
    }

    public function test_invalid_trashed_or_non_video_links_are_rejected(): void
    {
        $this->fakeGoogle();
        $this->as($this->teacherToken)->postJson('/api/v1/media', ['title' => 'A', 'provider' => 'google_drive', 'external_id' => 'not a drive link'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'INVALID_MEDIA_LINK');

        $this->connect();
        $this->fakeGoogle(['www.googleapis.com/drive/v3/files/*' => Http::response($this->driveFile(['trashed' => true]))]);
        $this->as($this->teacherToken)->postJson('/api/v1/media', ['title' => 'B', 'provider' => 'google_drive', 'external_id' => self::FILE_ID])
            ->assertUnprocessable()->assertJsonPath('error.code', 'INVALID_MEDIA_LINK');

        $this->fakeGoogle(['www.googleapis.com/drive/v3/files/*' => Http::response($this->driveFile(['mimeType' => 'application/pdf']))]);
        $this->as($this->teacherToken)->postJson('/api/v1/media', ['title' => 'C', 'provider' => 'google_drive', 'external_id' => self::FILE_ID])
            ->assertUnprocessable()->assertJsonPath('error.code', 'INVALID_MEDIA_LINK');

        $this->assertSame(0, MediaAsset::count());
    }

    public function test_students_never_receive_playback_links_in_listings(): void
    {
        MediaAsset::create([
            'title' => 'Free', 'provider' => 'google_drive', 'external_media_id' => self::FILE_ID, 'media_type' => 'video',
            'embed_url' => 'https://drive.google.com/file/d/'.self::FILE_ID.'/preview',
            'playback_url' => 'https://drive.google.com/file/d/'.self::FILE_ID.'/view', 'status' => 'ready',
        ]);

        $this->as($this->studentToken)->getJson('/api/v1/media')
            ->assertOk()->assertJsonMissingPath('data.media_assets.0.embed_url')->assertJsonMissingPath('data.media_assets.0.playback_url');
        $id = MediaAsset::value('id');
        $this->as($this->studentToken)->getJson("/api/v1/media/{$id}")->assertOk()->assertJsonMissingPath('data.media_asset.embed_url');

        $this->as($this->teacherToken)->getJson('/api/v1/media')->assertOk()->assertJsonPath('data.media_assets.0.external_media_id', self::FILE_ID)
            ->assertJsonStructure(['data' => ['media_assets' => [['embed_url']]]]);
    }

    public function test_connection_is_isolated_per_tenant(): void
    {
        $this->connect();

        $slugB = 'gdb-'.strtolower(Str::random(6));
        $tenantB = Tenant::create(['name' => 'Other Academy', 'slug' => $slugB, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenantB->id, 'connection_identifier' => 'tenant_'.$slugB, 'status' => 'ready']);
        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenantB);
        $db->configureConnection($tenantB);
        app(TenantContext::class)->setTenant($tenantB);
        app(RoleSynchronizer::class)->sync();
        $ownerB = TenantUser::create(['name' => 'Owner B', 'email' => 'owner@b.test', 'password' => bcrypt('x'), 'type' => 'staff', 'status' => 'active']);
        $ownerB->roles()->attach(Role::where('name', 'owner')->firstOrFail()->id);
        $tokenB = TenantToken::createTokenFor($ownerB)['plainTextToken'];

        $this->withHeaders(['X-Tenant-Slug' => $slugB, 'Authorization' => 'Bearer '.$tokenB])
            ->getJson('/api/v1/integrations/google')
            ->assertOk()->assertJsonPath('data.google.connected', false);

        // Tenant A's token is not valid for tenant B.
        $this->withHeaders(['X-Tenant-Slug' => $slugB, 'Authorization' => 'Bearer '.$this->ownerToken])
            ->getJson('/api/v1/integrations/google')->assertUnauthorized();
    }
}
