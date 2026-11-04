<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankQuestion extends TenantModel
{
    protected $table = 'bank_questions';

    protected $fillable = [
        'bank_id',
        'question_text',
        'question_type',
        'points',
        'options',
        'correct_answer',
        'acceptable_answers',
        'explanation',
    ];

    /**
     * Always hide correct answers from student responses.
     */
    protected $hidden = ['correct_answer', 'acceptable_answers'];

    protected $casts = [
        'points' => 'decimal:2',
        'options' => 'array',
        'acceptable_answers' => 'array',
    ];

    public function bank(): BelongsTo
    {
        return $this->belongsTo(QuestionBank::class, 'bank_id');
    }
}
