<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineHomeworkCheck extends TenantModel
{
    protected $table = 'offline_homework_checks';

    protected $fillable = [
        'session_id',
        'student_id',
        'status',
        'note',
        'checked_by_staff_id',
        'checked_at',
    ];

    protected $casts = [
        'checked_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'session_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function checkedByStaff(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'checked_by_staff_id');
    }
}
