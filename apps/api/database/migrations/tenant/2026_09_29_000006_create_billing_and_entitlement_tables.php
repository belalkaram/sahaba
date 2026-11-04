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
        Schema::connection('tenant')->create('packages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('code')->nullable();
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->string('currency', 10)->default('EGP');
            $table->string('billing_cycle', 50)->default('monthly'); // monthly, term, yearly
            $table->string('status', 50)->default('active'); // active, archived
            $table->json('features')->nullable();
            $table->timestamps();
        });

        Schema::connection('tenant')->create('package_entitlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('package_id')->constrained('packages')->cascadeOnDelete();
            $table->string('entitlement_key'); // ONLINE_ACCESS, OFFLINE_ACCESS, EXAM_ACCESS, etc.
            $table->string('value')->default('enabled');
            $table->timestamps();
        });

        Schema::connection('tenant')->create('payment_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUuid('package_id')->constrained('packages')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 10)->default('EGP');
            $table->string('payment_method', 50); // instapay, cash, bank_transfer
            $table->string('sender_phone')->nullable();
            $table->string('reference_code')->nullable();
            $table->string('proof_url')->nullable();
            $table->string('status', 50)->default('pending'); // pending, approved, rejected, cancelled
            $table->text('rejection_reason')->nullable();
            $table->foreignUuid('reviewed_by_user_id')->nullable()->constrained('tenant_users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();
        });

        Schema::connection('tenant')->create('payment_review_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('payment_request_id')->constrained('payment_requests')->cascadeOnDelete();
            $table->foreignUuid('reviewed_by_user_id')->constrained('tenant_users')->cascadeOnDelete();
            $table->string('action', 50); // approved, rejected
            $table->text('reason')->nullable();
            $table->timestamp('logged_at')->useCurrent();
            $table->timestamps();
        });

        Schema::connection('tenant')->create('subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUuid('package_id')->constrained('packages')->cascadeOnDelete();
            $table->foreignUuid('payment_request_id')->nullable()->constrained('payment_requests')->nullOnDelete();
            $table->string('status', 50)->default('pending'); // pending, active, expired, cancelled
            $table->timestamp('starts_at')->useCurrent();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
        });

        Schema::connection('tenant')->create('entitlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignUuid('subscription_id')->nullable()->constrained('subscriptions')->cascadeOnDelete();
            $table->string('entitlement_key');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->string('reason')->nullable();
            $table->foreignUuid('granted_by_user_id')->nullable()->constrained('tenant_users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('entitlements');
        Schema::connection('tenant')->dropIfExists('subscriptions');
        Schema::connection('tenant')->dropIfExists('payment_review_logs');
        Schema::connection('tenant')->dropIfExists('payment_requests');
        Schema::connection('tenant')->dropIfExists('package_entitlements');
        Schema::connection('tenant')->dropIfExists('packages');
    }
};
