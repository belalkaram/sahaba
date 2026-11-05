<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Enrollment extends TenantModel
{
    protected $table = 'enrollments';

    protected $fillable = [
        'student_id',
        'course_id',
        'status',
        'mode',
        'enrolled_at',
        'completed_at',
    ];

    protected $casts = [
        'enrolled_at' => 'datetime',
        'completed_at' => 'datetime',
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
