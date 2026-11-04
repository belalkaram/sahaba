<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Opt-in public profiles for courses and teachers (course images already use courses.cover_path),
     * and server-side integrity events for exam attempts.
     */
    public function up(): void
    {
        Schema::connection('tenant')->table('staff', function (Blueprint $table) {
            $table->string('photo_path', 500)->nullable();
            $table->string('headline', 160)->nullable();
            $table->text('public_bio')->nullable();
            $table->boolean('is_public')->default(false);
        });

        Schema::connection('tenant')->table('courses', function (Blueprint $table) {
            $table->boolean('is_public')->default(false);
        });

        Schema::connection('tenant')->table('exam_attempts', function (Blueprint $table) {
            $table->unsignedInteger('violation_count')->default(0);
            $table->json('integrity_events')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->table('exam_attempts', function (Blueprint $table) {
            $table->dropColumn(['violation_count', 'integrity_events']);
        });
        Schema::connection('tenant')->table('courses', function (Blueprint $table) {
            $table->dropColumn('is_public');
        });
        Schema::connection('tenant')->table('staff', function (Blueprint $table) {
            $table->dropColumn(['photo_path', 'headline', 'public_bio', 'is_public']);
        });
    }
};
