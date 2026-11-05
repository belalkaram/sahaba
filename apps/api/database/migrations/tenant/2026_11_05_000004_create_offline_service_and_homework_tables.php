<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations on the tenant database.
     */
    public function up(): void
    {
        // 1. Add mode to enrollments (OD-32)
        if (! Schema::connection('tenant')->hasColumn('enrollments', 'mode')) {
            Schema::connection('tenant')->table('enrollments', function (Blueprint $table) {
                $table->string('mode', 20)->default('both')->after('status'); // online, offline, both
            });
        }

        // 2. Add mode to class_students (OD-32)
        if (! Schema::connection('tenant')->hasColumn('class_students', 'mode')) {
            Schema::connection('tenant')->table('class_students', function (Blueprint $table) {
                $table->string('mode', 20)->default('both')->after('status'); // online, offline, both
            });
        }

        // 3. Create offline_homework_checks table
        if (! Schema::connection('tenant')->hasTable('offline_homework_checks')) {
            Schema::connection('tenant')->create('offline_homework_checks', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('session_id')->constrained('sessions')->cascadeOnDelete();
                $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
                $table->string('status', 30)->default('done'); // done, partial, not_done, absent
                $table->text('note')->nullable();
                $table->foreignUuid('checked_by_staff_id')->nullable()->constrained('staff')->nullOnDelete();
                $table->timestamp('checked_at')->useCurrent();
                $table->timestamps();

                $table->unique(['session_id', 'student_id']);
            });
        }

        // 4. Create offline_assessments table (paper exams / quizzes in center)
        if (! Schema::connection('tenant')->hasTable('offline_assessments')) {
            Schema::connection('tenant')->create('offline_assessments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('class_id')->constrained('classes')->cascadeOnDelete();
                $table->foreignUuid('session_id')->nullable()->constrained('sessions')->nullOnDelete();
                $table->string('title');
                $table->decimal('max_score', 6, 2)->default(100.00);
                $table->date('date')->nullable();
                $table->foreignUuid('created_by_staff_id')->nullable()->constrained('staff')->nullOnDelete();
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        // 5. Create offline_assessment_scores table
        if (! Schema::connection('tenant')->hasTable('offline_assessment_scores')) {
            Schema::connection('tenant')->create('offline_assessment_scores', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('offline_assessment_id')->constrained('offline_assessments')->cascadeOnDelete();
                $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
                $table->decimal('score', 6, 2)->nullable();
                $table->boolean('is_absent')->default(false);
                $table->text('notes')->nullable();
                $table->foreignUuid('recorded_by_staff_id')->nullable()->constrained('staff')->nullOnDelete();
                $table->timestamp('recorded_at')->nullable();
                $table->timestamps();

                $table->unique(['offline_assessment_id', 'student_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('offline_assessment_scores');
        Schema::connection('tenant')->dropIfExists('offline_assessments');
        Schema::connection('tenant')->dropIfExists('offline_homework_checks');

        if (Schema::connection('tenant')->hasColumn('class_students', 'mode')) {
            Schema::connection('tenant')->table('class_students', function (Blueprint $table) {
                $table->dropColumn('mode');
            });
        }

        if (Schema::connection('tenant')->hasColumn('enrollments', 'mode')) {
            Schema::connection('tenant')->table('enrollments', function (Blueprint $table) {
                $table->dropColumn('mode');
            });
        }
    }
};
