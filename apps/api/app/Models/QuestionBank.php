<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuestionBank extends TenantModel
{
    protected $table = 'question_banks';

    protected $fillable = [
        'course_id',
        'title',
        'description',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(BankQuestion::class, 'bank_id');
    }
}
