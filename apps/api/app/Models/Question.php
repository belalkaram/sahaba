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
    ];

    protected $casts = [
        'points' => 'decimal:2',
        'options' => 'array',
        'acceptable_answers' => 'array',
        'sort_order' => 'integer',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class, 'exam_id');
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(QuestionBank::class, 'bank_id');
    }
}
