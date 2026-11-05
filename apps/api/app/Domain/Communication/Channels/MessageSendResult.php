<?php

namespace App\Domain\Communication\Channels;

class MessageSendResult
{
    public function __construct(
        public readonly bool $successful,
        public readonly ?string $messageId = null,
        public readonly ?string $error = null,
        public readonly string $status = 'sent',
    ) {}
}
