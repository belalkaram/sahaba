<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PaymentRequest extends TenantModel
{
    protected $table = 'payment_requests';

    protected $fillable = [
        'student_id',
        'package_id',
        'amount',
        'currency',
        'payment_method',
        'sender_phone',
        'reference_code',
        'proof_url',
        'proof_path',
        'status',
        'rejection_reason',
        'reviewed_by_user_id',
        'reviewed_at',
        'submitted_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'reviewed_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class, 'package_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'reviewed_by_user_id');
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class, 'payment_request_id');
    }

    public function reviewLogs(): HasMany
    {
        return $this->hasMany(PaymentReviewLog::class, 'payment_request_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }
}
