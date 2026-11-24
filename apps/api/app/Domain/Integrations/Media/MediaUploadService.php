<?php

namespace App\Domain\Integrations\Media;

use App\Domain\Integrations\Google\Drive\DriveStorage;
use App\Domain\Integrations\Google\GoogleDriveClient;
use App\Jobs\FinalizeMediaUpload;
use App\Jobs\PollDriveVideoProcessing;
use App\Models\MediaAsset;
use App\Models\MediaUpload;
use App\Models\PlatformDriveReservation;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

/**
 * Direct browser ⇒ Google Drive uploads (ADR-008, ADR-009). The bytes never pass through the API: it opens a
 * resumable session on the chosen Drive, reports how much Google holds so the browser can resume, and a `media`
 * queue worker finalises the file.
 */
class MediaUploadService
{
    private const SESSION_DAYS = 7; // Google keeps resumable sessions for one week

    public function __construct(
        private readonly GoogleDriveClient $drive,
        private readonly GoogleDriveVideoProvider $provider,
        private readonly DriveStorage $storage,
        private readonly TenantContext $tenants,
    ) {}

    /**
     * @param  array{title: string, file_name: string, mime_type: string, size_bytes: int, media_type?: string, course_id?: ?string, lesson_id?: ?string}  $data
     */
    public function start(array $data, TenantUser $user, ?string $origin): MediaUpload
    {
        $tenant = $this->tenants->getTenantOrFail();
        $expiresAt = now()->addDays(self::SESSION_DAYS);
        $target = $this->storage->targetForUpload($tenant, (int) $data['size_bytes'], $expiresAt);

        try {
            $sessionUrl = $this->drive->startResumableUpload($target->access, $target->folderId, $data['file_name'], $data['mime_type'], $data['size_bytes'], $origin);
        } catch (\Throwable $e) {
            $this->storage->release($target->reservationId);
            throw $e;
        }

        $ref = $target->access->storageRef();
        $upload = MediaUpload::create([
            'provider' => 'google_drive',
            'title' => $data['title'],
            'media_type' => $data['media_type'] ?? 'video',
            'course_id' => $data['course_id'] ?? null,
            'lesson_id' => $data['lesson_id'] ?? null,
            'file_name' => $data['file_name'],
            'mime_type' => $data['mime_type'],
            'size_bytes' => $data['size_bytes'],
            'session_url' => $sessionUrl,
            'status' => MediaUpload::PENDING,
            'created_by' => $user->id,
            'expires_at' => $expiresAt,
            'storage_kind' => $ref['kind'],
            'storage_account_id' => $ref['account_id'] ?? null,
            'reservation_id' => $target->reservationId,
        ]);

        if ($target->reservationId) {
            PlatformDriveReservation::query()->whereKey($target->reservationId)->update(['upload_id' => $upload->id]);
        }

        return $upload;
    }

    /**
     * How many bytes Google holds, so the browser resumes from there instead of starting over.
     *
     * @return array{complete: bool, received_bytes: int}
     */
    public function progress(MediaUpload $upload): array
    {
        if ($upload->status !== MediaUpload::PENDING) {
            return ['complete' => true, 'received_bytes' => (int) $upload->size_bytes];
        }

        $status = $this->drive->resumableStatus($this->storage->accessFor($upload->storageRef()), $upload->session_url, (int) $upload->size_bytes);

        return ['complete' => $status['complete'], 'received_bytes' => $status['received_bytes']];
    }

    /**
     * Every byte is at Google: hand the slow part (checks, sharing, asset) to a `media` worker.
     *
     * @throws UploadIncompleteException while Google has not received every byte
     */
    public function requestCompletion(MediaUpload $upload): MediaUpload
    {
        if ($upload->status !== MediaUpload::PENDING) {
            return $upload;
        }

        if (! $this->progress($upload)['complete']) {
            throw new UploadIncompleteException;
        }

        $claimed = MediaUpload::query()->whereKey($upload->id)->where('status', MediaUpload::PENDING)
            ->update(['status' => MediaUpload::FINALIZING]);
        if ($claimed === 1) {
            FinalizeMediaUpload::dispatch($this->tenants->getTenantOrFail()->id, $upload->id);
        }

        return $upload->refresh();
    }

    /**
     * Run by FinalizeMediaUpload. A file that fails the checks marks the upload failed; Google outages are thrown
     * so the job retries.
     */
    public function finalize(MediaUpload $upload): ?MediaAsset
    {
        if ($upload->status === MediaUpload::COMPLETED && $upload->media_asset_id) {
            return MediaAsset::query()->find($upload->media_asset_id);
        }
        if ($upload->status !== MediaUpload::FINALIZING) {
            return null;
        }

        $ref = $upload->storageRef();
        $access = $this->storage->accessFor($ref);
        $status = $this->drive->resumableStatus($access, $upload->session_url, (int) $upload->size_bytes);
        if (! $status['complete']) {
            $this->fail($upload, 'incomplete');

            return null;
        }

        $fileId = (string) $status['file']['id'];
        $file = $this->drive->getFile($access, $fileId);
        $tenant = $this->tenants->getTenantOrFail();
        $inFolder = $file !== null && collect($file['parents'] ?? [])->contains(fn ($parent) => $this->storage->isTenantFolder($ref, $tenant, (string) $parent));

        if (! $inFolder) {
            $this->fail($upload, 'not_in_tenant_folder');

            return null;
        }
        if ($upload->media_type === 'video' && ! str_starts_with((string) ($file['mimeType'] ?? ''), 'video/')) {
            $this->fail($upload, 'not_a_video');

            return null;
        }

        $this->drive->shareAnyoneWithLink($access, $fileId);
        $response = $this->provider->response($fileId, $file, GoogleDriveVideoProvider::VERIFIED);

        $media = DB::connection('tenant')->transaction(function () use ($upload, $response, $fileId, $ref) {
            $media = MediaAsset::create([
                'title' => $upload->title,
                'provider' => 'google_drive',
                'external_media_id' => $fileId,
                'media_type' => $upload->media_type,
                'embed_url' => $response->embedUrl,
                'playback_url' => $response->playbackUrl,
                'status' => $response->status,
                'course_id' => $upload->course_id,
                'lesson_id' => $upload->lesson_id,
                'size_bytes' => $response->sizeBytes,
                'duration_seconds' => $response->durationSeconds,
                'metadata' => $response->rawPayload + ['source' => 'upload', 'storage' => $ref],
            ]);

            $upload->forceFill([
                'status' => MediaUpload::COMPLETED,
                'external_file_id' => $fileId,
                'media_asset_id' => $media->id,
            ])->save();

            AuditLogger::log('media.uploaded', null, 'media_asset', $media->id, [
                'provider' => 'google_drive',
                'external_media_id' => $fileId,
                'size_bytes' => $response->sizeBytes,
                'storage' => $ref['kind'],
            ], 'user', $upload->created_by);

            return $media;
        });

        // Google now counts the file in the account usage, so the reservation is no longer needed.
        $this->storage->release($upload->reservation_id);

        if ($media->status === 'processing') {
            PollDriveVideoProcessing::dispatch($this->tenants->getTenantOrFail()->id, $media->id, 0)
                ->delay(now()->addMinutes(PollDriveVideoProcessing::DELAYS_MINUTES[0]));
        }

        return $media;
    }

    public function fail(MediaUpload $upload, string $reason): void
    {
        $upload->forceFill(['status' => MediaUpload::FAILED, 'failure_reason' => $reason])->save();
        $this->storage->release($upload->reservation_id);
        AuditLogger::log('media.upload_failed', null, 'media_upload', $upload->id, ['reason' => $reason], 'system');
    }

    /**
     * What the uploader sees about the upload. The session URL is returned only while it can still be used.
     *
     * @return array<string, mixed>
     */
    public function present(MediaUpload $upload, ?array $progress = null): array
    {
        $resumable = $upload->status === MediaUpload::PENDING && $upload->expires_at?->isFuture();

        return array_filter([
            'id' => $upload->id,
            'status' => $upload->status,
            'title' => $upload->title,
            'file_name' => $upload->file_name,
            'size_bytes' => (int) $upload->size_bytes,
            'received_bytes' => $progress['received_bytes'] ?? null,
            'upload_url' => $resumable ? $upload->session_url : null,
            'expires_at' => $upload->expires_at?->toIso8601String(),
            'failure_reason' => $upload->failure_reason,
            'media_asset' => $upload->media_asset_id ? MediaAsset::query()->find($upload->media_asset_id) : null,
        ], fn ($v) => $v !== null);
    }
}
