<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublicDirectoryEntry extends Model
{
    use HasFactory;

    protected $table = 'public_directory_entries';

    protected $fillable = [
        'tenant_id',
        'tenant_slug',
        'tenant_name',
        'staff_id',
        'name',
        'headline',
        'bio',
        'photo_url',
        'city',
        'is_featured',
        'is_public',
        'sort_order',
    ];

    protected $casts = [
        'is_featured' => 'boolean',
        'is_public' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
