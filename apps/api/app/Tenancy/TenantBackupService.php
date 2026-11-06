<?php

namespace App\Tenancy;

use App\Models\Tenant;
use App\Tenancy\Exceptions\BackupException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

class TenantBackupService
{
    public function __construct(
        protected TenantDatabaseManager $dbManager
    ) {}

    /**
     * Create a verified backup snapshot of a tenant database.
     *
     * @return array{backup_path: string, checksum: string, size_bytes: int, timestamp: string}
     */
    public function createBackup(Tenant $tenant, ?string $destinationDir = null): array
    {
        if ($this->dbManager->getSchemaName($tenant) !== null) {
            return $this->createPostgresBackup($tenant, $destinationDir);
        }

        $sourcePath = $this->dbManager->getDatabasePath($tenant);

        if (! $sourcePath || ! file_exists($sourcePath)) {
            throw new BackupException("Cannot backup tenant '{$tenant->slug}': Database file does not exist at '{$sourcePath}'.");
        }

        $destDir = $destinationDir ?? storage_path('app/backups/tenants');
        if (! File::isDirectory($destDir)) {
            File::makeDirectory($destDir, 0755, true, true);
        }

        $timestamp = date('Y-m-d_His');
        $fileName = "backup_{$tenant->slug}_{$timestamp}_".bin2hex(random_bytes(4)).'.sqlite';
        $destPath = $destDir.DIRECTORY_SEPARATOR.$fileName;

        if (! copy($sourcePath, $destPath)) {
            throw new BackupException("Failed to copy database file from '{$sourcePath}' to '{$destPath}'.");
        }

        $checksum = hash_file('sha256', $destPath);
        $sizeBytes = filesize($destPath);

        return [
            'backup_path' => $destPath,
            'checksum' => $checksum,
            'size_bytes' => $sizeBytes,
            'timestamp' => now()->toIso8601String(),
        ];
    }

    /**
     * Restore a tenant database from a verified backup file.
     */
    public function restoreBackup(Tenant $tenant, string $backupPath, ?string $expectedChecksum = null): bool
    {
        if (! file_exists($backupPath)) {
            throw new BackupException("Backup file not found at: '{$backupPath}'.");
        }

        if ($expectedChecksum !== null) {
            $actualChecksum = hash_file('sha256', $backupPath);
            if ($actualChecksum !== $expectedChecksum) {
                throw new BackupException("Backup file checksum mismatch. Expected: {$expectedChecksum}, got: {$actualChecksum}. Integrity compromised.");
            }
        }

        if ($this->dbManager->getSchemaName($tenant) !== null) {
            return $this->restorePostgresBackup($tenant, $backupPath);
        }

        $targetPath = $this->dbManager->getDatabasePath($tenant);
        if (! $targetPath) {
            throw new BackupException("Cannot restore tenant '{$tenant->slug}': Target database path cannot be determined.");
        }

        // Purge active connection to release file lock
        $this->dbManager->purgeConnection();

        $targetDir = dirname($targetPath);
        if (! File::isDirectory($targetDir)) {
            File::makeDirectory($targetDir, 0755, true, true);
        }

        if (! copy($backupPath, $targetPath)) {
            throw new BackupException("Failed to restore backup from '{$backupPath}' to '{$targetPath}'.");
        }

        // Reconnect and verify integrity
        $this->dbManager->configureConnection($tenant);
        $this->verifyIntegrity($tenant);

        return true;
    }

    /**
     * Verify database file integrity via SQLite PRAGMA integrity_check.
     */
    public function verifyIntegrity(Tenant $tenant): bool
    {
        $this->dbManager->configureConnection($tenant);

        $driver = config('database.connections.tenant.driver', 'sqlite');
        if ($driver === 'pgsql') {
            // A schema that answers a catalog query and holds tables is considered intact.
            $schema = $this->dbManager->getSchemaName($tenant);
            $tables = DB::connection('tenant')->selectOne(
                'select count(*) as n from information_schema.tables where table_schema = ?',
                [$schema]
            );
            if ((int) $tables->n === 0) {
                throw new BackupException("Integrity check failed for tenant '{$tenant->slug}': schema '{$schema}' has no tables.");
            }
        } elseif ($driver === 'sqlite') {
            $result = DB::connection('tenant')->select('PRAGMA integrity_check');
            $status = $result[0]->integrity_check ?? null;

            if ($status !== 'ok') {
                throw new BackupException("Integrity check failed for tenant '{$tenant->slug}': Status is '{$status}'.");
            }
        }

        return true;
    }

    /**
     * Postgres: dump only this tenant's schema with pg_dump (custom format, portable across providers).
     *
     * @return array{backup_path: string, checksum: string, size_bytes: int, timestamp: string}
     */
    private function createPostgresBackup(Tenant $tenant, ?string $destinationDir): array
    {
        $schema = $this->dbManager->getSchemaName($tenant);
        $destDir = $destinationDir ?? storage_path('app/backups/tenants');
        if (! File::isDirectory($destDir)) {
            File::makeDirectory($destDir, 0755, true, true);
        }

        $destPath = $destDir.DIRECTORY_SEPARATOR."backup_{$tenant->slug}_".date('Y-m-d_His').'_'.bin2hex(random_bytes(4)).'.dump';

        $result = Process::env($this->pgEnv())->timeout(600)->run([
            'pg_dump', '--format=custom', '--no-owner', '--no-privileges',
            '--schema='.$schema, '--file='.$destPath, ...$this->pgTarget(),
        ]);

        if ($result->failed() || ! file_exists($destPath) || filesize($destPath) === 0) {
            @unlink($destPath);
            throw new BackupException("pg_dump failed for tenant '{$tenant->slug}': ".trim($result->errorOutput()));
        }

        return [
            'backup_path' => $destPath,
            'checksum' => hash_file('sha256', $destPath),
            'size_bytes' => filesize($destPath),
            'timestamp' => now()->toIso8601String(),
        ];
    }

    private function restorePostgresBackup(Tenant $tenant, string $backupPath): bool
    {
        $schema = $this->dbManager->getSchemaName($tenant);

        // Replace the schema atomically from the caller's point of view: drop, then restore.
        $this->dbManager->deleteDatabase($tenant);
        // A schema-only dump does not create the schema itself.
        $this->dbManager->ensureStorage($tenant);

        $result = Process::env($this->pgEnv())->timeout(600)->run([
            'pg_restore', '--no-owner', '--no-privileges', '--exit-on-error',
            '--schema='.$schema, ...$this->pgTarget('--dbname'), $backupPath,
        ]);

        if ($result->failed()) {
            throw new BackupException("pg_restore failed for tenant '{$tenant->slug}': ".trim($result->errorOutput()));
        }

        $this->dbManager->configureConnection($tenant);
        $this->verifyIntegrity($tenant);

        return true;
    }

    /**
     * Connection arguments for the pg_* client tools. The password travels via PGPASSWORD, never argv.
     *
     * @return list<string>
     */
    private function pgTarget(string $dbFlag = '--dbname'): array
    {
        $c = DB::connection('tenant')->getConfig(); // parsed: includes values taken from DB_URL
        $args = ['--host='.$c['host'], '--port='.$c['port'], '--username='.$c['username'], $dbFlag.'='.$c['database']];

        return $args;
    }

    /**
     * @return array<string, string>
     */
    private function pgEnv(): array
    {
        $c = DB::connection('tenant')->getConfig(); // parsed: includes values taken from DB_URL

        return ['PGPASSWORD' => (string) $c['password'], 'PGSSLMODE' => (string) ($c['sslmode'] ?? 'prefer')];
    }
}
