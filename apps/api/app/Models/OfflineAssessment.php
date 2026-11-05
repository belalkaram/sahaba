<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OfflineAssessment extends TenantModel
{
    protected $table = 'offline_assessments';

    protected $fillable = [
        'class_id',
        'session_id',
        'title',
        'max_score',
        'date',
        'created_by_staff_id',
        'description',
    ];

    protected $casts = [
        'max_score' => 'decimal:2',
        'date' => 'date',
    ];

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'session_id');
    }

    public function createdByStaff(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'created_by_staff_id');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(OfflineAssessmentScore::class, 'offline_assessment_id');
    }
}
