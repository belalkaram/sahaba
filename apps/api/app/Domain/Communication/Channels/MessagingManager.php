<?php

namespace App\Domain\Communication\Channels;

use App\Models\TenantSetting;
use App\Tenancy\TenantContext;

class MessagingManager
{
    public function __construct(
        protected ?TenantContext $context = null
    ) {}

    public function channel(): MessagingChannel
    {
        $enabled = (bool) (TenantSetting::getValue(TenantSetting::WHATSAPP_ENABLED, config('services.whatsapp.enabled', false)));
        $token = TenantSetting::getValue(TenantSetting::WHATSAPP_ACCESS_TOKEN, config('services.whatsapp.token'));
        $phoneId = TenantSetting::getValue(TenantSetting::WHATSAPP_PHONE_NUMBER_ID, config('services.whatsapp.phone_number_id'));

        if ($enabled && ! empty($token) && ! empty($phoneId)) {
            $apiUrl = (string) config('services.whatsapp.api_url', 'https://graph.facebook.com/v19.0');

            return new WhatsAppCloudApiChannel((string) $token, (string) $phoneId, $apiUrl);
        }

        return new LogMessagingChannel;
    }
}
