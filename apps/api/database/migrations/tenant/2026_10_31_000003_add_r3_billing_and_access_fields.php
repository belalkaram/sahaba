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
        // 1. Add is_free to courses
        if (Schema::connection('tenant')->hasTable('courses')) {
            Schema::connection('tenant')->table('courses', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('courses', 'is_free')) {
                    $table->boolean('is_free')->default(false)->after('status');
                }
            });
        }

        // 2. Add is_free_preview to lessons
        if (Schema::connection('tenant')->hasTable('lessons')) {
            Schema::connection('tenant')->table('lessons', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('lessons', 'is_free_preview')) {
                    $table->boolean('is_free_preview')->default(false)->after('status');
                }
            });
        }

        // 3. Add proof_path to payment_requests
        if (Schema::connection('tenant')->hasTable('payment_requests')) {
            Schema::connection('tenant')->table('payment_requests', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('payment_requests', 'proof_path')) {
                    $table->string('proof_path')->nullable()->after('proof_url');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::connection('tenant')->hasTable('courses')) {
            Schema::connection('tenant')->table('courses', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('courses', 'is_free')) {
                    $table->dropColumn('is_free');
                }
            });
        }

        if (Schema::connection('tenant')->hasTable('lessons')) {
            Schema::connection('tenant')->table('lessons', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('lessons', 'is_free_preview')) {
                    $table->dropColumn('is_free_preview');
                }
            });
        }

        if (Schema::connection('tenant')->hasTable('payment_requests')) {
            Schema::connection('tenant')->table('payment_requests', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('payment_requests', 'proof_path')) {
                    $table->dropColumn('proof_path');
                }
            });
        }
    }
};
