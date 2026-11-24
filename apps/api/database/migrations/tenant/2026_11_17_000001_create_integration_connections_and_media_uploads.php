<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * R4-3 / ADR-008: the tenant's Google connection (one row per provider, tokens encrypted by the model)
 * and the Drive resumable upload sessions opened for that tenant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('tenant')->create('integration_connections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider', 32)->unique(); // google
            $table->string('status', 16)->default('connected'); // connected | error
            $table->string('account_email')->nullable();
            $table->text('access_token');
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->json('scopes')->nullable();
            $table->string('drive_folder_id')->nullable();
            $table->uuid('connected_by')->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->string('last_error', 255)->nullable();
            $table->timestamps();
        });

        Schema::connection('tenant')->create('media_uploads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider', 32)->default('google_drive');
            $table->string('title');
            $table->string('media_type', 16)->default('video');
            $table->uuid('course_id')->nullable();
            $table->uuid('lesson_id')->nullable();
            $table->string('file_name');
            $table->string('mime_type', 120);
            $table->unsignedBigInteger('size_bytes');
            $table->text('session_url');
            $table->string('status', 16)->default('pending'); // pending | completed
            $table->string('external_file_id')->nullable();
            $table->uuid('media_asset_id')->nullable();
            $table->uuid('created_by');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['created_by', 'status']);
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('media_uploads');
        Schema::connection('tenant')->dropIfExists('integration_connections');
    }
};
