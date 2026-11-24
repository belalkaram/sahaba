<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Domain\Integrations\Google\Drive\DriveStorage;
use App\Domain\Integrations\Google\GoogleDriveClient;
use App\Domain\Integrations\Media\GoogleDriveVideoProvider;
use App\Jobs\FinalizeMediaUpload;
use App\Jobs\PollDriveVideoProcessing;
use App\Models\AuditLog;
use App\Models\IntegrationConnection;
use App\Models\MediaAsset;
use App\Models\MediaUpload;
use App\Models\PlatformDriveAccount;
use App\Models\PlatformDriveFolder;
use App\Models\PlatformDriveReservation;
use App\Models\PlatformUser;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use App\Tenancy\TenantRunner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * ADR-009: platform Drive storage pool, space reservations, resumable progress and media workers.
 * Google is faked at the HTTP layer; the queue is `sync`.
 */
class GoogleDrivePoolTest extends TestCase
{
    use RefreshDatabase;

    private const GB = 1024 * 1024 * 1024;

    private const FILE_ID = '1PoolFileIdAbCdEfGhIjKlMnOpQr';

    private const SESSION = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=POOL1';

    private Tenant $tenant;

    private string $slug;

    private string $teacherToken;

    private string $otherToken;

    /** @var array<string, string> folder id => name created during the test */
    private array $folders = [];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('services.google.client_id', 'test-client.apps.googleusercontent.com');
        Config::set('services.google.client_secret', 'test-secret-value');
        Config::set('services.google.pool_return_url', 'http://web.test/platform/storage');
        Config::set('services.google.pool_margin_bytes', self::GB);

        $this->slug = 'pool-'.strtolower(Str::random(6));
        $this->tenant = Tenant::create(['name' => 'Pool Academy', 'slug' => $this->slug, 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $this->tenant->id, 'connection_identifier' => 'tenant_'.$this->slug, 'status' => 'ready']);
        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($this->tenant);
        app(TenantContext::class)->setTenant($this->tenant);
        $db->configureConnection($this->tenant);
        app(RoleSynchronizer::class)->sync();

        [$teacher, $this->teacherToken] = $this->user('teacher');
        Staff::create(['user_id' => $teacher->id, 'staff_type' => 'teacher', 'status' => 'active']);
        [$other, $this->otherToken] = $this->user('other');
        Staff::create(['user_id' => $other->id, 'staff_type' => 'teacher', 'status' => 'active']);
    }

    /** @return array{0: TenantUser, 1: string} */
    private function user(string $tag): array
    {
        $user = TenantUser::create(['name' => "U $tag", 'email' => "$tag@pool.test", 'password' => bcrypt('x'), 'type' => 'staff', 'status' => 'active']);
        $user->roles()->attach(Role::where('name', 'teacher')->firstOrFail()->id);

        return [$user, TenantToken::createTokenFor($user)['plainTextToken']];
    }

    private function as(string $token)
    {
        return $this->flushHeaders()->withHeaders(['X-Tenant-Slug' => $this->slug, 'Authorization' => 'Bearer '.$token, 'Origin' => 'http://web.test']);
    }

    private function account(string $email, int $priority, ?int $limitGb, int $usageGb = 0): PlatformDriveAccount
    {
        return PlatformDriveAccount::create([
            'account_email' => $email, 'status' => 'connected', 'access_token' => 'tok-'.$email, 'refresh_token' => '1//r',
            'token_expires_at' => now()->addHour(), 'priority' => $priority, 'accepting_uploads' => true,
            'quota_limit_bytes' => $limitGb === null ? null : $limitGb * self::GB, 'quota_usage_bytes' => $usageGb * self::GB,
            'quota_checked_at' => now(),
        ]);
    }

    /**
     * A small fake Google Drive: folders, resumable sessions and one uploaded file.
     *
     * @param  array<string, mixed>  $options  upload_status (200 | 308), range, video_ready, quota
     */
    private function fakeDrive(array $options = []): void
    {
        $options += ['upload_status' => 200, 'range' => null, 'video_ready' => true, 'quota' => null];
        Http::swap(new HttpFactory);
        Http::fake(function (HttpRequest $r) use ($options) {
            $url = $r->url();
            if (str_contains($url, '/drive/v3/about')) {
                return Http::response(['storageQuota' => $options['quota'] ?? ['limit' => (string) (100 * self::GB), 'usage' => '0']]);
            }
            if ($r->method() === 'POST' && str_contains($url, '/drive/v3/files?fields=id')) {
                $id = 'folder_'.count($this->folders).'_abcdefghijklmnop';
                $this->folders[$id] = $r['name'];

                return Http::response(['id' => $id]);
            }
            if ($r->method() === 'POST' && str_contains($url, 'uploadType=resumable')) {
                return Http::response([], 200, ['Location' => self::SESSION]);
            }
            if ($r->method() === 'PUT' && str_starts_with($url, self::SESSION)) {
                return $options['upload_status'] === 200
                    ? Http::response(['id' => self::FILE_ID], 200)
                    : Http::response('', 308, $options['range'] ? ['Range' => $options['range']] : []);
            }
            if ($r->method() === 'GET' && str_contains($url, '/drive/v3/files/folder_')) {
                return Http::response(['id' => 'x', 'trashed' => false]);
            }
            if ($r->method() === 'GET' && str_contains($url, '/drive/v3/files/'.self::FILE_ID)) {
                $tenantFolder = array_search('LMS — Pool Academy', $this->folders, true);

                return Http::response(array_filter([
                    'id' => self::FILE_ID, 'name' => 'lecture.mp4', 'mimeType' => 'video/mp4', 'size' => '1048576',
                    'trashed' => false, 'parents' => [$tenantFolder],
                    'videoMediaMetadata' => $options['video_ready'] ? ['durationMillis' => '60000'] : null,
                ]));
            }
            if (str_contains($url, '/permissions')) {
                return Http::response(['id' => 'perm1']);
            }

            return Http::response(['error' => ['status' => 'UNEXPECTED '.$r->method().' '.$url]], 500);
        });
    }

    private function start(int $bytes = 1048576)
    {
        return $this->as($this->teacherToken)->postJson('/api/v1/media/uploads', [
            'title' => 'Pool lecture', 'file_name' => 'lecture.mp4', 'mime_type' => 'video/mp4', 'size_bytes' => $bytes,
        ]);
    }

    private function platformHeaders(): array
    {
        PlatformUser::create(['name' => 'Lead', 'email' => 'lead@platform.test', 'password' => Hash::make('PlatformSecret2026!'), 'status' => 'active']);
        $login = $this->postJson('/api/v1/platform/auth/login', ['email' => 'lead@platform.test', 'password' => 'PlatformSecret2026!'])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('data.token')];
    }

    // ---- Choosing an account -----------------------------------------------------------------------------

    public function test_without_an_academy_connection_uploads_go_to_the_pool_with_a_reservation(): void
    {
        $account = $this->account('pool1@gmail.test', 10, 5000);
        $this->fakeDrive();

        $res = $this->start(2 * self::GB)->assertCreated();

        $upload = MediaUpload::findOrFail($res->json('data.upload_id'));
        $this->assertSame('pool', $upload->storage_kind);
        $this->assertSame($account->id, $upload->storage_account_id);
        $this->assertSame(2 * self::GB, PlatformDriveReservation::findOrFail($upload->reservation_id)->bytes);
        $this->assertSame($upload->id, PlatformDriveReservation::findOrFail($upload->reservation_id)->upload_id);

        // Root folder, then the tenant folder inside it; the session is opened with the pool account's token.
        $this->assertSame(['LMS Platform Storage', 'LMS — Pool Academy'], array_values($this->folders));
        $this->assertTrue(PlatformDriveFolder::where('account_id', $account->id)->where('tenant_id', $this->tenant->id)->exists());
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'uploadType=resumable') && $r->hasHeader('Authorization', 'Bearer tok-pool1@gmail.test'));
    }

    public function test_the_current_account_is_used_until_it_cannot_hold_the_file(): void
    {
        $this->account('first@gmail.test', 10, 100, 97); // 3 GB free
        $second = $this->account('second@gmail.test', 20, 5000);
        $this->fakeDrive();

        $first = MediaUpload::findOrFail($this->start((int) (1.5 * self::GB))->assertCreated()->json('data.upload_id'));
        $this->assertNotSame($second->id, $first->storage_account_id);

        // 1.5 GB is now reserved, leaving 1.5 GB: a 1 GB file plus the 1 GB margin moves to the second account.
        $big = MediaUpload::findOrFail($this->start(self::GB)->assertCreated()->json('data.upload_id'));
        $this->assertSame($second->id, $big->storage_account_id);
    }

    public function test_upload_is_refused_before_any_byte_when_no_account_has_room(): void
    {
        $this->account('full@gmail.test', 10, 100, 99);
        $this->fakeDrive();

        $this->start(2 * self::GB)->assertStatus(409)->assertJsonPath('error.code', 'STORAGE_FULL');

        Http::assertNotSent(fn (HttpRequest $r) => str_contains($r->url(), 'uploadType=resumable'));
        $this->assertSame(0, MediaUpload::count());
        $this->assertSame(0, PlatformDriveReservation::count());
        $this->assertTrue(AuditLog::where('action', 'platform.drive_pool.full')->exists());
    }

    public function test_stale_quota_is_read_from_google_before_choosing(): void
    {
        $account = $this->account('stale@gmail.test', 10, 5000);
        $account->forceFill(['quota_checked_at' => now()->subHour()])->save();
        $this->fakeDrive(['quota' => ['limit' => (string) (10 * self::GB), 'usage' => (string) (9 * self::GB)]]);

        $this->start(2 * self::GB)->assertStatus(409)->assertJsonPath('error.code', 'STORAGE_FULL');
        $this->assertSame(9 * self::GB, $account->refresh()->quota_usage_bytes);
    }

    public function test_paused_or_broken_accounts_are_skipped(): void
    {
        $this->account('paused@gmail.test', 1, 5000)->forceFill(['accepting_uploads' => false])->save();
        $this->account('broken@gmail.test', 2, 5000)->forceFill(['status' => 'error'])->save();
        $ok = $this->account('ok@gmail.test', 3, 5000);
        $this->fakeDrive();

        $this->assertSame($ok->id, MediaUpload::findOrFail($this->start()->assertCreated()->json('data.upload_id'))->storage_account_id);
    }

    public function test_the_academy_own_connection_wins_over_the_pool(): void
    {
        $this->account('pool1@gmail.test', 10, 5000);
        IntegrationConnection::create([
            'provider' => 'google', 'status' => 'connected', 'account_email' => 'owner@gmail.test', 'access_token' => 'tenant-tok',
            'refresh_token' => '1//r', 'token_expires_at' => now()->addHour(), 'scopes' => [], 'connected_at' => now(),
        ]);
        $this->fakeDrive();

        $upload = MediaUpload::findOrFail($this->start()->assertCreated()->json('data.upload_id'));
        $this->assertSame('tenant', $upload->storage_kind);
        $this->assertNull($upload->reservation_id);
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'uploadType=resumable') && $r->hasHeader('Authorization', 'Bearer tenant-tok'));
    }

    public function test_no_storage_at_all_is_reported_as_not_connected(): void
    {
        $this->fakeDrive();
        $this->start()->assertStatus(409)->assertJsonPath('error.code', 'GOOGLE_NOT_CONNECTED');
    }

    // ---- Resume, finalize, workers -----------------------------------------------------------------------

    public function test_progress_reports_bytes_google_holds_so_the_browser_can_resume(): void
    {
        $this->account('pool1@gmail.test', 10, 5000);
        $this->fakeDrive();
        $id = $this->start(10_000_000)->json('data.upload_id');

        $this->fakeDrive(['upload_status' => 308, 'range' => 'bytes=0-4194303']);
        $this->as($this->teacherToken)->getJson("/api/v1/media/uploads/$id")->assertOk()
            ->assertJsonPath('data.upload.status', 'pending')
            ->assertJsonPath('data.upload.received_bytes', 4194304)
            ->assertJsonPath('data.upload.upload_url', self::SESSION);

        $this->fakeDrive(['upload_status' => 308]);
        $this->as($this->teacherToken)->getJson("/api/v1/media/uploads/$id")->assertJsonPath('data.upload.received_bytes', 0);

        $this->as($this->otherToken)->getJson("/api/v1/media/uploads/$id")->assertForbidden();
        $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/$id/complete")->assertStatus(409)->assertJsonPath('error.code', 'UPLOAD_INCOMPLETE');
    }

    public function test_completing_a_pool_upload_registers_the_asset_and_releases_the_space(): void
    {
        $account = $this->account('pool1@gmail.test', 10, 5000);
        $this->fakeDrive();
        $id = $this->start()->json('data.upload_id');

        $res = $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/$id/complete")->assertCreated();

        $res->assertJsonPath('data.upload.status', 'completed')->assertJsonPath('data.media_asset.external_media_id', self::FILE_ID);
        $asset = MediaAsset::findOrFail($res->json('data.media_asset.id'));
        $this->assertSame(['kind' => 'pool', 'account_id' => $account->id], $asset->metadata['storage']);
        $this->assertSame(0, $account->reservedBytes());
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), '/permissions') && $r->hasHeader('Authorization', 'Bearer tok-pool1@gmail.test'));

        // The session URL is no longer handed out once the upload is done.
        $this->as($this->teacherToken)->getJson("/api/v1/media/uploads/$id")->assertOk()->assertJsonMissingPath('data.upload.upload_url');
    }

    public function test_complete_answers_at_once_and_the_media_worker_finalizes(): void
    {
        $this->account('pool1@gmail.test', 10, 5000);
        $this->fakeDrive();
        $id = $this->start()->json('data.upload_id');

        Queue::fake();
        $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/$id/complete")
            ->assertStatus(202)->assertJsonPath('data.upload.status', 'finalizing');

        Queue::assertPushedOn('media', FinalizeMediaUpload::class);
        $this->assertSame(0, MediaAsset::count());
    }

    public function test_a_file_outside_the_tenant_folder_fails_and_frees_the_reservation(): void
    {
        $account = $this->account('pool1@gmail.test', 10, 5000);
        $this->fakeDrive();
        $id = $this->start()->json('data.upload_id');
        $this->folders = []; // the file's parent no longer matches the tenant folder mapping

        $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/$id/complete")->assertStatus(422)->assertJsonPath('error.code', 'INVALID_UPLOAD');

        $upload = MediaUpload::findOrFail($id);
        $this->assertSame('failed', $upload->status);
        $this->assertSame('not_in_tenant_folder', $upload->failure_reason);
        $this->assertSame(0, $account->reservedBytes());
        $this->assertSame(0, MediaAsset::count());
    }

    public function test_processing_videos_are_rechecked_until_drive_is_ready(): void
    {
        $this->account('pool1@gmail.test', 10, 5000);
        $this->fakeDrive(['video_ready' => false]);
        $id = $this->start()->json('data.upload_id');

        Queue::fake([PollDriveVideoProcessing::class]);
        $assetId = $this->as($this->teacherToken)->postJson("/api/v1/media/uploads/$id/complete")->assertCreated()->json('data.media_asset.id');
        $this->assertSame('processing', MediaAsset::findOrFail($assetId)->status);
        Queue::assertPushedOn('media', PollDriveVideoProcessing::class);

        // Still processing: schedule the next check. Ready: flip the asset.
        (new PollDriveVideoProcessing($this->tenant->id, $assetId, 0))->handle(app(TenantRunner::class), app(DriveStorage::class), app(GoogleDriveClient::class), app(GoogleDriveVideoProvider::class));
        Queue::assertPushed(PollDriveVideoProcessing::class, fn ($job) => $job->attempt === 1);

        $this->fakeDrive(['video_ready' => true]);
        (new PollDriveVideoProcessing($this->tenant->id, $assetId, 1))->handle(app(TenantRunner::class), app(DriveStorage::class), app(GoogleDriveClient::class), app(GoogleDriveVideoProvider::class));
        $asset = MediaAsset::findOrFail($assetId);
        $this->assertSame('ready', $asset->status);
        $this->assertSame(60, $asset->duration_seconds);
    }

    public function test_scheduled_refresh_updates_quotas_and_releases_expired_reservations(): void
    {
        $account = $this->account('pool1@gmail.test', 10, 5000);
        PlatformDriveReservation::create(['account_id' => $account->id, 'tenant_id' => $this->tenant->id, 'bytes' => 3 * self::GB, 'expires_at' => now()->subMinute()]);
        $this->fakeDrive(['quota' => ['limit' => (string) (200 * self::GB), 'usage' => (string) (50 * self::GB)]]);

        $this->artisan('lms:refresh-drive-quotas')->assertSuccessful();

        $account->refresh();
        $this->assertSame(200 * self::GB, $account->quota_limit_bytes);
        $this->assertSame(50 * self::GB, $account->quota_usage_bytes);
        $this->assertSame(0, PlatformDriveReservation::whereNull('released_at')->count());
    }

    // ---- Super admin -------------------------------------------------------------------------------------

    public function test_super_admin_connects_a_storage_account_with_drive_only_consent(): void
    {
        $headers = $this->platformHeaders();
        Http::swap(new HttpFactory);
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.pool', 'refresh_token' => '1//pool', 'expires_in' => 3599, 'scope' => 'openid email https://www.googleapis.com/auth/drive.file']),
            'openidconnect.googleapis.com/*' => Http::response(['email' => 'storage1@gmail.test']),
            'www.googleapis.com/drive/v3/about*' => Http::response(['storageQuota' => ['limit' => (string) (5000 * self::GB), 'usage' => (string) self::GB]]),
        ]);

        $url = $this->getJson('/api/v1/platform/drive-accounts/connect', $headers)->assertOk()->json('data.authorization_url');
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $this->assertStringContainsString('drive.file', $query['scope']);
        $this->assertStringNotContainsString('calendar', $query['scope']);

        $this->flushHeaders()->get('/api/v1/integrations/google/callback?state='.$query['state'].'&code=c')
            ->assertRedirect('http://web.test/platform/storage?google=connected');

        $account = PlatformDriveAccount::where('account_email', 'storage1@gmail.test')->firstOrFail();
        $this->assertSame('1//pool', $account->refresh_token);
        $this->assertNotSame('ya29.pool', DB::table('platform_drive_accounts')->value('access_token'), 'encrypted at rest');
        $this->assertSame(5000 * self::GB, $account->quota_limit_bytes);
        $this->assertTrue(AuditLog::where('action', 'platform.drive_account.connected')->exists());

        $list = $this->getJson('/api/v1/platform/drive-accounts', $headers)->assertOk();
        $list->assertJsonPath('data.accounts.0.account_email', 'storage1@gmail.test')
            ->assertJsonPath('data.accounts.0.free_bytes', 4999 * self::GB - 0)
            ->assertJsonMissingPath('data.accounts.0.access_token')
            ->assertJsonMissingPath('data.accounts.0.refresh_token');
    }

    public function test_a_pool_state_never_writes_into_a_tenant_and_tenant_admins_cannot_reach_pool_endpoints(): void
    {
        $this->as($this->teacherToken)->getJson('/api/v1/platform/drive-accounts')->assertUnauthorized();
        $this->flushHeaders()->getJson('/api/v1/platform/drive-accounts/connect')->assertUnauthorized();
        $this->assertNull(IntegrationConnection::google());
    }

    public function test_super_admin_pauses_and_disconnects_an_account(): void
    {
        $headers = $this->platformHeaders();
        $account = $this->account('pool1@gmail.test', 10, 5000);
        Http::swap(new HttpFactory);
        Http::fake(['oauth2.googleapis.com/revoke*' => Http::response([], 200)]);

        $this->putJson("/api/v1/platform/drive-accounts/{$account->id}", ['accepting_uploads' => false, 'priority' => 5], $headers)
            ->assertOk()->assertJsonPath('data.account.accepting_uploads', false)->assertJsonPath('data.account.priority', 5);

        $reservation = PlatformDriveReservation::create(['account_id' => $account->id, 'tenant_id' => $this->tenant->id, 'bytes' => self::GB, 'expires_at' => now()->addDay()]);
        $this->deleteJson("/api/v1/platform/drive-accounts/{$account->id}", [], $headers)->assertStatus(409)->assertJsonPath('error.code', 'UPLOADS_IN_PROGRESS');

        $reservation->forceFill(['released_at' => now()])->save();
        $this->deleteJson("/api/v1/platform/drive-accounts/{$account->id}", [], $headers)->assertOk()->assertJsonPath('data.account.status', 'disabled');
        $this->assertNull($account->refresh()->refresh_token);
        $this->assertTrue(AuditLog::where('action', 'platform.drive_account.disconnected')->exists());
    }
}
