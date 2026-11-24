<?php

namespace App\Domain\Integrations\Google\Drive;

/** Where a new upload goes: credentials, folder and (for pool accounts) the space reservation. */
final class DriveTarget
{
    public function __construct(
        public readonly DriveAccess $access,
        public readonly string $folderId,
        public readonly ?string $reservationId = null,
    ) {}
}
