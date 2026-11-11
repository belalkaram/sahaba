<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Student self-registration requests (reviewed by the tenant), plus the Saudi profile fields kept on the
     * student once approved. The national ID is stored encrypted; the HMAC hash only supports duplicate checks.
     */
    public function up(): void
    {
        Schema::connection('tenant')->create('student_registration_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('reference_code', 20)->unique();
            $table->string('full_name', 200);
            $table->text('national_id');
            $table->string('national_id_hash', 64)->index();
            $table->string('region', 40);
            $table->string('governorate', 120);
            $table->string('address', 300);
            $table->string('education_stage', 20);
            $table->unsignedTinyInteger('grade');
            $table->string('student_phone', 20)->index();
            $table->string('guardian_name', 200);
            $table->string('guardian_phone', 20);
            $table->string('guardian_occupation', 150)->nullable();
            $table->string('email')->nullable();
            $table->string('password_hash');
            $table->string('status', 20)->default('pending')->index();
            $table->foreignUuid('decided_by_user_id')->nullable()->constrained('tenant_users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_note', 500)->nullable();
            $table->foreignUuid('student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->timestamps();
        });

        Schema::connection('tenant')->table('students', function (Blueprint $table) {
            $table->text('national_id')->nullable();
            $table->string('national_id_hash', 64)->nullable()->index();
            $table->string('region', 40)->nullable();
            $table->string('governorate', 120)->nullable();
            $table->string('address', 300)->nullable();
            $table->string('education_stage', 20)->nullable();
            $table->string('guardian_occupation', 150)->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->table('students', function (Blueprint $table) {
            $table->dropColumn(['national_id', 'national_id_hash', 'region', 'governorate', 'address', 'education_stage', 'guardian_occupation']);
        });
        Schema::connection('tenant')->dropIfExists('student_registration_requests');
    }
};
