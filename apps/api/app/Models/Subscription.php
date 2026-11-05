<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends TenantModel
{
    protected $table = 'subscriptions';

    protected $fillable = [
        'student_id',
        'package_id',
        'period_month',
        'payment_request_id',
        'status',
        'starts_at',
        'ends_at',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class, 'package_id');
    }

    public function paymentRequest(): BelongsTo
    {
        return $this->belongsTo(PaymentRequest::class, 'payment_request_id');
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(Entitlement::class, 'subscription_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && ($this->ends_at === null || now()->lessThanOrEqualTo($this->ends_at));
    }
}
