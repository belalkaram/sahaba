<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAnalyticsSnapshot extends TenantModel
{
    use HasUuids;

    protected $table = 'student_analytics_snapshots';

    protected $fillable = [
        'student_id',
        'course_id',
        'attendance_rate',
        'assignment_completion_rate',
        'exam_average',
        'overall_score',
        'lesson_completion_rate',
        'last_activity_at',
        'custom_metrics_summary',
        'last_calculated_at',
    ];

    protected $casts = [
        'attendance_rate' => 'decimal:2',
        'assignment_completion_rate' => 'decimal:2',
        'exam_average' => 'decimal:2',
        'overall_score' => 'decimal:2',
        'lesson_completion_rate' => 'decimal:2',
        'last_activity_at' => 'datetime',
        'custom_metrics_summary' => 'array',
        'last_calculated_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'course_id');
    }
}
