<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonProgress extends TenantModel
{
    protected $table = 'lesson_progress';

    protected $fillable = [
        'student_id',
        'lesson_id',
        'percent',
        'last_position_seconds',
        'completed_at',
        'watch_seconds',
        'rewatch_count',
    ];

    protected $casts = [
        'percent' => 'integer',
        'last_position_seconds' => 'integer',
        'completed_at' => 'datetime',
        'watch_seconds' => 'integer',
        'rewatch_count' => 'integer',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class, 'lesson_id');
    }
}
