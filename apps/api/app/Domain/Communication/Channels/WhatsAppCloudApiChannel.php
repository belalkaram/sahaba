<?php

namespace App\Domain\Communication\Channels;

use App\Models\WhatsAppMessageLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Adapter for Meta WhatsApp Business Cloud API (Graph API).
 * AGENTS §3: Kept behind MessagingChannel adapter.
 * AGENTS §7: Secrets (access token) never enter logs.
 */
class WhatsAppCloudApiChannel implements MessagingChannel
{
    public function __construct(
        protected string $token,
        protected string $phoneNumberId,
        protected string $apiUrl = 'https://graph.facebook.com/v19.0'
    ) {}

    public function sendTemplate(
        string $to,
        string $templateName,
        array $parameters = [],
        array $context = []
    ): MessageSendResult {
        $sanitizedPhone = $this->sanitizePhone($to);

        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $sanitizedPhone,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => [
                    'code' => 'ar',
                ],
            ],
        ];

        if (! empty($parameters)) {
            $bodyParameters = [];
            foreach ($parameters as $val) {
                $bodyParameters[] = [
                    'type' => 'text',
                    'text' => (string) $val,
                ];
            }

            $payload['template']['components'] = [
                [
                    'type' => 'body',
                    'parameters' => $bodyParameters,
                ],
            ];
        }

        try {
            $endpoint = rtrim($this->apiUrl, '/')."/{$this->phoneNumberId}/messages";
            $response = Http::withToken($this->token)
                ->timeout(10)
                ->post($endpoint, $payload);

            if ($response->successful()) {
                $providerId = $response->json('messages.0.id');

                $this->persistLog($context, $to, $templateName, $parameters, 'sent', $providerId, null);

                return new MessageSendResult(
                    successful: true,
                    messageId: $providerId,
                    status: 'sent'
                );
            }

            $errorMessage = $response->json('error.message') ?? 'WhatsApp Cloud API error: HTTP '.$response->status();

            Log::warning('[WhatsApp Cloud API] Message failed', [
                'to' => $sanitizedPhone,
                'template' => $templateName,
                'error' => $errorMessage,
            ]);

            $this->persistLog($context, $to, $templateName, $parameters, 'failed', null, $errorMessage);

            return new MessageSendResult(
                successful: false,
                error: $errorMessage,
                status: 'failed'
            );
        } catch (Throwable $e) {
            $errorMessage = $e->getMessage();

            Log::warning('[WhatsApp Cloud API] Exception during send', [
                'to' => $sanitizedPhone,
                'template' => $templateName,
                'error' => $errorMessage,
            ]);

            $this->persistLog($context, $to, $templateName, $parameters, 'failed', null, $errorMessage);

            return new MessageSendResult(
                successful: false,
                error: $errorMessage,
                status: 'failed'
            );
        }
    }

    private function sanitizePhone(string $phone): string
    {
        // Strip out non-digits except a leading +
        $digits = preg_replace('/[^\d]/', '', $phone);

        return $digits;
    }

    private function persistLog(
        array $context,
        string $to,
        string $templateName,
        array $parameters,
        string $status,
        ?string $providerId,
        ?string $error
    ): void {
        try {
            WhatsAppMessageLog::create([
                'tenant_id' => $context['tenant_id'] ?? null,
                'recipient_phone' => $to,
                'recipient_user_id' => $context['user_id'] ?? null,
                'event_key' => $context['event_key'] ?? 'unknown',
                'template_name' => $templateName,
                'parameters' => $parameters,
                'status' => $status,
                'provider_message_id' => $providerId,
                'error' => $error,
            ]);
        } catch (Throwable) {
            // Logging failure must not break process
        }
    }
}
