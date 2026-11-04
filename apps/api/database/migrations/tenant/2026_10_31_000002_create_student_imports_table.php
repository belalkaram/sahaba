<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * R2-2: Student CSV Imports table.
     */
    public function up(): void
    {
        Schema::connection('tenant')->create('student_imports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('filename');
            $table->integer('total_rows')->default(0);
            $table->integer('processed_rows')->default(0);
            $table->integer('successful_rows')->default(0);
            $table->integer('failed_rows')->default(0);
            $table->string('status', 50)->default('completed');
            $table->json('results')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('tenant_users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('student_imports');
    }
};
