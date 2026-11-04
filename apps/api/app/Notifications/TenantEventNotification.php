<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * In-app notification row. Email is a separate queued job (SendNotificationEmail) so the worker
 * never needs the tenant database just to send mail.
 */
class TenantEventNotification extends Notification
{
    public function __construct(
        public readonly string $event,
        public readonly string $title,
        public readonly string $message,
        public readonly ?string $url = null,
        public readonly ?string $dedupeKey = null,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, string|null>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'event' => $this->event,
            'title' => $this->title,
            'message' => $this->message,
            'url' => $this->url,
            'dedupe_key' => $this->dedupeKey,
        ];
    }
}
