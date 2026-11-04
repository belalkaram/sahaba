<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TenantMetricSnapshot extends Model
{
    protected $primaryKey = 'tenant_id';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'tenant_id',
        'students_count',
        'staff_count',
        'courses_count',
        'storage_bytes',
        'last_activity_at',
        'status',
        'computed_at',
    ];

    protected $casts = [
        'last_activity_at' => 'datetime',
        'computed_at' => 'datetime',
    ];
}
