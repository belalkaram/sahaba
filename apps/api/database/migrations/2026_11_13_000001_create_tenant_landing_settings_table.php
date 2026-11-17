<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-007 (TL-1): Tenant landing page customisation — draft/published store in the control DB.
 *
 * Intentionally separate from `brand_settings` (which carries operational attendance thresholds and
 * is returned whole by `/tenant/current`). Keeping landing settings here gives us draft/published
 * duality, versioning, and audit without touching the operational JSON.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_landing_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            // published = what visitors see; draft = work in progress
            $table->json('published')->nullable();
            $table->json('draft')->nullable();

            // Monotonically increasing; bumped on every publish
            $table->unsignedInteger('version')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->string('published_by', 255)->nullable(); // actor email/id for the audit entry

            // Short-lived preview token (stored as SHA-256 hash — the raw token is never persisted)
            $table->string('preview_token_hash', 64)->nullable();
            $table->timestamp('preview_expires_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_landing_settings');
    }
};
