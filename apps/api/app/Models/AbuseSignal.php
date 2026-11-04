<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AbuseSignal extends TenantModel
{
    protected $table = 'abuse_signals';

    public $timestamps = false;

    protected $fillable = [
        'student_id',
        'lesson_id',
        'signal_type',
        'severity',
        'payload',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'created_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }
}
