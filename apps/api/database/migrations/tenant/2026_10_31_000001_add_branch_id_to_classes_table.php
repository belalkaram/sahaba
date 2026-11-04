<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * R2-3: Add optional branch_id to classes table.
     */
    public function up(): void
    {
        Schema::connection('tenant')->table('classes', function (Blueprint $table) {
            $table->foreignUuid('branch_id')->nullable()->after('teacher_staff_id')->constrained('branches')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->table('classes', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropColumn('branch_id');
        });
    }
};
