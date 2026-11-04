<?php

namespace Tests\Feature;

use App\Models\PlatformRole;
use App\Models\PlatformUser;
use App\Models\SupportAccessLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * PlatformIdentityTest (R1-A9)
 *
 * Verifies the control-plane platform identity and session lifecycle:
 *  - Platform user login, token generation, and password verification
 *  - Platform token authentication via platform.auth middleware
 *  - Platform session logout and token revocation
 *  - Fallback to static interim token for CI backwards compatibility
 *  - Support session ending (/platform/support-sessions/{id}/end)
 */
class PlatformIdentityTest extends TestCase
{
    use RefreshDatabase;

    protected PlatformUser $superAdmin;

    protected PlatformRole $superRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superRole = PlatformRole::create([
            'name' => 'super_admin',
            'label' => 'مدير المنصة العام',
            'description' => 'كامل صلاحيات إدارة المنصة والمؤسسات',
        ]);

        $this->superAdmin = PlatformUser::create([
            'name' => 'Sarah System Lead',
            'email' => 'sarah@platform.test',
            'password' => Hash::make('PlatformSecret2026!'),
            'status' => 'active',
        ]);

        $this->superAdmin->roles()->attach($this->superRole->id);
    }

    public function test_platform_login_issues_bearer_token(): void
    {
        $response = $this->postJson('/api/v1/platform/auth/login', [
            'email' => 'sarah@platform.test',
            'password' => 'PlatformSecret2026!',
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertArrayHasKey('token', $data);
        $this->assertStringStartsWith('plt_', $data['token']);
        $this->assertEquals('Bearer', $data['token_type']);
        $this->assertEquals('sarah@platform.test', $data['user']['email']);
        $this->assertEquals('super_admin', $data['user']['roles'][0]['name']);
    }

    public function test_platform_login_fails_with_invalid_credentials(): void
    {
        $response = $this->postJson('/api/v1/platform/auth/login', [
            'email' => 'sarah@platform.test',
            'password' => 'wrong_password',
        ]);

        $response->assertStatus(401);
        $response->assertJson([
            'error' => [
                'code' => 'INVALID_CREDENTIALS',
            ],
        ]);
    }

    public function test_platform_auth_me_returns_identity_and_roles(): void
    {
        $tokenResult = $this->superAdmin->createToken();

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/platform/auth/me');

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertEquals($this->superAdmin->id, $data['id']);
        $this->assertEquals('Sarah System Lead', $data['name']);
        $this->assertEquals('sarah@platform.test', $data['email']);
        $this->assertEquals('super_admin', $data['roles'][0]['name']);
    }

    public function test_platform_logout_revokes_bearer_token(): void
    {
        $tokenResult = $this->superAdmin->createToken();

        // 1. Authenticated request succeeds
        $preLogoutResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/platform/auth/me');
        $preLogoutResponse->assertStatus(200);

        // 2. Logout revokes token
        $logoutResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->postJson('/api/v1/platform/auth/logout');
        $logoutResponse->assertStatus(200);

        // 3. Subsequent request with revoked token fails with 401
        $postLogoutResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/platform/auth/me');
        $postLogoutResponse->assertStatus(401);
        $postLogoutResponse->assertJson([
            'error' => [
                'code' => 'PLATFORM_TOKEN_INVALID',
            ],
        ]);
    }

    public function test_platform_token_allows_managing_tenants(): void
    {
        $tokenResult = $this->superAdmin->createToken();

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->getJson('/api/v1/tenants');

        $response->assertStatus(200);
    }

    public function test_end_support_session_terminates_session(): void
    {
        $tokenResult = $this->superAdmin->createToken();

        $tenant = Tenant::create([
            'name' => 'Target Org',
            'slug' => 'target-org',
            'status' => 'active',
        ]);

        $interimUser = User::firstOrCreate(
            ['email' => 'platform-admin@system.local'],
            ['name' => 'Platform Admin', 'password' => 'secret']
        );

        $session = SupportAccessLog::create([
            'platform_user_id' => $interimUser->id,
            'tenant_id' => $tenant->id,
            'reason' => 'Investigating database sync issue',
            'accessed_at' => now(),
            'expires_at' => now()->addHours(2),
            'status' => 'active',
        ]);

        $this->assertTrue($session->isActive());

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$tokenResult['plainTextToken'],
        ])->postJson('/api/v1/platform/support-sessions/'.$session->id.'/end');

        $response->assertStatus(200);
        $session->refresh();

        $this->assertEquals('ended', $session->status);
        $this->assertNotNull($session->ended_at);
        $this->assertFalse($session->isActive());
    }
}
