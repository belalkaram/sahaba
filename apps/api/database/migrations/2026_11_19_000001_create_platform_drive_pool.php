<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-009: platform-owned Google Drive accounts used as shared video storage, one folder per tenant per account,
 * and space reservations so concurrent uploads cannot overfill an account. Control DB only: tenants never read it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_drive_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('account_email')->unique();
            $table->string('status', 16)->default('connected'); // connected | error | disabled
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->json('scopes')->nullable();
            $table->string('root_folder_id')->nullable();
            $table->unsignedBigInteger('quota_limit_bytes')->nullable(); // null = unlimited
            $table->unsignedBigInteger('quota_usage_bytes')->default(0);
            $table->timestamp('quota_checked_at')->nullable();
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('accepting_uploads')->default(true);
            $table->string('connected_by')->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->string('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('platform_drive_folders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('account_id');
            $table->uuid('tenant_id');
            $table->string('folder_id');
            $table->timestamps();

            $table->foreign('account_id')->references('id')->on('platform_drive_accounts')->cascadeOnDelete();
            $table->unique(['account_id', 'tenant_id']);
        });

        Schema::create('platform_drive_reservations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('account_id');
            $table->uuid('tenant_id');
            $table->uuid('upload_id')->nullable();
            $table->unsignedBigInteger('bytes');
            $table->timestamp('expires_at');
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->foreign('account_id')->references('id')->on('platform_drive_accounts')->cascadeOnDelete();
            $table->index(['account_id', 'released_at', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_drive_reservations');
        Schema::dropIfExists('platform_drive_folders');
        Schema::dropIfExists('platform_drive_accounts');
    }
};
