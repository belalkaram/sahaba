<?php

namespace App\Jobs;

use App\Domain\Integrations\Google\GoogleNotConnectedException;
use App\Domain\Integrations\Media\MediaUploadService;
use App\Models\MediaUpload;
use App\Models\Tenant;
use App\Tenancy\TenantRunner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * ADR-009: checks, shares and registers a Drive upload whose bytes are all at Google. Runs on the `media` queue
 * so the browser's "complete" request returns at once; Google outages are retried with back-off.
 */
class FinalizeMediaUpload implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [10, 30, 60, 300];

    public int $uniqueFor = 600;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $uploadId,
    ) {
        $this->onQueue('media');
    }

    public function uniqueId(): string
    {
        return $this->tenantId.':'.$this->uploadId;
    }

    public function handle(TenantRunner $runner, MediaUploadService $uploads): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $runner->run($tenant, function () use ($uploads) {
            $upload = MediaUpload::query()->find($this->uploadId);
            if (! $upload) {
                return;
            }

            try {
                $uploads->finalize($upload);
            } catch (GoogleNotConnectedException) {
                $uploads->fail($upload, 'storage_disconnected'); // retrying cannot help until someone reconnects
            }
        });
    }

    /** All retries used up: the uploader sees a failed upload instead of one stuck in "finalizing". */
    public function failed(\Throwable $e): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        app(TenantRunner::class)->run($tenant, function () {
            $upload = MediaUpload::query()->find($this->uploadId);
            if ($upload && $upload->status === MediaUpload::FINALIZING) {
                app(MediaUploadService::class)->fail($upload, 'provider_unavailable');
            }
        });
    }
}
