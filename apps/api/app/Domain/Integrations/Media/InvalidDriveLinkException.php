<?php

namespace App\Domain\Integrations\Media;

use App\Domain\Integrations\Exceptions\ProviderException;

/** The pasted Drive link is malformed, trashed or not the expected media type (422, not a provider outage). */
class InvalidDriveLinkException extends ProviderException
{
    public function __construct(string $message)
    {
        parent::__construct($message, 'google_drive', 422);
    }
}
