<?php

namespace App\Domain\Communication\Channels;

use App\Models\WhatsAppMessageLog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class LogMessagingChannel implements MessagingChannel
{
    public function sendTemplate(
        string $to,
        string $templateName,
        array $parameters = [],
        array $context = []
    ): MessageSendResult {
        $messageId = 'log-'.(string) Str::uuid();

        Log::info('[WhatsApp Log Channel] Outgoing message', [
            'to' => $to,
            'template' => $templateName,
            'parameters' => $parameters,
            'context' => $context,
            'message_id' => $messageId,
        ]);

        try {
            WhatsAppMessageLog::create([
                'tenant_id' => $context['tenant_id'] ?? null,
                'recipient_phone' => $to,
                'recipient_user_id' => $context['user_id'] ?? null,
                'event_key' => $context['event_key'] ?? 'unknown',
                'template_name' => $templateName,
                'parameters' => $parameters,
                'status' => 'logged',
                'provider_message_id' => $messageId,
            ]);
        } catch (Throwable $e) {
            Log::warning('[WhatsApp Log Channel] Failed to persist message log', [
                'error' => $e->getMessage(),
            ]);
        }

        return new MessageSendResult(
            successful: true,
            messageId: $messageId,
            status: 'logged'
        );
    }
}
