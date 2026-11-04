<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * platform_user_id pointed at `users`, so a real platform user (platform_users, R1-A9) could
     * not start a support session. It now stores the platform actor id without that constraint:
     * the actor may be a platform user or the static CI token.
     */
    public function up(): void
    {
        Schema::table('support_access_logs', function (Blueprint $table) {
            $table->dropForeign(['platform_user_id']);
        });

        Schema::table('support_access_logs', function (Blueprint $table) {
            $table->string('platform_user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Existing rows may hold ids that are not in `users`, so the constraint is not restored.
    }
};
