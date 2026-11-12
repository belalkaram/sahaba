<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * OD-37 (ANN-1): academy announcements with an exact audience and per-person receipts.
 *
 * - `audience` keeps what the sender chose (for display); `announcement_recipients` is the resolved list at publish
 *   time, so "who exactly" never changes afterwards and receipts are per person.
 * - display: bell (normal notification) | banner (bar at the top of the app) | modal (pop-up closed with ×)
 * - frequency (banner/modal): once (until the person closes it) | persistent (every sign-in until it ends)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('tenant')->create('announcements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 150);
            $table->text('body');
            $table->string('display', 16); // bell | banner | modal
            $table->string('frequency', 16)->default('once'); // once | persistent
            $table->string('tone', 16)->default('info'); // info | success | warning | danger
            $table->json('audience');
            $table->string('status', 16)->default('published'); // published | withdrawn
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamp('withdrawn_at')->nullable();
            $table->unsignedInteger('recipients_count')->default(0);
            $table->timestamps();

            $table->index(['status', 'starts_at', 'ends_at']);
        });

        Schema::connection('tenant')->create('announcement_recipients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('announcement_id')->constrained('announcements')->cascadeOnDelete();
            $table->uuid('user_id');
            $table->string('role', 16); // student | parent
            $table->uuid('student_id')->nullable(); // the student this person was reached through
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->unsignedInteger('seen_count')->default(0);
            $table->timestamp('dismissed_at')->nullable();
            $table->timestamps();

            $table->unique(['announcement_id', 'user_id']);
            $table->index(['user_id', 'dismissed_at']);
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('announcement_recipients');
        Schema::connection('tenant')->dropIfExists('announcements');
    }
};
