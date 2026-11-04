<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * R8-1: per-user notification preferences. R8-4: per-tenant settings (key/value).
     */
    public function up(): void
    {
        Schema::connection('tenant')->create('notification_preferences', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('tenant_users')->cascadeOnDelete();
            $table->string('event_key', 64);
            $table->boolean('in_app')->default(true);
            $table->boolean('mail')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'event_key']);
        });

        Schema::connection('tenant')->create('tenant_settings', function (Blueprint $table) {
            $table->string('key', 64)->primary();
            $table->json('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('tenant_settings');
        Schema::connection('tenant')->dropIfExists('notification_preferences');
    }
};
