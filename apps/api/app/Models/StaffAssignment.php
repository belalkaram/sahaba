<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffAssignment extends TenantModel
{
    protected $table = 'staff_assignments';

    protected $fillable = [
        'staff_id',
        'assignable_type',
        'assignable_id',
        'role_context',
    ];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }
}
