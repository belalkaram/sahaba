<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Lesson extends TenantModel
{
    protected $table = 'lessons';

    protected $fillable = [
        'course_id',
        'module_id',
        'title',
        'content',
        'type',
        'duration_seconds',
        'ref_id',
        'sort_order',
        'status',
        'is_free_preview',
        'published_at',
    ];

    protected $casts = [
        'is_free_preview' => 'boolean',
        'duration_seconds' => 'integer',
        'published_at' => 'datetime',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(CourseModule::class, 'module_id');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(LessonMaterial::class, 'lesson_id')->orderBy('sort_order', 'asc');
    }

    public function mediaAssets(): HasMany
    {
        return $this->hasMany(MediaAsset::class, 'lesson_id');
    }

    public function progress(): HasOne
    {
        return $this->hasOne(LessonProgress::class, 'lesson_id');
    }
}
