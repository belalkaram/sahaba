<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * R1-A4: Create staff assignments and branch assignments for scoped access.
     */
    public function up(): void
    {
        Schema::connection('tenant')->create('staff_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->string('assignable_type', 50); // 'class', 'course', 'student'
            $table->uuid('assignable_id');
            $table->string('role_context', 50)->nullable(); // e.g. 'assistant', 'co-teacher'
            $table->timestamps();

            $table->index(['staff_id', 'assignable_type']);
            $table->index(['assignable_type', 'assignable_id']);
        });

        Schema::connection('tenant')->create('staff_branches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->foreignUuid('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['staff_id', 'branch_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('staff_branches');
        Schema::connection('tenant')->dropIfExists('staff_assignments');
    }
};
