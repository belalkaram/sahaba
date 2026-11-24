<?php

namespace App\Domain\Integrations\Google\Drive;

use App\Domain\Integrations\Exceptions\ProviderException;

/** No storage account can hold the file (ADR-009); refused before any byte is sent. */
class StorageFullException extends ProviderException
{
    public function __construct(public readonly int $requestedBytes)
    {
        parent::__construct('No Google Drive storage account has room for this file.', 'google_drive', 409);
    }
}
