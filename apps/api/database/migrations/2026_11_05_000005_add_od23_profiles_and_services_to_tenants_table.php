<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * P1 / OD-23 / ADR-002: Add canonical archetype columns and contact info to tenants table.
     */
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('organization_kind', 50)->nullable()->after('type');
            $table->string('city', 100)->nullable()->after('brand_tagline');
            $table->string('contact_phone', 50)->nullable()->after('city');
            $table->string('onboarding_source', 50)->default('direct')->after('contact_phone');
        });

        // Backfill existing rows to canonical OD-23 types
        $tenants = DB::table('tenants')->get();
        foreach ($tenants as $t) {
            $brandSettings = ! empty($t->brand_settings) ? json_decode($t->brand_settings, true) : [];

            $oldType = strtolower((string) ($t->type ?? ''));
            $isIndividual = in_array($oldType, ['individual_teacher', 'tutor'], true);

            $newType = $isIndividual ? 'individual_teacher' : 'organization';

            $newKind = null;
            if (! $isIndividual) {
                if (! empty($brandSettings['organization_kind'])) {
                    $newKind = $brandSettings['organization_kind'];
                } elseif (in_array($oldType, ['center', 'academy', 'school', 'institute'], true)) {
                    $newKind = $oldType;
                } else {
                    $newKind = 'center';
                }
            }

            $city = $brandSettings['city'] ?? null;

            DB::table('tenants')->where('id', $t->id)->update([
                'type' => $newType,
                'organization_kind' => $newKind,
                'city' => $city,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'organization_kind',
                'city',
                'contact_phone',
                'onboarding_source',
            ]);
        });
    }
};
