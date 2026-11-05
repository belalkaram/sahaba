<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppMessageLog extends TenantModel
{
    protected $table = 'whatsapp_message_logs';

    protected $fillable = [
        'tenant_id',
        'recipient_phone',
        'recipient_user_id',
        'event_key',
        'template_name',
        'parameters',
        'status',
        'provider_message_id',
        'error',
    ];

    protected $casts = [
        'parameters' => 'array',
    ];

    public function recipientUser(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'recipient_user_id');
    }
}
