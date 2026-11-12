<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-006 / OD-38, OD-39 (CAP-1): academy capacity.
 *
 * - tenants.seat_quota: seats the academy may use (student = code). NULL = not initialised yet; the first capacity
 *   check sets it to the academy's current usage (existing academies are never locked out of what they have).
 * - capacity_requests: an academy asks the super admin for more seats, with a manual transfer proof.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->unsignedInteger('seat_quota')->nullable();
        });

        Schema::create('capacity_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->unsignedInteger('seats_requested');
            $table->decimal('amount', 10, 2)->nullable();
            $table->string('currency', 3)->default('SAR');
            $table->string('proof_path')->nullable();
            $table->text('note')->nullable();
            $table->string('status', 16)->default('pending'); // pending | approved | rejected
            $table->uuid('requested_by_user_id')->nullable();
            $table->string('requested_by_name')->nullable();
            $table->unsignedInteger('seats_used_at_request')->nullable();
            $table->unsignedInteger('quota_at_request')->nullable();
            $table->unsignedInteger('seats_granted')->nullable();
            $table->unsignedInteger('quota_after')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->string('reviewed_by_name')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('decision_note')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capacity_requests');
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('seat_quota');
        });
    }
};
