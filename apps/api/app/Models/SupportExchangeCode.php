<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One-time exchange code for support access (R0-5).
 *
 * The platform generates this code and passes it to the frontend.
 * The frontend POSTs it to POST /auth/support/exchange inside the tenant,
 * which burns it and returns the actual bearer token.
 */
class SupportExchangeCode extends Model
{
    protected $fillable = [
        'code_hash',
        'tenant_id',
        'actor_id',
        'actor_type',
        'reason',
        'expires_at',
        'used_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    /** Is this code still valid (not expired and not used)? */
    public function isValid(): bool
    {
        return $this->used_at === null && $this->expires_at->isFuture();
    }
}
