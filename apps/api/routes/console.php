<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// R8: scheduled jobs (requires `php artisan schedule:work` or a cron entry; see infrastructure/RUNBOOK.md)
Schedule::command('lms:notify-scheduled')->hourly()->withoutOverlapping();
Schedule::command('lms:compute-analytics')->dailyAt('02:00')->withoutOverlapping();
Schedule::command('lms:refresh-platform-metrics')->hourly()->withoutOverlapping();
// Safety net for the pgsql tenant clone template (normally refreshed after `migrate` / lms:migrate-tenants).
Schedule::command('tenants:refresh-template')->hourly()->withoutOverlapping();
