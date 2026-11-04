<?php

namespace App\Domain\Integrations\Meetings;

use App\Domain\Integrations\Contracts\MeetingProviderInterface;
use App\Domain\Integrations\DTOs\MeetingRequest;
use App\Domain\Integrations\DTOs\MeetingResponse;
use App\Domain\Integrations\Exceptions\ProviderException;
use App\Domain\Integrations\Exceptions\ProviderTimeoutException;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class MeetingProviderManager
{
    /**
     * @var array<string, MeetingProviderInterface>
     */
    protected array $providers = [];

    public function __construct()
    {
        $this->providers = [
            'manual' => new ManualMeetingProvider,
            'mock' => new MockMeetingProvider,
            'google_meet' => new GoogleMeetProvider,
            'zoom' => new ZoomMeetingProvider,
        ];
    }

    public function provider(?string $name = null): MeetingProviderInterface
    {
        $name = $name ?: config('services.meetings.default', 'manual');

        if (! isset($this->providers[$name])) {
            throw new InvalidArgumentException("Meeting provider [{$name}] is not supported.");
        }

        return $this->providers[$name];
    }

    public function registerProvider(string $name, MeetingProviderInterface $provider): void
    {
        $this->providers[$name] = $provider;
    }

    /**
     * Create meeting with automatic failover across multiple providers.
     *
     * @param  array<int, string>  $providerPriority
     *
     * @throws ProviderException
     */
    public function createMeetingWithFailover(MeetingRequest $request, array $providerPriority = []): MeetingResponse
    {
        $priority = ! empty($providerPriority)
            ? $providerPriority
            : ['google_meet', 'mock'];

        $lastException = null;

        foreach ($priority as $providerName) {
            try {
                $provider = $this->provider($providerName);

                return $provider->createMeeting($request);
            } catch (ProviderTimeoutException|ProviderException $e) {
                Log::warning("Meeting provider [{$providerName}] failed with: {$e->getMessage()}. Attempting next provider in fallback chain.");
                $lastException = $e;
            }
        }

        throw $lastException ?? new ProviderException('All meeting providers in failover chain failed.');
    }
}
