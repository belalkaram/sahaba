<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable()->index();
            $table->string('actor_id', 64)->nullable()->index(); // tenant user UUID or platform user id
            $table->string('actor_type', 50)->default('user'); // user, system, platform_admin, support
            $table->string('actor_email')->nullable();
            $table->string('action', 100)->index(); // auth.login, auth.logout, tenant.created, payment.reviewed, etc.
            $table->string('entity_type', 100)->nullable();
            $table->string('entity_id')->nullable();
            $table->json('payload')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
