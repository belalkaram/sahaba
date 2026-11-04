<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends TenantModel
{
    protected $table = 'assignments';

    protected $fillable = [
        'course_id',
        'lesson_id',
        'title',
        'description',
        'points_possible',
        'due_at',
        'allow_late',
        'late_penalty_percent',
        'allow_resubmission',
        'max_file_size_mb',
        'allowed_file_types',
        'status',
    ];

    protected $casts = [
        'points_possible' => 'decimal:2',
        'due_at' => 'datetime',
        'allow_late' => 'boolean',
        'late_penalty_percent' => 'integer',
        'allow_resubmission' => 'boolean',
        'max_file_size_mb' => 'integer',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class, 'lesson_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(AssignmentSubmission::class, 'assignment_id');
    }

    public function isPastDue(): bool
    {
        return $this->due_at !== null && now()->greaterThan($this->due_at);
    }
}
