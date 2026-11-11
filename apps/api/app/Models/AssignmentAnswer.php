<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentAnswer extends TenantModel
{
    protected $table = 'assignment_answers';

    protected $fillable = [
        'submission_id',
        'question_id',
        'answer_text',
        'selected_options',
        'is_correct',
        'awarded_points',
        'feedback',
    ];

    protected $casts = [
        'selected_options' => 'array',
        'is_correct' => 'boolean',
        'awarded_points' => 'decimal:2',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(AssignmentSubmission::class, 'submission_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(AssignmentQuestion::class, 'question_id');
    }
}
