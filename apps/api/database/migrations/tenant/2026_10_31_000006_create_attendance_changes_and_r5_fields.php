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
        // 1. Add timing_mode and grace_period_minutes to sessions
        Schema::connection('tenant')->table('sessions', function (Blueprint $table) {
            if (! Schema::connection('tenant')->hasColumn('sessions', 'timing_mode')) {
                $table->string('timing_mode', 50)->default('scheduled')->after('attendance_mode'); // scheduled, open
            }
            if (! Schema::connection('tenant')->hasColumn('sessions', 'grace_period_minutes')) {
                $table->integer('grace_period_minutes')->default(30)->after('timing_mode');
            }
        });

        // 2. Create attendance_record_changes history table (R5-4)
        if (! Schema::connection('tenant')->hasTable('attendance_record_changes')) {
            Schema::connection('tenant')->create('attendance_record_changes', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('attendance_record_id')->constrained('attendance_records')->cascadeOnDelete();
                $table->foreignUuid('changed_by_user_id')->nullable()->constrained('tenant_users')->nullOnDelete();
                $table->string('old_status', 50);
                $table->string('new_status', 50);
                $table->text('reason');
                $table->timestamp('created_at')->useCurrent();

                $table->index(['attendance_record_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('attendance_record_changes');

        Schema::connection('tenant')->table('sessions', function (Blueprint $table) {
            if (Schema::connection('tenant')->hasColumn('sessions', 'grace_period_minutes')) {
                $table->dropColumn('grace_period_minutes');
            }
            if (Schema::connection('tenant')->hasColumn('sessions', 'timing_mode')) {
                $table->dropColumn('timing_mode');
            }
        });
    }
};
