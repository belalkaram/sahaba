<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceRecord extends TenantModel
{
    protected $table = 'attendance_records';

    protected $fillable = [
        'session_id',
        'student_id',
        'recorded_by_user_id',
        'status',
        'attendance_mode',
        'notes',
        'recorded_at',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'session_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'recorded_by_user_id');
    }

    public function changes(): HasMany
    {
        return $this->hasMany(AttendanceRecordChange::class, 'attendance_record_id')->orderBy('created_at', 'desc');
    }
}
