<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Course extends TenantModel
{
    protected $table = 'courses';

    protected $fillable = [
        'teacher_staff_id',
        'title',
        'code',
        'description',
        'cover_path',
        'level',
        'status',
        'is_free',
        'is_public',
        'published_at',
    ];

    protected $casts = [
        'is_free' => 'boolean',
        'is_public' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'teacher_staff_id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(CourseModule::class, 'course_id')->orderBy('sort_order', 'asc');
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class, 'course_id')->orderBy('sort_order', 'asc');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class, 'course_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'enrollments', 'course_id', 'student_id')
            ->withPivot(['id', 'status', 'enrolled_at', 'completed_at'])
            ->withTimestamps();
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'course_id');
    }

    public function exams(): HasMany
    {
        return $this->hasMany(Exam::class, 'course_id');
    }

    public function questionBanks(): HasMany
    {
        return $this->hasMany(QuestionBank::class, 'course_id');
    }
}
