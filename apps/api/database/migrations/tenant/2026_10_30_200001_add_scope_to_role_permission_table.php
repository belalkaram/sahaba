<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * R1-A3: Add resource scope to role_permission pivot.
     */
    public function up(): void
    {
        Schema::connection('tenant')->table('role_permission', function (Blueprint $table) {
            $table->string('scope', 50)->default('tenant')->after('permission_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('tenant')->table('role_permission', function (Blueprint $table) {
            $table->dropColumn('scope');
        });
    }
};
