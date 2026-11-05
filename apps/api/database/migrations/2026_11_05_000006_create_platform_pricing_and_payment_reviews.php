<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations on the Control DB.
     */
    public function up(): void
    {
        // 1. Platform Pricing Table (OD-27, F-17)
        if (! Schema::hasTable('platform_pricing')) {
            Schema::create('platform_pricing', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('tenant_id')->nullable()->constrained('tenants')->cascadeOnDelete();
                $table->decimal('student_monthly_fee', 10, 2)->default(10.00);
                $table->string('currency', 10)->default('SAR');
                $table->string('receiving_account_type', 50)->default('platform'); // 'platform' or 'teacher' (OD-27 Q-2)
                $table->string('bank_name', 100)->nullable();
                $table->string('account_holder_name', 150)->nullable();
                $table->string('iban', 50)->nullable();
                $table->text('transfer_instructions')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // 2. Platform Payment Reviews Ledger (OD-27, ADR-004)
        if (! Schema::hasTable('platform_payment_reviews')) {
            Schema::create('platform_payment_reviews', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->uuid('payment_request_id')->index();
                $table->uuid('student_id')->index();
                $table->string('reviewer_id', 36)->nullable()->index();
                $table->string('reviewer_name')->nullable();
                $table->string('action', 50); // approved, rejected
                $table->string('period_month', 7)->index(); // YYYY-MM
                $table->decimal('amount', 10, 2);
                $table->string('currency', 10)->default('SAR');
                $table->text('notes')->nullable();
                $table->timestamp('reviewed_at')->useCurrent();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('platform_payment_reviews');
        Schema::dropIfExists('platform_pricing');
    }
};
