<?php

namespace App\Domain\Integrations\Google;

use App\Domain\Integrations\Exceptions\ProviderException;

/** The tenant has no usable Google connection (never connected, disconnected, or revoked at Google). */
class GoogleNotConnectedException extends ProviderException
{
    public function __construct(string $message = 'Google account is not connected for this tenant.')
    {
        parent::__construct($message, 'google');
    }
}
