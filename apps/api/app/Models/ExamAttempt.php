<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamAttempt extends TenantModel
{
    protected $table = 'exam_attempts';

    protected $fillable = [
        'exam_id',
        'student_id',
        'attempt_number',
        'started_at',
        'expires_at',
        'submitted_at',
        'score',
        'feedback',
        'graded_by_user_id',
        'graded_at',
        'status',
        'violation_count',
        'integrity_events',
    ];

    protected $casts = [
        'attempt_number' => 'integer',
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
        'submitted_at' => 'datetime',
        'score' => 'decimal:2',
        'graded_at' => 'datetime',
        'integrity_events' => 'array',
        'violation_count' => 'integer',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class, 'exam_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function gradedBy(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'graded_by_user_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ExamAnswer::class, 'attempt_id');
    }

    /**
     * Check if attempt has exceeded server authoritative time limit.
     */
    public function isExpired(): bool
    {
        return $this->expires_at !== null && now()->greaterThan($this->expires_at);
    }
}
