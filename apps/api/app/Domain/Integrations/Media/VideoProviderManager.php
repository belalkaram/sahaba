<?php

namespace App\Domain\Integrations\Media;

use App\Domain\Integrations\Contracts\VideoProviderInterface;
use App\Domain\Integrations\DTOs\VideoUploadRequest;
use App\Domain\Integrations\DTOs\VideoUploadResponse;
use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Exceptions\ProviderTimeoutException;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class VideoProviderManager
{
    /**
     * @var array<string, VideoProviderInterface>
     */
    protected array $providers = [];

    public function __construct()
    {
        $this->providers = [
            'mock' => new MockVideoProvider,
            'google_drive' => app(GoogleDriveVideoProvider::class),
            'vimeo' => new VimeoVideoProvider,
        ];
    }

    public function provider(?string $name = null): VideoProviderInterface
    {
        $name = $name ?: config('services.media.default', 'mock');

        if (! isset($this->providers[$name])) {
            throw new InvalidArgumentException("Video provider [{$name}] is not supported.");
        }

        return $this->providers[$name];
    }

    public function registerProvider(string $name, VideoProviderInterface $provider): void
    {
        $this->providers[$name] = $provider;
    }

    /**
     * Upload / register video with automatic failover.
     *
     * @param  array<int, string>  $providerPriority
     *
     * @throws ProviderException
     */
    public function uploadWithFailover(VideoUploadRequest $request, array $providerPriority = []): VideoUploadResponse
    {
        $priority = ! empty($providerPriority)
            ? $providerPriority
            : ['google_drive', 'mock'];

        $lastException = null;

        foreach ($priority as $providerName) {
            try {
                $provider = $this->provider($providerName);

                return $provider->uploadVideo($request);
            } catch (ProviderTimeoutException|ProviderException $e) {
                Log::warning("Video provider [{$providerName}] failed with: {$e->getMessage()}. Attempting next provider in fallback chain.");
                $lastException = $e;
            }
        }

        throw $lastException ?? new ProviderException('All video providers in failover chain failed.');
    }
}
