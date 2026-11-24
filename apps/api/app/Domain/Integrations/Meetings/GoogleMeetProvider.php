<?php

namespace App\Domain\Integrations\Meetings;

use App\Domain\Integrations\Contracts\MeetingProviderInterface;
use App\Domain\Integrations\DTOs\MeetingRequest;
use App\Domain\Integrations\DTOs\MeetingResponse;
use App\Domain\Integrations\Google\GoogleCalendarClient;
use Illuminate\Support\Str;

/**
 * R8-6: a real Meet conference created as a Google Calendar event on the tenant's connected account.
 * The external id is the calendar event id (needed to cancel it); the join link is stored on the meeting.
 */
class GoogleMeetProvider implements MeetingProviderInterface
{
    public function __construct(private readonly GoogleCalendarClient $calendar) {}

    public function getProviderName(): string
    {
        return 'google_meet';
    }

    public function createMeeting(MeetingRequest $request): MeetingResponse
    {
        $event = $this->calendar->createMeetEvent(
            $request->title,
            $request->description,
            $request->startTime ?? now()->toDateTimeImmutable(),
            $request->durationMinutes,
            $request->idempotencyKey ?: (string) Str::uuid(),
        );

        return new MeetingResponse(
            externalMeetingId: (string) $event['id'],
            joinUrl: (string) $event['hangoutLink'],
            hostUrl: (string) $event['hangoutLink'],
            provider: 'google_meet',
            rawPayload: [
                'calendar_event_id' => $event['id'],
                'calendar_html_link' => $event['htmlLink'] ?? null,
                'meet_code' => $event['conferenceData']['conferenceId'] ?? $this->extractMeetingCode((string) $event['hangoutLink']),
            ],
        );
    }

    public function extractMeetingCode(string $input): string
    {
        $input = trim($input);
        if (preg_match('#meet\.google\.com/([a-z]{3}-[a-z]{4}-[a-z]{3})#i', $input, $matches)) {
            return strtolower($matches[1]);
        }
        if (preg_match('#^[a-z]{3}-[a-z]{4}-[a-z]{3}$#i', $input)) {
            return strtolower($input);
        }

        return $input;
    }

    /** Meetings keep the link Google returned; this is only a fallback for a bare Meet code. */
    public function getJoinUrl(string $externalMeetingId, array $userContext = []): string
    {
        return 'https://meet.google.com/'.$this->extractMeetingCode($externalMeetingId);
    }

    public function cancelMeeting(string $externalMeetingId): bool
    {
        return $this->calendar->deleteEvent($externalMeetingId);
    }

    public function verifyWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        return hash_equals(hash_hmac('sha256', $payload, $secret), $signature);
    }
}
