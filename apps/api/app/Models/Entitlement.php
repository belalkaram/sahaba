<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Entitlement extends TenantModel
{
    protected $table = 'entitlements';

    protected $fillable = [
        'student_id',
        'subscription_id',
        'entitlement_key',
        'is_active',
        'expires_at',
        'reason',
        'granted_by_user_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class, 'subscription_id');
    }

    public function isValid(): bool
    {
        return $this->is_active && ($this->expires_at === null || now()->lessThanOrEqualTo($this->expires_at));
    }
}
