<?php

namespace App\Providers;

use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

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
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
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
}
