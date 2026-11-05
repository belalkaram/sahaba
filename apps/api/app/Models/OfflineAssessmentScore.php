<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineAssessmentScore extends TenantModel
{
    protected $table = 'offline_assessment_scores';

    protected $fillable = [
        'offline_assessment_id',
        'student_id',
        'score',
        'is_absent',
        'notes',
        'recorded_by_staff_id',
        'recorded_at',
    ];

    protected $casts = [
        'score' => 'decimal:2',
        'is_absent' => 'boolean',
        'recorded_at' => 'datetime',
    ];

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(OfflineAssessment::class, 'offline_assessment_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function recordedByStaff(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'recorded_by_staff_id');
    }
}
