<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-009: where an upload is stored (the academy's own Google account or a platform pool account), its space
 * reservation, and why finalising failed. Status now also takes `finalizing` and `failed`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('tenant')->table('media_uploads', function (Blueprint $table) {
            $table->string('storage_kind', 16)->default('tenant'); // tenant | pool
            $table->uuid('storage_account_id')->nullable();
            $table->uuid('reservation_id')->nullable();
            $table->string('failure_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->table('media_uploads', function (Blueprint $table) {
            $table->dropColumn(['storage_kind', 'storage_account_id', 'reservation_id', 'failure_reason']);
        });
    }
};
