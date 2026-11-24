<?php

namespace App\Domain\Integrations\Google\Drive;

use App\Domain\Integrations\Google\GoogleConnectionService;

/** The current tenant's own Google connection (ADR-008). */
class TenantDriveAccess implements DriveAccess
{
    public function __construct(private readonly GoogleConnectionService $connections) {}

    public function accessToken(): string
    {
        return $this->connections->activeConnection()->access_token;
    }

    public function storageRef(): array
    {
        return ['kind' => 'tenant'];
    }
}
