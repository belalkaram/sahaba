<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentReviewLog extends TenantModel
{
    protected $table = 'payment_review_logs';

    protected $fillable = [
        'payment_request_id',
        'reviewed_by_user_id',
        'reviewed_by_platform_user_id',
        'reviewed_by_platform_user_name',
        'action',
        'reason',
        'logged_at',
    ];

    protected $casts = [
        'logged_at' => 'datetime',
    ];

    public function paymentRequest(): BelongsTo
    {
        return $this->belongsTo(PaymentRequest::class, 'payment_request_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'reviewed_by_user_id');
    }
}
