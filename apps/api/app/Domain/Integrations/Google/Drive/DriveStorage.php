<?php

namespace App\Domain\Integrations\Google\Drive;

use App\Domain\Integrations\Google\GoogleConnectionService;
use App\Domain\Integrations\Google\GoogleDriveClient;
use App\Domain\Integrations\Google\GoogleNotConnectedException;
use App\Models\IntegrationConnection;
use App\Models\PlatformDriveAccount;
use App\Models\Tenant;

/**
 * Decides which Drive holds a tenant's files (ADR-009): the academy's own Google connection when it has one,
 * otherwise the platform storage pool.
 */
class DriveStorage
{
    public function __construct(
        private readonly GoogleConnectionService $connections,
        private readonly GoogleDriveClient $drive,
        private readonly DrivePool $pool,
    ) {}

    public function tenantAccess(): TenantDriveAccess
    {
        return new TenantDriveAccess($this->connections);
    }

    /** Uploads are possible when the academy is connected or the platform pool has an account. */
    public function available(): bool
    {
        return $this->connections->isConnected() || $this->pool->hasAccounts();
    }

    /**
     * @throws StorageFullException when only the pool is available and no account has room
     * @throws GoogleNotConnectedException when no storage exists at all
     */
    public function targetForUpload(Tenant $tenant, int $bytes, \DateTimeInterface $expiresAt): DriveTarget
    {
        if ($this->connections->isConnected()) {
            $access = $this->tenantAccess();

            return new DriveTarget($access, $this->tenantOwnFolder($access, $tenant));
        }

        if (! $this->pool->hasAccounts()) {
            throw new GoogleNotConnectedException('No Google Drive storage is available.');
        }

        [$account, $reservation] = $this->pool->reserve($tenant, $bytes, $expiresAt);

        try {
            return new DriveTarget($this->pool->access($account), $this->pool->tenantFolder($account, $tenant), $reservation->id);
        } catch (\Throwable $e) {
            $this->pool->release($reservation->id);
            throw $e;
        }
    }

    /** @param  array{kind?: string, account_id?: string}|null  $ref */
    public function accessFor(?array $ref): DriveAccess
    {
        if (($ref['kind'] ?? 'tenant') === 'pool') {
            $account = PlatformDriveAccount::query()->find($ref['account_id'] ?? null);
            if (! $account) {
                throw new GoogleNotConnectedException('The storage account of this file no longer exists.');
            }

            return $this->pool->access($account);
        }

        return $this->tenantAccess();
    }

    /** Whether `folderId` is the folder this tenant's files go to on that storage. */
    public function isTenantFolder(array $ref, Tenant $tenant, string $folderId): bool
    {
        if (($ref['kind'] ?? 'tenant') === 'pool') {
            $account = PlatformDriveAccount::query()->find($ref['account_id'] ?? null);

            return $account !== null && $this->pool->isTenantFolder($account, $tenant, $folderId);
        }

        return IntegrationConnection::google()?->drive_folder_id === $folderId;
    }

    public function release(?string $reservationId): void
    {
        $this->pool->release($reservationId);
    }

    private function tenantOwnFolder(TenantDriveAccess $access, Tenant $tenant): string
    {
        $connection = $this->connections->activeConnection();
        if ($this->drive->folderUsable($access, $connection->drive_folder_id)) {
            return $connection->drive_folder_id;
        }

        $folderId = $this->drive->createFolder($access, 'LMS — '.$tenant->name);
        $connection->forceFill(['drive_folder_id' => $folderId])->save();

        return $folderId;
    }
}
