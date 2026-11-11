<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Assessment v2:
 *  - optional image on every question (exam, bank and assignment questions);
 *  - exams can be taken in several sessions inside the opens_at..closes_at window while the total active
 *    time stays duration_minutes (exam_attempts.time_used_seconds / last_seen_at);
 *  - assignments can carry questions (same shape as exam questions) answered inside the platform;
 *  - model answers (text + image) per question, released to students by the teacher (per student, per
 *    class, or all) or automatically once the window closes.
 */
return new class extends Migration
{
    public function up(): void
    {
        $db = Schema::connection('tenant');

        $db->table('questions', function (Blueprint $table) {
            $table->string('image_path')->nullable();
            $table->text('model_answer')->nullable();
            $table->string('model_answer_image_path')->nullable();
        });

        $db->table('bank_questions', function (Blueprint $table) {
            $table->string('image_path')->nullable();
            $table->text('model_answer')->nullable();
            $table->string('model_answer_image_path')->nullable();
        });

        $db->table('exams', function (Blueprint $table) {
            $table->boolean('allow_split_sessions')->default(false);
            $table->boolean('auto_release_model_answers')->default(false);
        });

        $db->table('exam_attempts', function (Blueprint $table) {
            $table->unsignedInteger('time_used_seconds')->default(0);
            $table->timestamp('last_seen_at')->nullable();
        });

        $db->table('assignments', function (Blueprint $table) {
            $table->boolean('auto_release_model_answers')->default(false);
        });

        $db->create('assignment_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->text('question_text');
            $table->string('question_type', 50)->default('multiple_choice');
            $table->decimal('points', 8, 2)->default(10.00);
            $table->json('options')->nullable();
            $table->string('correct_answer')->nullable();
            $table->json('acceptable_answers')->nullable();
            $table->text('explanation')->nullable();
            $table->string('image_path')->nullable();
            $table->text('model_answer')->nullable();
            $table->string('model_answer_image_path')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        $db->create('assignment_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('submission_id')->constrained('assignment_submissions')->cascadeOnDelete();
            $table->foreignUuid('question_id')->constrained('assignment_questions')->cascadeOnDelete();
            $table->text('answer_text')->nullable();
            $table->json('selected_options')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->decimal('awarded_points', 8, 2)->nullable();
            $table->text('feedback')->nullable();
            $table->timestamps();

            $table->unique(['submission_id', 'question_id']);
        });

        // A release makes the model answers of one exam/assignment visible to a student, a whole class, or everyone.
        $db->create('model_answer_releases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('assessable_type', 20); // exam | assignment
            $table->uuid('assessable_id');
            $table->string('scope', 20);            // student | class | all
            $table->uuid('student_id')->nullable();
            $table->uuid('class_id')->nullable();
            $table->uuid('released_by_user_id')->nullable();
            $table->timestamp('released_at')->useCurrent();
            $table->timestamps();

            $table->index(['assessable_type', 'assessable_id']);
        });
    }

    public function down(): void
    {
        $db = Schema::connection('tenant');

        $db->dropIfExists('model_answer_releases');
        $db->dropIfExists('assignment_answers');
        $db->dropIfExists('assignment_questions');
        $db->table('assignments', fn (Blueprint $t) => $t->dropColumn('auto_release_model_answers'));
        $db->table('exam_attempts', fn (Blueprint $t) => $t->dropColumn(['time_used_seconds', 'last_seen_at']));
        $db->table('exams', fn (Blueprint $t) => $t->dropColumn(['allow_split_sessions', 'auto_release_model_answers']));
        $db->table('bank_questions', fn (Blueprint $t) => $t->dropColumn(['image_path', 'model_answer', 'model_answer_image_path']));
        $db->table('questions', fn (Blueprint $t) => $t->dropColumn(['image_path', 'model_answer', 'model_answer_image_path']));
    }
};
