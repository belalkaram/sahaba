<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Student extends TenantModel
{
    protected $table = 'students';

    protected $fillable = [
        'user_id',
        'global_identity_id',
        'student_code',
        'grade_level',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function parents(): BelongsToMany
    {
        return $this->belongsToMany(ParentProfile::class, 'student_parent', 'student_id', 'parent_id')
            ->withPivot('relation_type');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class, 'student_id');
    }

    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'enrollments', 'student_id', 'course_id')
            ->withPivot(['id', 'status', 'mode', 'enrolled_at', 'completed_at'])
            ->withTimestamps();
    }

    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(SchoolClass::class, 'class_students', 'student_id', 'class_id')
            ->withPivot(['id', 'status', 'mode', 'enrolled_at'])
            ->withTimestamps();
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'student_id');
    }

    public function homeworkChecks(): HasMany
    {
        return $this->hasMany(OfflineHomeworkCheck::class, 'student_id');
    }

    public function offlineScores(): HasMany
    {
        return $this->hasMany(OfflineAssessmentScore::class, 'student_id');
    }

    public function paymentRequests(): HasMany
    {
        return $this->hasMany(PaymentRequest::class, 'student_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class, 'student_id');
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(Entitlement::class, 'student_id');
    }

    public function accessCredentials(): HasMany
    {
        return $this->hasMany(AccessCredential::class, 'student_id');
    }

    /**
     * Check if student currently holds a valid, active entitlement for a specific key.
     */
    public function hasEntitlement(string $key): bool
    {
        return $this->entitlements()
            ->where('entitlement_key', $key)
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->exists();
    }
}
