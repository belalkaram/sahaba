<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * R8-4: a metric with no underlying data is NULL ("not computed"), never a made-up 0 or 100.
     */
    public function up(): void
    {
        Schema::connection('tenant')->table('student_analytics_snapshots', function (Blueprint $table) {
            $table->decimal('attendance_rate', 5, 2)->nullable()->default(null)->change();
            $table->decimal('assignment_completion_rate', 5, 2)->nullable()->default(null)->change();
            $table->decimal('exam_average', 5, 2)->nullable()->default(null)->change();
            $table->decimal('overall_score', 5, 2)->nullable()->default(null)->change();
            $table->decimal('lesson_completion_rate', 5, 2)->nullable();
            $table->timestamp('last_activity_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->table('student_analytics_snapshots', function (Blueprint $table) {
            $table->dropColumn(['lesson_completion_rate', 'last_activity_at']);
        });
    }
};
