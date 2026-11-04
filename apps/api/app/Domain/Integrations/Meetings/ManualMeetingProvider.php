<?php

namespace App\Domain\Integrations\Meetings;

use App\Domain\Integrations\Contracts\MeetingProviderInterface;
use App\Domain\Integrations\DTOs\MeetingRequest;
use App\Domain\Integrations\DTOs\MeetingResponse;
use App\Domain\Integrations\Exceptions\ProviderException;

/**
 * OD-5: a link the teacher created elsewhere and pasted here. Nothing is generated or verified
 * against the provider, and the UI labels it «رابط يدوي».
 */
class ManualMeetingProvider implements MeetingProviderInterface
{
    public function getProviderName(): string
    {
        return 'manual';
    }

    public function createMeeting(MeetingRequest $request): MeetingResponse
    {
        $link = trim((string) ($request->settings['meet_url'] ?? $request->settings['meeting_code'] ?? ''));

        if ($link === '') {
            throw new ProviderException('A meeting link is required.');
        }

        // A bare Meet code (abc-defg-hij) is accepted and expanded.
        if (preg_match('/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i', $link)) {
            $link = 'https://meet.google.com/'.strtolower($link);
        }

        if (! preg_match('#^https://#i', $link) || filter_var($link, FILTER_VALIDATE_URL) === false) {
            throw new ProviderException('The meeting link must be a valid https:// URL.');
        }

        $code = preg_match('#meet\.google\.com/([a-z]{3}-[a-z]{4}-[a-z]{3})#i', $link, $m)
            ? strtolower($m[1])
            : 'manual-'.substr(hash('sha256', $link), 0, 16);

        return new MeetingResponse(
            externalMeetingId: $code,
            joinUrl: $link,
            hostUrl: $link,
            passcode: null,
            provider: 'manual',
            rawPayload: ['source' => 'manual_link'],
        );
    }

    public function cancelMeeting(string $externalMeetingId): bool
    {
        return true;
    }

    public function getJoinUrl(string $externalMeetingId, array $userContext = []): string
    {
        throw new ProviderException('Manual meetings use the stored link.');
    }

    public function verifyWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        return false;
    }
}
