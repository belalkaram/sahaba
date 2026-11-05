<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    /**
     * Test tenant databases are throwaway (TENANTS_PATH in phpunit.xml): every test starts clean
     * and leaves nothing behind. The connection is closed first because Windows cannot delete an
     * open file.
     */
    protected function tearDown(): void
    {
        if ($this->app && config('database.connections.tenant.driver') === 'pgsql' && app()->environment('testing')) {
            // Postgres runs: tenants are schemas of the (dedicated, disposable) test database.
            // Use the tenant connection: it is never wrapped in RefreshDatabase's transaction, so each
            // DROP commits on its own and does not pile up locks (max_locks_per_transaction).
            $db = DB::connection('tenant');
            foreach ($db->select("select nspname from pg_namespace where nspname like 'tenant\_%' or nspname like 'test\_%'") as $row) {
                foreach ($db->select('select tablename from pg_tables where schemaname = ?', [$row->nspname]) as $t) {
                    $db->statement('DROP TABLE IF EXISTS "'.$row->nspname.'"."'.$t->tablename.'" CASCADE');
                }
                $db->statement('DROP SCHEMA IF EXISTS "'.$row->nspname.'" CASCADE');
            }
        } elseif ($this->app && ($path = config('database.tenants_path'))) {
            DB::purge('tenant');
            foreach (glob(base_path($path).'/*.sqlite*') ?: [] as $file) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }
}
