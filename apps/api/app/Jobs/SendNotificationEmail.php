<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

/**
 * Sends one notification email. Carries rendered text only, so it needs no tenant database.
 * Delivery depends on MAIL_MAILER (the `log` mailer until SMTP credentials are provided, OD-13).
 */
class SendNotificationEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        public readonly string $email,
        public readonly string $recipientName,
        public readonly string $tenantName,
        public readonly string $title,
        public readonly string $body,
        public readonly ?string $brandColor = null,
    ) {}

    public function handle(): void
    {
        Mail::send('emails.notification', [
            'recipientName' => $this->recipientName,
            'tenantName' => $this->tenantName,
            'title' => $this->title,
            'body' => $this->body,
            'brandColor' => $this->brandColor ?: '#0C7F6D',
        ], function ($message) {
            $message->to($this->email, $this->recipientName)
                ->subject("{$this->title} — {$this->tenantName}");
        });
    }
}
