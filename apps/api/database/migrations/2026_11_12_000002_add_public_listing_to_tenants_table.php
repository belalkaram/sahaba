<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * LANDING-V2 L1: an academy appears in the public directory only after opting in, the same rule
     * already used for teachers (`staff.is_public`) and student self-registration
     * (`tenants.accepts_registrations`). `is_featured` is set by the platform team and only
     * reorders academies that already opted in.
     */
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('is_listed')->default(false)->after('accepts_registrations');
            $table->boolean('is_featured')->default(false)->after('is_listed');
            $table->index(['is_listed', 'is_featured'], 'tenants_public_listing_index');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropIndex('tenants_public_listing_index');
            $table->dropColumn(['is_listed', 'is_featured']);
        });
    }
};
