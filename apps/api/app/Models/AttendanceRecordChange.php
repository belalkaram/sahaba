<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceRecordChange extends TenantModel
{
    protected $table = 'attendance_record_changes';

    public $timestamps = false;

    protected $fillable = [
        'attendance_record_id',
        'changed_by_user_id',
        'old_status',
        'new_status',
        'reason',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function attendanceRecord(): BelongsTo
    {
        return $this->belongsTo(AttendanceRecord::class, 'attendance_record_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'changed_by_user_id');
    }
}
