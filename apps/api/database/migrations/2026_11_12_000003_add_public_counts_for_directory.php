<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * LANDING-V2 L1: counts shown in the public directory. They are computed by
     * `lms:refresh-platform-metrics` (R8-7) so a public page never opens tenant databases.
     * Null means "not computed yet" and is rendered as unknown, never as zero.
     */
    public function up(): void
    {
        Schema::table('tenant_metric_snapshots', function (Blueprint $table) {
            $table->unsignedInteger('public_courses_count')->nullable()->after('courses_count');
            $table->unsignedInteger('public_teachers_count')->nullable()->after('public_courses_count');
        });

        Schema::table('public_directory_entries', function (Blueprint $table) {
            $table->unsignedInteger('public_courses_count')->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('tenant_metric_snapshots', function (Blueprint $table) {
            $table->dropColumn(['public_courses_count', 'public_teachers_count']);
        });

        Schema::table('public_directory_entries', function (Blueprint $table) {
            $table->dropColumn('public_courses_count');
        });
    }
};
