<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformPaymentReview extends Model
{
    use HasUuids;

    protected $table = 'platform_payment_reviews';

    protected $fillable = [
        'tenant_id',
        'payment_request_id',
        'student_id',
        'reviewer_id',
        'reviewer_name',
        'action',
        'period_month',
        'amount',
        'currency',
        'notes',
        'reviewed_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'reviewed_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(PlatformUser::class, 'reviewer_id');
    }
}
