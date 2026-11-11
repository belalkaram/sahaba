<?php

namespace App\Providers;

use App\Domain\Communication\Channels\MessagingChannel;
use App\Domain\Communication\Channels\MessagingManager;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Console\Events\CommandFinished;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(TenantContext::class, function () {
            return new TenantContext;
        });

        $this->app->singleton(TenantDatabaseManager::class, function () {
            return new TenantDatabaseManager;
        });

        $this->app->bind(MessagingChannel::class, function ($app) {
            return $app->make(MessagingManager::class)->channel();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->refreshTenantTemplateAfterMigrate();

        // This runs before authentication, so `user()` is null here. Authenticated traffic is
        // limited per token: one IP-wide bucket would throttle a whole school behind one NAT,
        // and a single dashboard load issues many requests.
        RateLimiter::for('api', function (Request $request) {
            $token = $request->bearerToken();

            return $token
                ? Limit::perMinute(300)->by('token:'.hash('sha256', $token))
                : Limit::perMinute(60)->by('ip:'.$request->ip());
        });

        RateLimiter::for('auth', function (Request $request) {
            $identity = $request->input('email') ?: $request->input('identifier') ?: $request->input('coupon_code') ?: $request->input('phone');

            return [
                Limit::perMinute(10)->by('identity:'.($identity ?: $request->ip())),
                Limit::perMinute(120)->by('ip:'.$request->ip()),
            ];
        });
    }
    /**
     * Keep the pgsql tenant template schema in step with the tenant migrations automatically: after the
     * control-plane `php artisan migrate` (what every deploy runs) the template is brought up to date, so
     * the cost is paid at deploy time and never during a school registration. No-op on sqlite/tests.
     */
    protected function refreshTenantTemplateAfterMigrate(): void
    {
        Event::listen(function (CommandFinished $event) {
            // Only the plain control-plane migrate; the tenant/template migrations run with --database=tenant.
            if ($event->command !== 'migrate' || $event->exitCode !== 0 || $event->input->getParameterOption('--database')) {
                return;
            }

            try {
                $applied = app(TenantDatabaseManager::class)->refreshTemplate();
                if ($applied > 0) {
                    $event->output->writeln("<info>Tenant template updated ({$applied} migration(s)).</info>");
                }
            } catch (Throwable $e) {
                // Never fail a deploy over this: registration falls back to building it on demand.
                Log::warning('Tenant template refresh after migrate failed: '.$e->getMessage());
            }
        });
    }
}
