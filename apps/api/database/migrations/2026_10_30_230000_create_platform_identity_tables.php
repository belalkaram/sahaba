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
        // 1. Platform Users
        Schema::create('platform_users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('status', 50)->default('active'); // active, suspended
            $table->rememberToken();
            $table->timestamps();
        });

        // 2. Platform Roles
        Schema::create('platform_roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('label');
            $table->string('description')->nullable();
            $table->timestamps();
        });

        // 3. Platform User Roles
        Schema::create('platform_user_roles', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('platform_users')->cascadeOnDelete();
            $table->foreignId('role_id')->constrained('platform_roles')->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['user_id', 'role_id']);
        });

        // 4. Platform Tokens
        Schema::create('platform_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('platform_users')->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->string('name')->default('platform_token');
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 5. Enhance support_access_logs with session lifecycle tracking
        Schema::table('support_access_logs', function (Blueprint $table) {
            $table->string('status', 50)->default('active')->after('expires_at'); // active, ended, expired
            $table->timestamp('ended_at')->nullable()->after('status');
            $table->timestamp('revoked_at')->nullable()->after('ended_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('support_access_logs', function (Blueprint $table) {
            $table->dropColumn(['status', 'ended_at', 'revoked_at']);
        });

        Schema::dropIfExists('platform_tokens');
        Schema::dropIfExists('platform_user_roles');
        Schema::dropIfExists('platform_roles');
        Schema::dropIfExists('platform_users');
    }
};
