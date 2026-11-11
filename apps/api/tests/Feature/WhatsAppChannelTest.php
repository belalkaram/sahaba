<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Domain\Communication\Channels\LogMessagingChannel;
use App\Domain\Communication\Channels\MessagingManager;
use App\Domain\Communication\Channels\WhatsAppCloudApiChannel;
use App\Domain\Communication\NotificationCatalog;
use App\Domain\Communication\NotificationService;
use App\Jobs\SendWhatsAppMessage;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantSetting;
use App\Models\TenantUser;
use App\Models\WhatsAppMessageLog;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WhatsAppChannelTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenantA;

    protected Tenant $tenantB;

    protected TenantUser $parentUser;

    protected ParentProfile $parentProfile;

    protected Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        $this->tenantA = Tenant::create([
            'name' => 'أكاديمية الواتساب أ',
            'slug' => 'p9-wa-a-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'school',
            'status' => 'active',
        ]);
        TenantDatabase::create([
            'tenant_id' => $this->tenantA->id,
            'connection_identifier' => 'tenant_'.$this->tenantA->slug,
            'status' => 'ready',
        ]);

        $this->tenantB = Tenant::create([
            'name' => 'أكاديمية أخرى ب',
            'slug' => 'p9-wa-b-'.uniqid(),
            'type' => 'organization',
            'organization_kind' => 'center',
            'status' => 'active',
        ]);
        TenantDatabase::create([
            'tenant_id' => $this->tenantB->id,
            'connection_identifier' => 'tenant_'.$this->tenantB->slug,
            'status' => 'ready',
        ]);

        $dbManager->migrateTenant($this->tenantA);
        $dbManager->migrateTenant($this->tenantB);

        $context->setTenant($this->tenantA);
        $dbManager->configureConnection($this->tenantA);

        app(RoleSynchronizer::class)->sync();

        $studentUser = TenantUser::create([
            'name' => 'طالب واتساب',
            'email' => 'student.wa@p9.test',
            'phone' => '+966501112233',
            'password' => 'Pass12345!',
            'type' => 'student',
            'status' => 'active',
        ]);
        $studentRole = Role::where('name', 'student')->first();
        $studentUser->roles()->attach($studentRole->id);

        $this->student = Student::create([
            'user_id' => $studentUser->id,
            'student_code' => 'STD-WA-01',
            'status' => 'active',
        ]);

        $this->parentUser = TenantUser::create([
            'name' => 'ولي أمر واتساب',
            'email' => 'parent.wa@p9.test',
            'phone' => '+966509998877',
            'password' => 'Pass12345!',
            'type' => 'parent',
            'status' => 'active',
        ]);
        $parentRole = Role::where('name', 'parent')->first();
        $this->parentUser->roles()->attach($parentRole->id);

        $this->parentProfile = ParentProfile::create([
            'user_id' => $this->parentUser->id,
            'status' => 'active',
            'whatsapp_opt_in' => true,
        ]);
        $this->student->parents()->attach($this->parentProfile->id, ['relation_type' => 'father']);
    }

    protected function tearDown(): void
    {
        DB::purge('tenant');
        parent::tearDown();
    }

    public function test_whatsapp_cloud_api_channel_sends_templated_request(): void
    {
        Http::fake([
            'https://graph.facebook.com/v19.0/123456789/messages' => Http::response([
                'messaging_product' => 'whatsapp',
                'contacts' => [['input' => '966509998877', 'wa_id' => '966509998877']],
                'messages' => [['id' => 'wamid.HBgLMTIzNDU2Nzg5']],
            ], 200),
        ]);

        $channel = new WhatsAppCloudApiChannel(
            token: 'test_meta_token_123',
            phoneNumberId: '123456789'
        );

        $result = $channel->sendTemplate(
            to: '+966 50 999 8877',
            templateName: 'sahaba_attendance_absent',
            parameters: ['student' => 'طالب واتساب', 'title' => 'حصة الفيزياء'],
            context: [
                'tenant_id' => $this->tenantA->id,
                'user_id' => $this->parentUser->id,
                'event_key' => 'attendance_absent',
            ]
        );

        $this->assertTrue($result->successful);
        $this->assertSame('wamid.HBgLMTIzNDU2Nzg5', $result->messageId);
        $this->assertSame('sent', $result->status);

        Http::assertSent(function (Request $request) {
            $authHeader = $request->header('Authorization')[0] ?? '';
            $body = $request->data();

            return str_contains($authHeader, 'Bearer test_meta_token_123')
                && $body['messaging_product'] === 'whatsapp'
                && $body['to'] === '966509998877'
                && $body['template']['name'] === 'sahaba_attendance_absent'
                && $body['template']['language']['code'] === 'ar';
        });

        // Verify message log was saved in tenant database
        $log = WhatsAppMessageLog::where('recipient_phone', '+966 50 999 8877')->first();
        $this->assertNotNull($log);
        $this->assertSame('sent', $log->status);
        $this->assertSame('wamid.HBgLMTIzNDU2Nzg5', $log->provider_message_id);
    }

    public function test_whatsapp_cloud_api_handles_error_without_throwing(): void
    {
        Http::fake([
            'https://graph.facebook.com/v19.0/123456789/messages' => Http::response([
                'error' => [
                    'message' => 'Template does not exist',
                    'type' => 'OAuthException',
                    'code' => 100,
                ],
            ], 400),
        ]);

        $channel = new WhatsAppCloudApiChannel(
            token: 'test_meta_token_123',
            phoneNumberId: '123456789'
        );

        $result = $channel->sendTemplate(
            to: '0509998877',
            templateName: 'invalid_template',
            parameters: [],
            context: ['tenant_id' => $this->tenantA->id]
        );

        $this->assertFalse($result->successful);
        $this->assertSame('failed', $result->status);
        $this->assertStringContainsString('Template does not exist', $result->error);

        $log = WhatsAppMessageLog::where('template_name', 'invalid_template')->first();
        $this->assertNotNull($log);
        $this->assertSame('failed', $log->status);
        $this->assertStringContainsString('Template does not exist', $log->error);
    }

    public function test_log_channel_is_used_when_credentials_not_configured(): void
    {
        // Neither env nor tenant setting has whatsapp enabled
        TenantSetting::setValue(TenantSetting::WHATSAPP_ENABLED, false);

        $manager = app(MessagingManager::class);
        $channel = $manager->channel();

        $this->assertInstanceOf(LogMessagingChannel::class, $channel);

        $result = $channel->sendTemplate(
            to: '0501234567',
            templateName: 'sahaba_test',
            parameters: ['arg1' => 'test'],
            context: ['tenant_id' => $this->tenantA->id]
        );

        $this->assertTrue($result->successful);
        $this->assertSame('logged', $result->status);

        $log = WhatsAppMessageLog::where('template_name', 'sahaba_test')->first();
        $this->assertNotNull($log);
        $this->assertSame('logged', $log->status);
    }

    public function test_parent_opted_out_does_not_receive_whatsapp(): void
    {
        Queue::fake();

        // Enable WhatsApp for the tenant
        TenantSetting::setValue(TenantSetting::WHATSAPP_ENABLED, true);
        TenantSetting::setValue(TenantSetting::WHATSAPP_PHONE_NUMBER_ID, '123456789');
        TenantSetting::setValue(TenantSetting::WHATSAPP_ACCESS_TOKEN, 'test_token');

        // Parent opts out
        $this->parentProfile->update(['whatsapp_opt_in' => false, 'whatsapp_opted_out_at' => now()]);

        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::ATTENDANCE_ABSENT,
            $this->student,
            ['title' => 'الرياضيات']
        );

        // Queue should NOT have SendWhatsAppMessage for parent
        Queue::assertNotPushed(SendWhatsAppMessage::class, function ($job) {
            return $job->phone === $this->parentUser->phone;
        });
    }

    public function test_parent_opted_in_queues_whatsapp_job(): void
    {
        Queue::fake();

        TenantSetting::setValue(TenantSetting::WHATSAPP_ENABLED, true);
        TenantSetting::setValue(TenantSetting::WHATSAPP_PHONE_NUMBER_ID, '123456789');
        TenantSetting::setValue(TenantSetting::WHATSAPP_ACCESS_TOKEN, 'test_token');

        $this->parentProfile->update(['whatsapp_opt_in' => true]);

        $service = app(NotificationService::class);
        $service->sendToStudent(
            NotificationCatalog::ATTENDANCE_ABSENT,
            $this->student,
            ['title' => 'الرياضيات']
        );

        Queue::assertPushed(SendWhatsAppMessage::class, function ($job) {
            return $job->phone === $this->parentUser->phone
                && $job->templateName === 'sahaba_attendance_absent'
                && $job->tenantId === $this->tenantA->id;
        });
    }

    public function test_tenant_database_isolation_prevents_cross_tenant_message_leak(): void
    {
        $dbManager = app(TenantDatabaseManager::class);
        $context = app(TenantContext::class);

        // Insert log in Tenant A
        $channel = new LogMessagingChannel;
        $channel->sendTemplate('0501111111', 'template_a', [], ['tenant_id' => $this->tenantA->id]);

        $this->assertSame(1, WhatsAppMessageLog::count());

        // Switch to Tenant B
        $context->setTenant($this->tenantB);
        $dbManager->configureConnection($this->tenantB);

        // In Tenant B, message logs must be empty (complete isolation)
        $this->assertSame(0, WhatsAppMessageLog::count());
    }
}
