<?php

namespace App\Domain\Integrations\Google;

use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Exceptions\ProviderTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Google Calendar v3 calls that create real Meet conferences (R8-6), with the tenant's own Google
 * connection (ADR-008: the `calendar.events` scope is granted in the same consent as Drive).
 */
class GoogleCalendarClient
{
    public const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    public function __construct(private readonly GoogleConnectionService $connections) {}

    /**
     * Create a calendar event with a Meet conference. Students are not added as attendees: the
     * platform hands out the link after its own access check, so Google sends no invitations.
     *
     * @return array<string, mixed> the event, including `hangoutLink`
     */
    public function createMeetEvent(string $title, ?string $description, \DateTimeInterface $start, int $minutes, string $requestId): array
    {
        $end = \DateTimeImmutable::createFromInterface($start)->modify("+{$minutes} minutes");

        $event = $this->call(fn ($http) => $http->post(self::API.'?conferenceDataVersion=1&sendUpdates=none', [
            'summary' => $title,
            'description' => $description,
            'start' => ['dateTime' => $start->format(\DateTimeInterface::RFC3339)],
            'end' => ['dateTime' => $end->format(\DateTimeInterface::RFC3339)],
            'conferenceData' => ['createRequest' => [
                'requestId' => $requestId,
                'conferenceSolutionKey' => ['type' => 'hangoutsMeet'],
            ]],
        ]))->json();

        // Google may still be creating the conference; read the event once more before giving up.
        if (empty($event['hangoutLink']) && ! empty($event['id'])) {
            $event = $this->call(fn ($http) => $http->get(self::API.'/'.rawurlencode($event['id']), ['conferenceDataVersion' => 1]))->json();
        }

        if (empty($event['hangoutLink'])) {
            throw new ProviderException('Google did not create a Meet conference for the event.', 'google_meet');
        }

        return $event;
    }

    /** Deleting an event that is already gone counts as cancelled. */
    public function deleteEvent(string $eventId): bool
    {
        $response = $this->call(
            fn ($http) => $http->delete(self::API.'/'.rawurlencode($eventId).'?sendUpdates=none'),
            allow: [404, 410],
        );

        return true;
    }

    /** @param  array<int, int>  $allow  statuses that are not errors */
    private function call(callable $request, array $allow = []): Response
    {
        $connection = $this->connections->activeConnection();

        try {
            $response = $request(Http::withToken($connection->access_token)->acceptJson()->timeout(20));
        } catch (ConnectionException $e) {
            throw new ProviderTimeoutException('Google Calendar did not answer.', 'google_meet', 504, $e);
        }

        if ($response->status() === 401) {
            throw new GoogleNotConnectedException('Google rejected the access token.');
        }

        if (! $response->successful() && ! in_array($response->status(), $allow, true)) {
            $reason = $response->json('error.errors.0.reason') ?? $response->json('error.status') ?? $response->status();

            throw new ProviderException('Google Calendar request failed: '.$reason, 'google_meet');
        }

        return $response;
    }
}
