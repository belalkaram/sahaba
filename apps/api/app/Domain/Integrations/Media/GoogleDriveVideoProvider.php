<?php

namespace App\Domain\Integrations\Media;

use App\Domain\Integrations\Contracts\VideoProviderInterface;
use App\Domain\Integrations\DTOs\VideoUploadRequest;
use App\Domain\Integrations\DTOs\VideoUploadResponse;
use App\Domain\Integrations\Exceptions\ProviderException;

class GoogleDriveVideoProvider implements VideoProviderInterface
{
    public function getProviderName(): string
    {
        return 'google_drive';
    }

    public function getEmbedUrl(string $externalVideoId, array $options = []): string
    {
        $fileId = $this->extractFileId($externalVideoId);

        return "https://drive.google.com/file/d/{$fileId}/preview";
    }

    public function uploadVideo(VideoUploadRequest $request): VideoUploadResponse
    {
        if (! $request->externalId) {
            throw new ProviderException('Google Drive media needs an existing file link.');
        }

        $fileId = $this->extractFileId($request->externalId);
        $clientId = config('services.google.client_id');

        return new VideoUploadResponse(
            externalVideoId: $fileId,
            embedUrl: $this->getEmbedUrl($fileId),
            playbackUrl: "https://drive.google.com/file/d/{$fileId}/view",
            status: 'ready',
            provider: 'google_drive',
            durationSeconds: null,
            sizeBytes: null,
            rawPayload: [
                'fileId' => $fileId,
                'name' => $request->title,
                'mimeType' => 'video/mp4',
                'google_drive_enabled' => true,
                'client_id_configured' => ! empty($clientId),
            ]
        );
    }

    /**
     * Extract Google Drive File ID from URL or input string.
     */
    public function extractFileId(string $input): string
    {
        $input = trim($input);
        if (preg_match('#/file/d/([a-zA-Z0-9_-]+)#', $input, $matches)) {
            return $matches[1];
        }
        if (preg_match('#[?&]id=([a-zA-Z0-9_-]+)#', $input, $matches)) {
            return $matches[1];
        }

        return $input;
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
