<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * R8-7: aggregated per-tenant counts, computed by a scheduled job so the platform page never
     * runs live cross-tenant queries.
     */
    public function up(): void
    {
        Schema::create('tenant_metric_snapshots', function (Blueprint $table) {
            $table->uuid('tenant_id')->primary();
            $table->unsignedInteger('students_count')->nullable();
            $table->unsignedInteger('staff_count')->nullable();
            $table->unsignedInteger('courses_count')->nullable();
            $table->unsignedBigInteger('storage_bytes')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->string('status', 20)->default('ok'); // ok, unavailable
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_metric_snapshots');
    }
};
