<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One person an announcement was sent to, with what they did with it. */
class AnnouncementRecipient extends TenantModel
{
    protected $fillable = [
        'announcement_id', 'user_id', 'role', 'student_id',
        'first_seen_at', 'last_seen_at', 'seen_count', 'dismissed_at',
    ];

    protected $casts = [
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'dismissed_at' => 'datetime',
        'seen_count' => 'integer',
    ];

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(Announcement::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(TenantUser::class, 'user_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }
}
