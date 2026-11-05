<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Platform-level public directory of opted-in teachers and academies (PS-2, F-1).
     * Lives in Control DB. Only marketing fields are kept — never contact details or auth ids.
     */
    public function up(): void
    {
        Schema::create('public_directory_entries', function (Blueprint $table) {
            $table->id();
            $table->uuid('tenant_id');
            $table->string('tenant_slug');
            $table->string('tenant_name');
            $table->uuid('staff_id');
            $table->string('name');
            $table->string('headline')->nullable();
            $table->text('bio')->nullable();
            $table->string('photo_url')->nullable();
            $table->string('city')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_public')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'staff_id']);
            $table->index(['is_public', 'is_featured', 'sort_order']);
            $table->index('tenant_slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('public_directory_entries');
    }
};
