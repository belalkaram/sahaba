<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * R0-5: Support one-time exchange codes.
 *
 * When support access is granted, the platform gets a short-lived exchange
 * code (not the bearer token). The frontend POSTs this code to
 * POST /auth/support/exchange inside the tenant, which validates it,
 * burns it, and returns the actual bearer token.
 *
 * This prevents the bearer token from ever appearing in URLs, logs, or
 * browser history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_exchange_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code_hash', 64)->unique();   // SHA-256 of the plaintext code
            $table->string('tenant_id');                  // which tenant this code is for
            $table->string('actor_id');                   // platform actor (interim: 'platform_admin')
            $table->string('actor_type', 50)->default('platform_token');
            $table->string('reason');
            $table->timestamp('expires_at');              // 60 seconds TTL
            $table->timestamp('used_at')->nullable();     // null = unused; set on first use
            $table->timestamps();

            $table->index(['tenant_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_exchange_codes');
    }
};
