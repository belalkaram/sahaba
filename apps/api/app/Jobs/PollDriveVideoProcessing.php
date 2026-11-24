<?php

namespace App\Jobs;

use App\Domain\Integrations\Google\Drive\DriveStorage;
use App\Domain\Integrations\Google\GoogleDriveClient;
use App\Domain\Integrations\Media\GoogleDriveVideoProvider;
use App\Models\MediaAsset;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

/**
 * ADR-009: Drive needs a while to prepare an uploaded video for playback. Recheck with growing delays
 * (about 24 hours in total) and flip the asset from `processing` to `ready` when Google has the video metadata.
 */
class PollDriveVideoProcessing implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    /** Minutes before each check: 1, 2, 5, 10, 30, then hourly up to roughly a day. */
    public const DELAYS_MINUTES = [1, 2, 5, 10, 30, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60];

    public int $tries = 3;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $assetId,
        public readonly int $attempt,
    ) {
        $this->onQueue('media');
    }

    public function handle(TenantRunner $runner, DriveStorage $storage, GoogleDriveClient $drive, GoogleDriveVideoProvider $provider): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $runner->run($tenant, function () use ($storage, $drive, $provider) {
            $asset = MediaAsset::query()->find($this->assetId);
            if (! $asset || $asset->status !== 'processing') {
                return;
            }

            try {
                $file = $drive->getFile($storage->accessFor($asset->metadata['storage'] ?? null), $asset->external_media_id);
            } catch (\Throwable $e) {
                Log::warning('Drive processing check failed', ['asset_id' => $asset->id, 'error' => $e->getMessage()]);
                $file = null;
            }

            if ($file !== null && $provider->statusOf($file) === 'ready') {
                $durationMs = $file['videoMediaMetadata']['durationMillis'] ?? null;
                $asset->forceFill([
                    'status' => 'ready',
                    'duration_seconds' => $durationMs !== null ? (int) round(((int) $durationMs) / 1000) : $asset->duration_seconds,
                ])->save();

                return;
            }

            $next = $this->attempt + 1;
            if ($next < count(self::DELAYS_MINUTES)) {
                self::dispatch($this->tenantId, $this->assetId, $next)->delay(now()->addMinutes(self::DELAYS_MINUTES[$next]));
            }
        });
    }
}
