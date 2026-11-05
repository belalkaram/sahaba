<?php

namespace App\Jobs;

use App\Domain\Communication\Channels\MessagingChannel;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;

/**
 * OD-33: Queued delivery of approved WhatsApp messages.
 * Runs within tenant context via TenantRunner to enforce tenant isolation.
 */
class SendWhatsAppMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    /**
     * @param  array<string, scalar|null>  $parameters
     */
    public function __construct(
        public readonly string $tenantId,
        public readonly string $phone,
        public readonly string $templateName,
        public readonly array $parameters = [],
        public readonly ?string $userId = null,
        public readonly ?string $eventKey = null,
    ) {}

    public function handle(TenantRunner $runner): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $runner->run($tenant, function () {
            /** @var MessagingChannel $channel */
            $channel = app(MessagingChannel::class);

            $result = $channel->sendTemplate(
                to: $this->phone,
                templateName: $this->templateName,
                parameters: $this->parameters,
                context: [
                    'tenant_id' => $this->tenantId,
                    'user_id' => $this->userId,
                    'event_key' => $this->eventKey,
                ]
            );

            if (! $result->successful && $this->attempts() < $this->tries) {
                throw new RuntimeException("WhatsApp delivery failed: {$result->error}");
            }
        });
    }
}
