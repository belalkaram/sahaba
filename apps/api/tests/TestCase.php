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
        if ($this->app && ($path = config('database.tenants_path'))) {
            DB::purge('tenant');
            foreach (glob(base_path($path).'/*.sqlite*') ?: [] as $file) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }
}
