<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SchoolClass extends TenantModel
{
    protected $table = 'classes';

    protected $fillable = [
        'teacher_staff_id',
        'branch_id',
        'name',
        'code',
        'status',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'teacher_staff_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ClassSession::class, 'class_id');
    }

    public function offlineAssessments(): HasMany
    {
        return $this->hasMany(OfflineAssessment::class, 'class_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'class_students', 'class_id', 'student_id')
            ->withPivot(['id', 'status', 'mode', 'enrolled_at'])
            ->withTimestamps();
    }
}
