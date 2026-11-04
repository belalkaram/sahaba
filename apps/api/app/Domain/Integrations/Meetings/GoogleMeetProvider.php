<?php

namespace App\Domain\Integrations\Meetings;

use App\Domain\Integrations\Contracts\MeetingProviderInterface;
use App\Domain\Integrations\DTOs\MeetingRequest;
use App\Domain\Integrations\DTOs\MeetingResponse;

class GoogleMeetProvider implements MeetingProviderInterface
{
    public function getProviderName(): string
    {
        return 'google_meet';
    }

    /**
     * R8-6: real creation needs the tenant Google connection (Calendar API, conferenceData), which
     * is not available yet. A generated code would be a link to a meeting that does not exist, so
     * this refuses; teachers paste a real link through the manual provider instead.
     */
    public function createMeeting(MeetingRequest $request): MeetingResponse
    {
        throw new ProviderException('Google account is not connected for this tenant.');
    }

    /**
     * Extract clean Google Meet code from input string or URL.
     */
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

    public function getJoinUrl(string $externalMeetingId, array $userContext = []): string
    {
        return "https://meet.google.com/{$externalMeetingId}";
    }

    public function cancelMeeting(string $externalMeetingId): bool
    {
        return true;
    }

    public function verifyWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        $computed = hash_hmac('sha256', $payload, $secret);

        return hash_equals($computed, $signature);
    }
}
