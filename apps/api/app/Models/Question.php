<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Question extends TenantModel
{
    protected $table = 'questions';

    protected $fillable = [
        'exam_id',
        'bank_id',
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

    /**
     * R0-2: Always hide correct_answer and acceptable_answers from student API responses.
     * Staff endpoints that legitimately need answers (e.g. exam editing/grading)
     * must call ->makeVisible(['correct_answer', 'acceptable_answers']) explicitly,
     * and only after verifying the user has exams.create or exams.grade permission.
     */
    protected $hidden = [
        'correct_answer',
        'acceptable_answers',
        // Model answers are released separately (ModelAnswerAccess); storage paths are never exposed.
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

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class, 'exam_id');
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(QuestionBank::class, 'bank_id');
    }
}
