<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ParentProfile extends TenantModel
{
    protected $table = 'parents';

    protected $fillable = [
        'user_id',
        'status',
        'whatsapp_opt_in',
        'whatsapp_opted_out_at',
    ];

    protected $casts = [
        'whatsapp_opt_in' => 'boolean',
        'whatsapp_opted_out_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function students(): BelongsToMany
    {
        return $this->belongsToMany(Student::class, 'student_parent', 'parent_id', 'student_id')
            ->withPivot('relation_type');
    }
}
