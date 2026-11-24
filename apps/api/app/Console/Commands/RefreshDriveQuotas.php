<?php

namespace App\Console\Commands;

use App\Domain\Integrations\Google\Drive\DrivePool;
use Illuminate\Console\Command;

/** ADR-009: refresh every platform Drive account's quota and release expired space reservations. */
class RefreshDriveQuotas extends Command
{
    protected $signature = 'lms:refresh-drive-quotas';

    protected $description = 'Refresh platform Google Drive storage quotas and release expired upload reservations';

    public function handle(DrivePool $pool): int
    {
        $result = $pool->refreshAll();
        $this->info("Refreshed {$result['refreshed']} account(s), {$result['failed']} failed, released {$result['expired_reservations']} expired reservation(s).");

        return self::SUCCESS;
    }
}
