<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Staff extends TenantModel
{
    protected $table = 'staff';

    protected $fillable = [
        'user_id',
        'staff_type',
        'status',
        'photo_path',
        'headline',
        'public_bio',
        'is_public',
    ];

    protected $casts = [
        'is_public' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'teacher_staff_id');
    }

    public function classes(): HasMany
    {
        return $this->hasMany(SchoolClass::class, 'teacher_staff_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(StaffAssignment::class, 'staff_id');
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'staff_branches', 'staff_id', 'branch_id')->withTimestamps();
    }

    public function isTeacher(): bool
    {
        return $this->staff_type === 'teacher';
    }

    public function isAssistant(): bool
    {
        return $this->staff_type === 'assistant';
    }

    public function isAdmin(): bool
    {
        return $this->staff_type === 'admin';
    }
}
