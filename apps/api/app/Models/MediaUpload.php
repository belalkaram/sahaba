<?php

namespace App\Models;

/**
 * A Drive resumable upload session opened for one uploader (ADR-008). The session URL can upload into the
 * tenant folder, so it is encrypted and never serialised.
 */
class MediaUpload extends TenantModel
{
    public const PENDING = 'pending';

    public const FINALIZING = 'finalizing';

    public const COMPLETED = 'completed';

    public const FAILED = 'failed';

    /** @return array{kind: string, account_id?: string} where the bytes live (ADR-009) */
    public function storageRef(): array
    {
        return $this->storage_kind === 'pool'
            ? ['kind' => 'pool', 'account_id' => (string) $this->storage_account_id]
            : ['kind' => 'tenant'];
    }

    protected $table = 'media_uploads';

    protected $fillable = [
        'provider',
        'title',
        'media_type',
        'course_id',
        'lesson_id',
        'file_name',
        'mime_type',
        'size_bytes',
        'session_url',
        'status',
        'external_file_id',
        'media_asset_id',
        'created_by',
        'expires_at',
        'storage_kind',
        'storage_account_id',
        'reservation_id',
        'failure_reason',
    ];

    protected $hidden = ['session_url'];

    protected $casts = [
        'session_url' => 'encrypted',
        'size_bytes' => 'integer',
        'expires_at' => 'datetime',
    ];
}
