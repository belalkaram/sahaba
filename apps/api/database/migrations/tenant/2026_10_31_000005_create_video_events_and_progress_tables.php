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
        // 1. video_events table
        if (! Schema::connection('tenant')->hasTable('video_events')) {
            Schema::connection('tenant')->create('video_events', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
                $table->foreignUuid('lesson_id')->constrained('lessons')->cascadeOnDelete();
                $table->uuid('media_id')->nullable();
                $table->string('type', 30); // start, heartbeat, seek, pause, end
                $table->float('position_seconds')->default(0);
                $table->unsignedBigInteger('client_ts')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['student_id', 'lesson_id']);
                $table->index(['created_at']);
            });
        }

        // 2. lesson_progress table
        if (! Schema::connection('tenant')->hasTable('lesson_progress')) {
            Schema::connection('tenant')->create('lesson_progress', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
                $table->foreignUuid('lesson_id')->constrained('lessons')->cascadeOnDelete();
                $table->integer('percent')->default(0); // 0 to 100
                $table->integer('last_position_seconds')->default(0);
                $table->timestamp('completed_at')->nullable();
                $table->integer('watch_seconds')->default(0);
                $table->integer('rewatch_count')->default(0);
                $table->timestamps();

                $table->unique(['student_id', 'lesson_id']);
            });
        }

        // 3. abuse_signals table
        if (! Schema::connection('tenant')->hasTable('abuse_signals')) {
            Schema::connection('tenant')->create('abuse_signals', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
                $table->uuid('lesson_id')->nullable();
                $table->string('signal_type', 100); // concurrent_playback, excessive_speed, rewatch_spike
                $table->string('severity', 20)->default('warning'); // info, warning, critical
                $table->json('payload')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['student_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('abuse_signals');
        Schema::connection('tenant')->dropIfExists('lesson_progress');
        Schema::connection('tenant')->dropIfExists('video_events');
    }
};
