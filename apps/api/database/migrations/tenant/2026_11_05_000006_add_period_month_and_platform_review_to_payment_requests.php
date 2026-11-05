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
        // 1. Update payment_requests for OD-27 monthly student billing and platform review
        if (Schema::connection('tenant')->hasTable('payment_requests')) {
            Schema::connection('tenant')->table('payment_requests', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('payment_requests', 'period_month')) {
                    $table->string('period_month', 7)->nullable()->after('amount')->index();
                }
                if (! Schema::connection('tenant')->hasColumn('payment_requests', 'reviewed_by_platform_user_id')) {
                    $table->string('reviewed_by_platform_user_id', 36)->nullable()->after('reviewed_by_user_id');
                }
                if (! Schema::connection('tenant')->hasColumn('payment_requests', 'reviewed_by_platform_user_name')) {
                    $table->string('reviewed_by_platform_user_name')->nullable()->after('reviewed_by_platform_user_id');
                }
                $table->uuid('package_id')->nullable()->change();
            });
        }

        // 2. Update payment_review_logs for platform reviewer support
        if (Schema::connection('tenant')->hasTable('payment_review_logs')) {
            Schema::connection('tenant')->table('payment_review_logs', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('payment_review_logs', 'reviewed_by_platform_user_id')) {
                    $table->string('reviewed_by_platform_user_id', 36)->nullable()->after('reviewed_by_user_id');
                }
                if (! Schema::connection('tenant')->hasColumn('payment_review_logs', 'reviewed_by_platform_user_name')) {
                    $table->string('reviewed_by_platform_user_name')->nullable()->after('reviewed_by_platform_user_id');
                }
                $table->uuid('reviewed_by_user_id')->nullable()->change();
            });
        }

        // 3. Update subscriptions for monthly period binding
        if (Schema::connection('tenant')->hasTable('subscriptions')) {
            Schema::connection('tenant')->table('subscriptions', function (Blueprint $table) {
                if (! Schema::connection('tenant')->hasColumn('subscriptions', 'period_month')) {
                    $table->string('period_month', 7)->nullable()->after('package_id')->index();
                }
                $table->uuid('package_id')->nullable()->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::connection('tenant')->hasTable('payment_requests')) {
            Schema::connection('tenant')->table('payment_requests', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('payment_requests', 'period_month')) {
                    $table->dropColumn('period_month');
                }
                if (Schema::connection('tenant')->hasColumn('payment_requests', 'reviewed_by_platform_user_id')) {
                    $table->dropColumn('reviewed_by_platform_user_id');
                }
                if (Schema::connection('tenant')->hasColumn('payment_requests', 'reviewed_by_platform_user_name')) {
                    $table->dropColumn('reviewed_by_platform_user_name');
                }
            });
        }

        if (Schema::connection('tenant')->hasTable('payment_review_logs')) {
            Schema::connection('tenant')->table('payment_review_logs', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('payment_review_logs', 'reviewed_by_platform_user_id')) {
                    $table->dropColumn('reviewed_by_platform_user_id');
                }
                if (Schema::connection('tenant')->hasColumn('payment_review_logs', 'reviewed_by_platform_user_name')) {
                    $table->dropColumn('reviewed_by_platform_user_name');
                }
            });
        }

        if (Schema::connection('tenant')->hasTable('subscriptions')) {
            Schema::connection('tenant')->table('subscriptions', function (Blueprint $table) {
                if (Schema::connection('tenant')->hasColumn('subscriptions', 'period_month')) {
                    $table->dropColumn('period_month');
                }
            });
        }
    }
};
