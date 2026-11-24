<?php

namespace App\Domain\Integrations\Google\Drive;

/**
 * Credentials for one Google Drive (ADR-009): the academy's own connection or a platform pool account.
 */
interface DriveAccess
{
    /** A token valid for at least a minute; refreshes when needed. */
    public function accessToken(): string;

    /** @return array{kind: string, account_id?: string} stored on uploads and assets */
    public function storageRef(): array;
}
