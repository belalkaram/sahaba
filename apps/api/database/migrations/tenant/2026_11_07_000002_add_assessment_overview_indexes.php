<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The exams and assignments overview pages filter by course and count active enrollments per course.
 * Postgres does not index foreign keys on its own, and the existing unique (student_id, course_id) cannot
 * serve a lookup by course.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('tenant')->table('enrollments', function (Blueprint $table) {
            $table->index(['course_id', 'status'], 'enrollments_course_status_index');
        });
        Schema::connection('tenant')->table('exams', function (Blueprint $table) {
            $table->index(['course_id', 'status'], 'exams_course_status_index');
        });
        Schema::connection('tenant')->table('assignments', function (Blueprint $table) {
            $table->index(['course_id', 'status'], 'assignments_course_status_index');
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->table('enrollments', function (Blueprint $table) {
            $table->dropIndex('enrollments_course_status_index');
        });
        Schema::connection('tenant')->table('exams', function (Blueprint $table) {
            $table->dropIndex('exams_course_status_index');
        });
        Schema::connection('tenant')->table('assignments', function (Blueprint $table) {
            $table->dropIndex('assignments_course_status_index');
        });
    }
};
