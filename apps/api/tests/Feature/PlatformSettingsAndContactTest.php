<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\ContactMessage;
use App\Models\PlatformUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * R7F: platform settings (OD-20 demo login switch), public config, real contact form.
 */
class PlatformSettingsAndContactTest extends TestCase
{
    use RefreshDatabase;

    private function platformHeaders(): array
    {
        $user = PlatformUser::create([
            'name' => 'Platform Lead',
            'email' => 'lead@platform.test',
            'password' => Hash::make('PlatformSecret2026!'),
            'status' => 'active',
        ]);

        $login = $this->postJson('/api/v1/platform/auth/login', [
            'email' => $user->email,
            'password' => 'PlatformSecret2026!',
        ]);
        $login->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('data.token')];
    }

    public function test_demo_login_is_off_by_default_in_public_config(): void
    {
        $this->getJson('/api/v1/public/config')
            ->assertOk()
            ->assertJsonPath('data.demo_login_enabled', false);
    }

    public function test_platform_admin_can_toggle_demo_login_and_it_is_audited(): void
    {
        $headers = $this->platformHeaders();

        $this->putJson('/api/v1/platform/settings', ['demo_login_enabled' => true], $headers)
            ->assertOk()
            ->assertJsonPath('data.demo_login_enabled', true);

        $this->getJson('/api/v1/public/config')->assertJsonPath('data.demo_login_enabled', true);
        $this->assertTrue(AuditLog::where('action', 'platform.settings.updated')->exists());

        $this->putJson('/api/v1/platform/settings', ['demo_login_enabled' => false], $headers)->assertOk();
        $this->getJson('/api/v1/public/config')->assertJsonPath('data.demo_login_enabled', false);
    }

    public function test_platform_endpoints_require_platform_authentication(): void
    {
        $this->getJson('/api/v1/platform/settings')->assertUnauthorized();
        $this->putJson('/api/v1/platform/settings', ['demo_login_enabled' => true])->assertUnauthorized();
        $this->getJson('/api/v1/public/config')->assertJsonPath('data.demo_login_enabled', false);
        $this->getJson('/api/v1/platform/contact-messages')->assertUnauthorized();
    }

    public function test_settings_update_validates_payload(): void
    {
        $this->putJson('/api/v1/platform/settings', ['demo_login_enabled' => 'maybe'], $this->platformHeaders())
            ->assertStatus(422);
    }

    public function test_contact_form_stores_message_for_platform_staff(): void
    {
        $this->postJson('/api/v1/public/contact', [
            'name' => 'نورة',
            'email' => 'noura@example.com',
            'institution' => 'أكاديمية اختبار',
            'message' => 'أرغب في معرفة المزيد عن المنصة.',
        ])->assertCreated();

        $this->assertDatabaseHas('contact_messages', ['email' => 'noura@example.com', 'status' => 'new']);

        $headers = $this->platformHeaders();
        $id = ContactMessage::first()->id;

        $this->getJson('/api/v1/platform/contact-messages', $headers)
            ->assertOk()
            ->assertJsonPath('data.messages.0.email', 'noura@example.com');

        $this->postJson("/api/v1/platform/contact-messages/{$id}/handled", [], $headers)
            ->assertOk()
            ->assertJsonPath('data.message.status', 'handled');
    }

    public function test_contact_form_rejects_invalid_input(): void
    {
        $this->postJson('/api/v1/public/contact', ['name' => '', 'email' => 'bad', 'message' => 'short'])
            ->assertStatus(422);
        $this->assertSame(0, ContactMessage::count());
    }
}
