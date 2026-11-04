<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exam extends TenantModel
{
    protected $table = 'exams';

    protected $fillable = [
        'course_id',
        'title',
        'description',
        'opens_at',
        'closes_at',
        'duration_minutes',
        'max_attempts',
        'shuffle_questions',
        'shuffle_options',
        'show_results',
        'total_points',
        'passing_score',
        'is_published',
        'is_grades_published',
        'status',
    ];

    protected $casts = [
        'opens_at' => 'datetime',
        'closes_at' => 'datetime',
        'duration_minutes' => 'integer',
        'max_attempts' => 'integer',
        'shuffle_questions' => 'boolean',
        'shuffle_options' => 'boolean',
        'total_points' => 'decimal:2',
        'passing_score' => 'decimal:2',
        'is_published' => 'boolean',
        'is_grades_published' => 'boolean',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class, 'exam_id')->orderBy('sort_order', 'asc');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class, 'exam_id');
    }

    /**
     * Check if the exam is currently open for submissions.
     */
    public function isOpen(): bool
    {
        if ($this->status !== 'published' && ! $this->is_published) {
            return false;
        }

        $now = now();

        if ($this->opens_at !== null && $now->lessThan($this->opens_at)) {
            return false;
        }

        if ($this->closes_at !== null && $now->greaterThan($this->closes_at)) {
            return false;
        }

        return true;
    }

    /**
     * Verify if the exam meets publishing prerequisites:
     * Requires at least 1 question and total points > 0.
     *
     * @return array{can: bool, reason?: string}
     */
    public function canBePublished(): array
    {
        $questionCount = $this->questions()->count();
        if ($questionCount === 0) {
            return [
                'can' => false,
                'reason' => 'Exam must have at least one question before publishing.',
            ];
        }

        $points = $this->questions()->sum('points');
        if ($points <= 0) {
            return [
                'can' => false,
                'reason' => 'Total exam questions points must be greater than zero.',
            ];
        }

        return ['can' => true];
    }
}
