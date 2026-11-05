<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassSession extends TenantModel
{
    protected $table = 'sessions';

    protected $fillable = [
        'class_id',
        'classroom_id',
        'title',
        'starts_at',
        'ends_at',
        'attendance_mode',
        'timing_mode',
        'grace_period_minutes',
        'status',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class, 'classroom_id');
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'session_id');
    }

    public function homeworkChecks(): HasMany
    {
        return $this->hasMany(OfflineHomeworkCheck::class, 'session_id');
    }

    public function offlineAssessments(): HasMany
    {
        return $this->hasMany(OfflineAssessment::class, 'session_id');
    }
}
