<?php

namespace App\Domain\Integrations\Media;

use App\Domain\Integrations\Contracts\VideoProviderInterface;
use App\Domain\Integrations\DTOs\VideoUploadRequest;
use App\Domain\Integrations\DTOs\VideoUploadResponse;
use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Google\Drive\DriveStorage;
use App\Domain\Integrations\Google\GoogleConnectionService;
use App\Domain\Integrations\Google\GoogleDriveClient;
use App\Domain\Integrations\Google\GoogleNotConnectedException;

/**
 * Google Drive media (ADR-008). Uploaded files go through MediaUploadService; this class registers pasted links
 * (verified through the tenant's Google connection when the app can see the file) and builds embed URLs.
 */
class GoogleDriveVideoProvider implements VideoProviderInterface
{
    public const VERIFIED = 'verified';

    public const UNVERIFIED = 'unverified';

    public function __construct(
        private readonly GoogleConnectionService $connections,
        private readonly GoogleDriveClient $drive,
        private readonly DriveStorage $storage,
    ) {}

    public function getProviderName(): string
    {
        return 'google_drive';
    }

    public function getEmbedUrl(string $externalVideoId, array $options = []): string
    {
        return 'https://drive.google.com/file/d/'.rawurlencode($this->extractFileId($externalVideoId)).'/preview';
    }

    public function uploadVideo(VideoUploadRequest $request): VideoUploadResponse
    {
        if (! $request->externalId) {
            throw new ProviderException('Google Drive media needs an existing file link.', 'google_drive');
        }

        $fileId = $this->extractFileId($request->externalId);
        if (! $this->isValidFileId($fileId)) {
            throw new InvalidDriveLinkException('رابط Google Drive غير صالح.');
        }

        $file = $this->connections->isConnected() ? $this->visibleFile($fileId) : null;

        if ($file !== null) {
            if ($file['trashed'] ?? false) {
                throw new InvalidDriveLinkException('هذا الملف موجود في سلة مهملات Google Drive.');
            }
            $mime = (string) ($file['mimeType'] ?? '');
            if ($request->mediaType === 'video' && ! str_starts_with($mime, 'video/')) {
                throw new InvalidDriveLinkException('الملف المرتبط ليس فيديو.');
            }
        }

        return $this->response($fileId, $file, $file !== null ? self::VERIFIED : self::UNVERIFIED);
    }

    /**
     * @param  array<string, mixed>|null  $file
     */
    public function response(string $fileId, ?array $file, string $verification): VideoUploadResponse
    {
        $durationMs = $file['videoMediaMetadata']['durationMillis'] ?? null;

        return new VideoUploadResponse(
            externalVideoId: $fileId,
            embedUrl: $this->getEmbedUrl($fileId),
            playbackUrl: 'https://drive.google.com/file/d/'.rawurlencode($fileId).'/view',
            status: $file !== null ? $this->statusOf($file) : 'ready',
            provider: 'google_drive',
            durationSeconds: $durationMs !== null ? (int) round(((int) $durationMs) / 1000) : null,
            sizeBytes: isset($file['size']) ? (int) $file['size'] : null,
            rawPayload: array_filter([
                'verification' => $verification,
                'file_name' => $file['name'] ?? null,
                'mime_type' => $file['mimeType'] ?? null,
            ], fn ($v) => $v !== null),
        );
    }

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

    public function isValidFileId(string $fileId): bool
    {
        return (bool) preg_match('/^[a-zA-Z0-9_-]{20,128}$/', $fileId);
    }

    public function getVideoStatus(string $externalVideoId): string
    {
        $file = $this->connections->isConnected() ? $this->visibleFile($this->extractFileId($externalVideoId)) : null;

        return $file !== null ? $this->statusOf($file) : 'ready';
    }

    public function verifyWebhookSignature(string $payload, string $signature, string $secret): bool
    {
        return hash_equals(hash_hmac('sha256', $payload, $secret), $signature);
    }

    /**
     * @param  array<string, mixed>  $file
     */
    public function statusOf(array $file): string
    {
        $isVideo = str_starts_with((string) ($file['mimeType'] ?? ''), 'video/');

        // Drive fills videoMediaMetadata once it has processed the video for playback.
        return $isVideo && empty($file['videoMediaMetadata']) ? 'processing' : 'ready';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function visibleFile(string $fileId): ?array
    {
        try {
            // Pasted links are checked with the academy's own account; pool accounts only see files they created.
            return $this->drive->getFile($this->storage->tenantAccess(), $fileId);
        } catch (GoogleNotConnectedException) {
            return null; // connection broke meanwhile: the link is kept as unverified
        }
    }
}
