<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VideoEvent extends TenantModel
{
    protected $table = 'video_events';

    public $timestamps = false;

    protected $fillable = [
        'student_id',
        'lesson_id',
        'media_id',
        'type',
        'position_seconds',
        'client_ts',
        'created_at',
    ];

    protected $casts = [
        'position_seconds' => 'float',
        'client_ts' => 'integer',
        'created_at' => 'datetime',
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
