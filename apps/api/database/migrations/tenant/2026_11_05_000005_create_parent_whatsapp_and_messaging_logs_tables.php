<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * OD-33: Parent mandatory link, WhatsApp opt-in, messaging logs, and notification preferences.
     */
    public function up(): void
    {
        Schema::connection('tenant')->table('parents', function (Blueprint $table) {
            $table->boolean('whatsapp_opt_in')->default(true)->after('status');
            $table->timestamp('whatsapp_opted_out_at')->nullable()->after('whatsapp_opt_in');
        });

        Schema::connection('tenant')->table('notification_preferences', function (Blueprint $table) {
            $table->boolean('whatsapp')->default(false)->after('mail');
        });

        Schema::connection('tenant')->create('whatsapp_message_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tenant_id', 64)->nullable()->index();
            $table->string('recipient_phone', 30)->index();
            $table->foreignUuid('recipient_user_id')->nullable()->constrained('tenant_users')->nullOnDelete();
            $table->string('event_key', 64)->index();
            $table->string('template_name', 100);
            $table->json('parameters')->nullable();
            $table->string('status', 30)->default('queued')->index(); // queued, sent, failed, logged
            $table->string('provider_message_id', 100)->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index(['recipient_phone', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::connection('tenant')->dropIfExists('whatsapp_message_logs');

        Schema::connection('tenant')->table('notification_preferences', function (Blueprint $table) {
            $table->dropColumn('whatsapp');
        });

        Schema::connection('tenant')->table('parents', function (Blueprint $table) {
            $table->dropColumn(['whatsapp_opt_in', 'whatsapp_opted_out_at']);
        });
    }
};
