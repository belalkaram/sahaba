<?php

namespace App\Tenancy;

use App\Models\Tenant;

/**
 * Runs code against a tenant database outside the HTTP middleware (queued jobs, scheduled
 * commands). Keeps the current connection when it is already on that tenant, so a sync job
 * dispatched during a request does not reset the request's connection.
 */
class TenantRunner
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabaseManager $databases,
    ) {}

    public function run(Tenant $tenant, callable $callback): mixed
    {
        if ($this->context->getTenantId() === $tenant->id) {
            return $callback();
        }

        $previous = $this->context->getTenant();
        $this->databases->configureConnection($tenant);
        $this->context->setTenant($tenant);

        try {
            return $callback();
        } finally {
            if ($previous) {
                $this->databases->configureConnection($previous);
                $this->context->setTenant($previous);
            } else {
                $this->context->clear();
            }
        }
    }
}
