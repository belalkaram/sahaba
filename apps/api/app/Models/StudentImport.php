<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentImport extends TenantModel
{
    protected $table = 'student_imports';

    protected $fillable = [
        'filename',
        'total_rows',
        'processed_rows',
        'successful_rows',
        'failed_rows',
        'status',
        'results',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'results' => 'array',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'created_by');
    }
}
