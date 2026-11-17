<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantLandingSettings;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ADR-007 (TL-1): Tenant landing settings — backend tests.
 *
 * Covers:
 *  1. Owner can get state (defaults when no record exists).
 *  2. Owner can save a valid draft.
 *  3. Owner can publish a draft (version increments, audit entry written, primary_color synced).
 *  4. Owner can discard draft.
 *  5. Owner can issue preview token.
 *  6. Teacher (no tenant.branding) → 403.
 *  7. Unauthenticated → 401.
 *  8. Cross-tenant: token from academy A with slug of academy B → no change to B.
 *  9. Invalid palette colour → 422.
 * 10. Invalid template → 422.
 * 11. Too many FAQs (>8) → 422.
 * 12. Contact URL with http:// → 422.
 * 13. About text too long (>1200 chars) → 422.
 * 14. GET /public/academy/profile includes landing (published, not draft) and no preview_token_hash.
 * 15. Preview token: valid token returns draft; expired/wrong token returns published silently.
 */
class TenantLandingSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
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
            foreach (glob($dir.DIRECTORY_SEPARATOR.'*.sqlite') as $file) {
                if (str_contains($file, 'tl_') && file_exists($file)) {
                    @unlink($file);
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private function createTenantEnv(string $slug): array
    {
        $tenant = Tenant::create([
            'name' => 'TL Academy '.$slug,
            'slug' => $slug,
            'status' => 'active',
            'type' => 'organization',
        ]);
        TenantDatabase::create([
            'tenant_id' => $tenant->id,
            'connection_identifier' => $slug,
            'status' => 'ready',
        ]);

        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($tenant);
        app(TenantContext::class)->setTenant($tenant);
        $dbManager->configureConnection($tenant);

        // Sync full permission catalog so tenant.branding exists
        app(RoleSynchronizer::class)->sync();

        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();

        $ownerUser = TenantUser::create([
            'name' => 'Owner '.$slug,
            'email' => 'owner_'.$slug.'@tl.test',
            'password' => bcrypt('pass'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $ownerUser->roles()->attach($ownerRole->id);

        $teacherUser = TenantUser::create([
            'name' => 'Teacher '.$slug,
            'email' => 'teacher_'.$slug.'@tl.test',
            'password' => bcrypt('pass'),
            'type' => 'staff',
            'status' => 'active',
        ]);
        $teacherUser->roles()->attach($teacherRole->id);

        return [
            'tenant'       => $tenant,
            'slug'         => $slug,
            'ownerToken'   => TenantToken::createTokenFor($ownerUser)['plainTextToken'],
            'teacherToken' => TenantToken::createTokenFor($teacherUser)['plainTextToken'],
        ];
    }

    private function validDraft(): array
    {
        return [
            'template' => 'oasis',
            'palette' => [
                'primary'   => '#0C7F6D',
                'secondary' => '#0B6659',
                'accent'    => '#9C6B36',
                'surface'   => '#F8F8F6',
            ],
            'sections' => [
                'stats'    => true,
                'courses'  => true,
                'teachers' => true,
                'about'    => false,
                'contact'  => false,
                'faq'      => false,
            ],
            'content' => [
                'cover_path' => null,
                'about'      => ['text' => 'أكاديمية رائدة.', 'highlights' => []],
                'contact'    => ['phone' => null, 'whatsapp' => null, 'email' => null, 'address' => null, 'map_url' => null, 'social' => []],
                'faq'        => [],
            ],
        ];
    }

    private function headers(string $slug, string $token): array
    {
        return [
            'X-Tenant-Slug' => $slug,
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ];
    }

    // ─────────────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────────────

    /** 1. Owner gets defaults when no record exists. */
    public function test_owner_gets_default_state_when_no_record(): void
    {
        $env = $this->createTenantEnv('tl_def');

        $res = $this->getJson('/api/v1/tenant/landing', $this->headers('tl_def', $env['ownerToken']));

        $res->assertOk()
            ->assertJsonPath('data.published.template', 'oasis')
            ->assertJsonPath('data.draft', null)
            ->assertJsonPath('data.version', 0)
            ->assertJsonCount(5, 'data.templates')
            ->assertJsonCount(6, 'data.presets');
    }

    /** 2. Owner saves a valid draft. */
    public function test_owner_saves_valid_draft(): void
    {
        $env = $this->createTenantEnv('tl_draft');

        $res = $this->putJson('/api/v1/tenant/landing/draft', $this->validDraft(), $this->headers('tl_draft', $env['ownerToken']));

        $res->assertOk()->assertJsonPath('data.draft.template', 'oasis');

        $this->assertDatabaseHas('tenant_landing_settings', [
            'tenant_id' => $env['tenant']->id,
        ]);
    }

    /** 3. Owner publishes draft: version increments, audit entry exists, primary_color synced. */
    public function test_owner_publishes_draft_and_version_increments(): void
    {
        $env = $this->createTenantEnv('tl_pub');

        // Save draft first
        $this->putJson('/api/v1/tenant/landing/draft', $this->validDraft(), $this->headers('tl_pub', $env['ownerToken']))->assertOk();

        // Publish
        $res = $this->postJson('/api/v1/tenant/landing/publish', [], $this->headers('tl_pub', $env['ownerToken']));

        $res->assertOk()
            ->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.published.template', 'oasis');

        // Audit log was written
        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $env['tenant']->id,
            'action'    => 'tenant.landing.published',
        ]);

        // primary_color synced back (OD-42)
        $this->assertDatabaseHas('tenants', [
            'id'            => $env['tenant']->id,
            'primary_color' => '#0C7F6D',
        ]);

        // Draft cleared after publish
        $row = TenantLandingSettings::where('tenant_id', $env['tenant']->id)->first();
        $this->assertNull($row->draft);
    }

    /** 4. Owner discards draft. */
    public function test_owner_discards_draft(): void
    {
        $env = $this->createTenantEnv('tl_disc');

        $this->putJson('/api/v1/tenant/landing/draft', $this->validDraft(), $this->headers('tl_disc', $env['ownerToken']))->assertOk();
        $this->deleteJson('/api/v1/tenant/landing/draft', [], $this->headers('tl_disc', $env['ownerToken']))->assertOk();

        $row = TenantLandingSettings::where('tenant_id', $env['tenant']->id)->first();
        $this->assertNull($row->draft);
    }

    /** 5. Owner issues preview token. */
    public function test_owner_issues_preview_token(): void
    {
        $env = $this->createTenantEnv('tl_prev');

        $res = $this->postJson('/api/v1/tenant/landing/preview-token', [], $this->headers('tl_prev', $env['ownerToken']));

        $res->assertOk()
            ->assertJsonStructure(['data' => ['token', 'expires_in_seconds', 'preview_url']]);

        // token is hashed in DB, not stored raw
        $row = TenantLandingSettings::where('tenant_id', $env['tenant']->id)->first();
        $this->assertNotNull($row->preview_token_hash);
        $this->assertNotEquals($res->json('data.token'), $row->preview_token_hash);
    }

    /** 6. Teacher (no tenant.branding) → 403. */
    public function test_teacher_cannot_access_landing_endpoints(): void
    {
        $env = $this->createTenantEnv('tl_tchr');

        $this->getJson('/api/v1/tenant/landing', $this->headers('tl_tchr', $env['teacherToken']))->assertForbidden();
        $this->putJson('/api/v1/tenant/landing/draft', $this->validDraft(), $this->headers('tl_tchr', $env['teacherToken']))->assertForbidden();
        $this->postJson('/api/v1/tenant/landing/publish', [], $this->headers('tl_tchr', $env['teacherToken']))->assertForbidden();
    }

    /** 7. Unauthenticated → 401. */
    public function test_unauthenticated_request_is_rejected(): void
    {
        $env = $this->createTenantEnv('tl_unauth');

        $this->getJson('/api/v1/tenant/landing', ['X-Tenant-Slug' => 'tl_unauth', 'Accept' => 'application/json'])
            ->assertUnauthorized();
    }

    /** 8. Cross-tenant: token from academy A cannot modify academy B. */
    public function test_cross_tenant_token_cannot_modify_another_tenant(): void
    {
        $envA = $this->createTenantEnv('tl_a');
        $envB = $this->createTenantEnv('tl_b');

        // Use token from A but send to B's slug header
        $res = $this->putJson(
            '/api/v1/tenant/landing/draft',
            $this->validDraft(),
            [
                'X-Tenant-Slug' => 'tl_b',          // tenant B
                'Authorization' => 'Bearer '.$envA['ownerToken'], // token from tenant A
                'Accept' => 'application/json',
            ]
        );

        // Should fail: the token belongs to tenant A, tenant B never sees it as valid
        $res->assertStatus(401);

        // Tenant B's record is untouched
        $this->assertDatabaseMissing('tenant_landing_settings', ['tenant_id' => $envB['tenant']->id]);
    }

    /** 9. Invalid palette colour (#GGG…) → 422. */
    public function test_invalid_palette_colour_returns_422(): void
    {
        $env = $this->createTenantEnv('tl_clr');

        $bad = $this->validDraft();
        $bad['palette']['primary'] = '#GGGGGG';

        $res = $this->putJson('/api/v1/tenant/landing/draft', $bad, $this->headers('tl_clr', $env['ownerToken']));
        $res->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
        // The details key is literally 'palette.primary' (dotted), not nested
        $details = $res->json('error.details');
        $this->assertArrayHasKey('palette.primary', $details, 'Expected validation error for palette.primary');
    }

    /** 10. Unknown template → 422. */
    public function test_unknown_template_returns_422(): void
    {
        $env = $this->createTenantEnv('tl_tpl');

        $bad = $this->validDraft();
        $bad['template'] = 'invisible_jet';

        $this->putJson('/api/v1/tenant/landing/draft', $bad, $this->headers('tl_tpl', $env['ownerToken']))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    /** 11. Too many FAQs (>8) → 422. */
    public function test_too_many_faqs_returns_422(): void
    {
        $env = $this->createTenantEnv('tl_faq');

        $bad = $this->validDraft();
        $bad['content']['faq'] = array_fill(0, 9, ['question' => 'سؤال؟', 'answer' => 'جواب.']);

        $this->putJson('/api/v1/tenant/landing/draft', $bad, $this->headers('tl_faq', $env['ownerToken']))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    /** 12. Contact URL with http:// → 422. */
    public function test_http_contact_url_returns_422(): void
    {
        $env = $this->createTenantEnv('tl_url');

        $bad = $this->validDraft();
        $bad['content']['contact']['map_url'] = 'http://insecure.example.com/map';

        $this->putJson('/api/v1/tenant/landing/draft', $bad, $this->headers('tl_url', $env['ownerToken']))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    /** 13. About text too long → 422. */
    public function test_about_text_too_long_returns_422(): void
    {
        $env = $this->createTenantEnv('tl_long');

        $bad = $this->validDraft();
        $bad['content']['about']['text'] = str_repeat('أ', 1201);

        $this->putJson('/api/v1/tenant/landing/draft', $bad, $this->headers('tl_long', $env['ownerToken']))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    /** 14. GET /public/academy/profile includes landing (published only, no preview_token_hash). */
    public function test_public_profile_includes_published_landing_and_no_sensitive_fields(): void
    {
        $env = $this->createTenantEnv('tl_pub2');

        // Save and publish
        $this->putJson('/api/v1/tenant/landing/draft', $this->validDraft(), $this->headers('tl_pub2', $env['ownerToken']))->assertOk();
        $this->postJson('/api/v1/tenant/landing/publish', [], $this->headers('tl_pub2', $env['ownerToken']))->assertOk();

        // Public endpoint (no auth)
        $res = $this->getJson('/api/v1/public/academy/profile', ['X-Tenant-Slug' => 'tl_pub2', 'Accept' => 'application/json']);

        $res->assertOk()
            ->assertJsonPath('data.landing.template', 'oasis')
            ->assertJsonMissing(['preview_token_hash'])
            ->assertJsonMissing(['draft']);
    }

    /** 15. Preview token: valid returns draft, invalid returns published. */
    public function test_preview_token_returns_draft_when_valid(): void
    {
        $env = $this->createTenantEnv('tl_tok');

        // Publish a first version
        $this->putJson('/api/v1/tenant/landing/draft', $this->validDraft(), $this->headers('tl_tok', $env['ownerToken']))->assertOk();
        $this->postJson('/api/v1/tenant/landing/publish', [], $this->headers('tl_tok', $env['ownerToken']))->assertOk();

        // Create a modified draft
        $modified = $this->validDraft();
        $modified['template'] = 'beacon';
        $this->putJson('/api/v1/tenant/landing/draft', $modified, $this->headers('tl_tok', $env['ownerToken']))->assertOk();

        // Issue preview token
        $tokenRes = $this->postJson('/api/v1/tenant/landing/preview-token', [], $this->headers('tl_tok', $env['ownerToken']));
        $token = $tokenRes->json('data.token');

        // Public profile with valid token → draft template
        $previewRes = $this->getJson("/api/v1/public/academy/profile?preview={$token}", ['X-Tenant-Slug' => 'tl_tok', 'Accept' => 'application/json']);
        $previewRes->assertOk()->assertJsonPath('data.landing.template', 'beacon');

        // Public profile with wrong token → published template (oasis), no error
        $noTokenRes = $this->getJson('/api/v1/public/academy/profile?preview=wrongtoken', ['X-Tenant-Slug' => 'tl_tok', 'Accept' => 'application/json']);
        $noTokenRes->assertOk()->assertJsonPath('data.landing.template', 'oasis');
    }
}
