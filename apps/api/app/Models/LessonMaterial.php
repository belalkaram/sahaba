<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonMaterial extends TenantModel
{
    protected $table = 'lesson_materials';

    protected $fillable = [
        'lesson_id',
        'title',
        'kind',
        'storage_path',
        'url',
        'mime',
        'size',
        'sort_order',
    ];

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class, 'lesson_id');
    }
}
