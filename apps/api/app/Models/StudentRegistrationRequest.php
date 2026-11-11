<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentRegistrationRequest extends TenantModel
{
    protected $table = 'student_registration_requests';

    protected $fillable = [
        'reference_code', 'full_name', 'national_id', 'national_id_hash', 'region', 'governorate', 'address',
        'education_stage', 'grade', 'student_phone', 'guardian_name', 'guardian_phone', 'guardian_occupation',
        'email', 'password_hash', 'status', 'decided_by_user_id', 'decided_at', 'decision_note', 'student_id',
    ];

    /** Never serialised: the password hash, and the national ID (only a masked form is exposed). */
    protected $hidden = ['password_hash', 'national_id', 'national_id_hash'];

    protected function casts(): array
    {
        return [
            'national_id' => 'encrypted',
            'grade' => 'integer',
            'decided_at' => 'datetime',
        ];
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'decided_by_user_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
