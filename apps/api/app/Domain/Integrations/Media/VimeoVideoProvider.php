<?php

namespace App\Domain\Integrations\Media;

use App\Domain\Integrations\Contracts\VideoProviderInterface;
use App\Domain\Integrations\DTOs\VideoUploadRequest;
use App\Domain\Integrations\DTOs\VideoUploadResponse;
use App\Domain\Integrations\Exceptions\ProviderException;

class VimeoVideoProvider implements VideoProviderInterface
{
    public function getProviderName(): string
    {
        return 'vimeo';
    }

    public function getEmbedUrl(string $externalVideoId, array $options = []): string
    {
        return "https://player.vimeo.com/video/{$externalVideoId}";
    }

    public function uploadVideo(VideoUploadRequest $request): VideoUploadResponse
    {
        if (! $request->externalId) {
            throw new ProviderException('Vimeo media needs an existing video link.');
        }

        // Accepts a bare id or a vimeo.com / player.vimeo.com link.
        $id = preg_match('#(\d{6,})#', $request->externalId, $m) ? $m[1] : $request->externalId;

        return new VideoUploadResponse(
            externalVideoId: $id,
            embedUrl: $this->getEmbedUrl($id),
            playbackUrl: "https://vimeo.com/{$id}",
            status: 'ready',
            provider: 'vimeo',
            durationSeconds: null,
            sizeBytes: null,
            rawPayload: [
                'uri' => "/videos/{$id}",
                'name' => $request->title,
                'status' => 'available',
            ]
        );
    }

    public function getVideoStatus(string $externalVideoId): string
    {
        return 'ready';
    }

    public function verifyWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        $computed = hash_hmac('sha256', $payload, $secret);

        return hash_equals($computed, $signature);
    }
}
