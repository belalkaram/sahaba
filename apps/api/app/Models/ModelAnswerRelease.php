<?php

namespace App\Models;

class ModelAnswerRelease extends TenantModel
{
    protected $table = 'model_answer_releases';

    protected $fillable = [
        'assessable_type',
        'assessable_id',
        'scope',
        'student_id',
        'class_id',
        'released_by_user_id',
        'released_at',
    ];

    protected $casts = [
        'released_at' => 'datetime',
    ];
}
