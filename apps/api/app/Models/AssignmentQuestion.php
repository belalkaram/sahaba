<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A question inside an assignment (same shape and answer-hiding rules as an exam Question). */
class AssignmentQuestion extends TenantModel
{
    protected $table = 'assignment_questions';

    protected $fillable = [
        'assignment_id',
        'question_text',
        'question_type',
        'points',
        'options',
        'correct_answer',
        'acceptable_answers',
        'explanation',
        'image_path',
        'model_answer',
        'model_answer_image_path',
        'sort_order',
    ];

    protected $hidden = [
        'correct_answer',
        'acceptable_answers',
        'model_answer',
        'model_answer_image_path',
        'image_path',
    ];

    protected $appends = ['has_image', 'has_model_answer_image'];

    protected $casts = [
        'points' => 'decimal:2',
        'options' => 'array',
        'acceptable_answers' => 'array',
        'sort_order' => 'integer',
    ];

    public function getHasModelAnswerImageAttribute(): bool
    {
        return ! empty($this->attributes['model_answer_image_path'] ?? null);
    }

    public function getHasImageAttribute(): bool
    {
        return ! empty($this->attributes['image_path'] ?? null);
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'assignment_id');
    }
}
