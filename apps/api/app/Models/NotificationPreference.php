<?php

namespace App\Models;

class NotificationPreference extends TenantModel
{
    protected $fillable = ['user_id', 'event_key', 'in_app', 'mail'];

    protected $casts = [
        'in_app' => 'boolean',
        'mail' => 'boolean',
    ];
}
