<?php

namespace App\Console\Commands;

use App\Domain\Platform\PlatformMetricsService;
use Illuminate\Console\Command;

class RefreshPlatformMetrics extends Command
{
    protected $signature = 'lms:refresh-platform-metrics';

    protected $description = 'Recompute per-tenant counts for the platform console (R8-7)';

    public function handle(PlatformMetricsService $metrics): int
    {
        $this->info('Refreshed '.$metrics->refreshAll().' tenant(s).');

        return self::SUCCESS;
    }
}
