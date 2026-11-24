<?php

namespace App\Domain\Integrations\Google;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Single-use OAuth states shared by the tenant connection (ADR-008) and platform storage accounts (ADR-009):
 * the public callback learns from the state alone which flow it finishes.
 */
class GoogleOAuthStates
{
    public const TENANT = 'tenant';

    public const POOL = 'pool';

    private const TTL_SECONDS = 600;

    /** @param  array<string, mixed>  $data */
    public function issue(string $kind, array $data): string
    {
        $state = Str::random(40);
        Cache::put($this->key($state), ['kind' => $kind] + $data, self::TTL_SECONDS);

        return $state;
    }

    /** @return array<string, mixed>|null */
    public function pull(string $state): ?array
    {
        $pending = Cache::pull($this->key($state));

        return is_array($pending) ? $pending + ['kind' => self::TENANT] : null;
    }

    private function key(string $state): string
    {
        return 'google_oauth_state:'.hash('sha256', $state);
    }
}
