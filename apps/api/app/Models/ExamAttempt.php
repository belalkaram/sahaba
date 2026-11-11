<?php

namespace App\Models;

use App\Domain\Assessment\Services\ExamTimeBudget;
use Illuminate\Database\Eloquent\Builder;
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
        'time_used_seconds',
        'last_seen_at',
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
        'time_used_seconds' => 'integer',
        'last_seen_at' => 'datetime',
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
     * Submitted, but with no score yet or an essay answer still ungraded. The grading inbox and the exams
     * overview share this rule so their numbers always match.
     */
    public function scopePendingGrading(Builder $query): Builder
    {
        return $query->where('status', 'submitted')->where(function (Builder $q) {
            $q->whereNull('score')
                ->orWhereHas('answers', function (Builder $aq) {
                    $aq->whereNull('awarded_points')
                        ->whereHas('question', fn (Builder $qq) => $qq->where('question_type', 'essay'));
                });
        });
    }

    /**
     * Check if attempt has exceeded server authoritative time limit.
     */
    public function isExpired(): bool
    {
        // Split-session exams: the attempt ends when the TOTAL active time is used up or the window closes,
        // not when one session's wall-clock deadline passes (the student may legitimately return tomorrow).
        if ($this->exam?->allow_split_sessions) {
            return ExamTimeBudget::isExhausted($this, $this->exam);
        }

        return $this->expires_at !== null && now()->greaterThan($this->expires_at);
    }
}
