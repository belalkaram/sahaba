<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** ADR-006: an academy's request for more seats (control DB). */
class CapacityRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id', 'seats_requested', 'amount', 'currency', 'proof_path', 'note', 'status',
        'requested_by_user_id', 'requested_by_name', 'seats_used_at_request', 'quota_at_request',
        'seats_granted', 'quota_after', 'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'decision_note',
    ];

    protected $hidden = ['proof_path'];

    protected $casts = [
        'amount' => 'decimal:2',
        'seats_requested' => 'integer',
        'seats_used_at_request' => 'integer',
        'quota_at_request' => 'integer',
        'seats_granted' => 'integer',
        'quota_after' => 'integer',
        'reviewed_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
