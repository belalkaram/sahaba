<?php

namespace App\Domain\Communication\Channels;

/**
 * AGENTS §3: Provider SDKs and communication channels behind adapters/interfaces.
 */
interface MessagingChannel
{
    /**
     * Send an approved template message to a phone number.
     *
     * @param  string  $to  Recipient phone number
     * @param  string  $templateName  Meta WhatsApp Business approved template name
     * @param  array<string, scalar|null>  $parameters  Positional or named parameters
     * @param  array<string, mixed>  $context  Metadata for auditing/logging (tenant_id, user_id, event_key)
     */
    public function sendTemplate(
        string $to,
        string $templateName,
        array $parameters = [],
        array $context = []
    ): MessageSendResult;
}
