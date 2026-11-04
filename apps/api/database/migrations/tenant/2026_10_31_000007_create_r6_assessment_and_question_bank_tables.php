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
        // 1. Question Banks
        Schema::connection('tenant')->create('question_banks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::connection('tenant')->create('bank_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('bank_id')->constrained('question_banks')->cascadeOnDelete();
            $table->text('question_text');
            $table->string('question_type', 50)->default('multiple_choice');
            $table->decimal('points', 8, 2)->default(10.00);
            $table->json('options')->nullable();
            $table->string('correct_answer')->nullable();
            $table->json('acceptable_answers')->nullable();
            $table->text('explanation')->nullable();
            $table->timestamps();
        });

        // 2. Add R6 fields to exams
        Schema::connection('tenant')->table('exams', function (Blueprint $table) {
            $table->timestamp('opens_at')->nullable()->after('description');
            $table->timestamp('closes_at')->nullable()->after('opens_at');
            $table->integer('max_attempts')->default(1)->after('duration_minutes');
            $table->boolean('shuffle_questions')->default(false)->after('max_attempts');
            $table->boolean('shuffle_options')->default(false)->after('shuffle_questions');
            $table->string('show_results', 50)->default('after_publish')->after('shuffle_options');
            $table->decimal('passing_score', 8, 2)->nullable()->after('total_points');
        });

        // 3. Add R6 fields to questions
        Schema::connection('tenant')->table('questions', function (Blueprint $table) {
            $table->foreignUuid('bank_id')->nullable()->after('exam_id')->constrained('question_banks')->nullOnDelete();
            $table->json('acceptable_answers')->nullable()->after('correct_answer');
            $table->text('explanation')->nullable()->after('acceptable_answers');
        });

        // 4. Add R6 fields to exam_attempts
        Schema::connection('tenant')->table('exam_attempts', function (Blueprint $table) {
            $table->integer('attempt_number')->default(1)->after('student_id');
            $table->timestamp('expires_at')->nullable()->after('started_at');
            $table->text('feedback')->nullable()->after('score');
            $table->foreignUuid('graded_by_user_id')->nullable()->after('feedback')->constrained('tenant_users')->nullOnDelete();
            $table->timestamp('graded_at')->nullable()->after('graded_by_user_id');
        });

        try {
            Schema::connection('tenant')->table('exam_attempts', function (Blueprint $table) {
                $table->dropUnique(['exam_id', 'student_id']);
                $table->unique(['exam_id', 'student_id', 'attempt_number']);
            });
        } catch (Throwable $e) {
            // SQLite may keep index if immutable
        }

        // 5. Add R6 fields to exam_answers
        Schema::connection('tenant')->table('exam_answers', function (Blueprint $table) {
            $table->json('selected_options')->nullable()->after('answer_text');
            $table->text('feedback')->nullable()->after('awarded_points');
        });

        // 6. Add R6 fields to assignments
        Schema::connection('tenant')->table('assignments', function (Blueprint $table) {
            $table->boolean('allow_late')->default(true)->after('due_at');
            $table->integer('late_penalty_percent')->default(0)->after('allow_late');
            $table->boolean('allow_resubmission')->default(false)->after('late_penalty_percent');
            $table->integer('max_file_size_mb')->default(20)->after('allow_resubmission');
            $table->string('allowed_file_types')->default('pdf,doc,docx,zip,png,jpg')->after('max_file_size_mb');
        });

        // 7. Add R6 fields to assignment_submissions
        Schema::connection('tenant')->table('assignment_submissions', function (Blueprint $table) {
            $table->integer('attempt_number')->default(1)->after('student_id');
            $table->string('file_path')->nullable()->after('content');
            $table->string('file_name')->nullable()->after('file_path');
            $table->bigInteger('file_size')->nullable()->after('file_name');
            $table->string('mime_type')->nullable()->after('file_size');
        });

        try {
            Schema::connection('tenant')->table('assignment_submissions', function (Blueprint $table) {
                $table->dropUnique(['assignment_id', 'student_id']);
                $table->unique(['assignment_id', 'student_id', 'attempt_number']);
            });
        } catch (Throwable $e) {
            // SQLite may keep index if immutable
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('bank_questions');
        Schema::connection('tenant')->dropIfExists('question_banks');
    }
};
