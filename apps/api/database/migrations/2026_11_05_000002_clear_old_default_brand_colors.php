<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The old column default (#04c3c9) overrode the platform brand and fails contrast on white
     * (2.18:1). Tenants that never chose a color get NULL, meaning "use the platform brand".
     */
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('primary_color', 30)->nullable()->default(null)->change();
            $table->string('secondary_color', 30)->nullable()->default(null)->change();
        });

        DB::table('tenants')->whereRaw('lower(primary_color) = ?', ['#04c3c9'])->update(['primary_color' => null]);
        DB::table('tenants')->whereRaw('lower(secondary_color) = ?', ['#0284c7'])->update(['secondary_color' => null]);
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('primary_color', 30)->nullable()->default('#04c3c9')->change();
            $table->string('secondary_color', 30)->nullable()->default('#0284c7')->change();
        });
    }
};
