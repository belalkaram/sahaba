<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends TenantModel
{
    protected $table = 'roles';

    protected $fillable = [
        'name',
        'label',
        'is_system',
        'description',
    ];

    protected $casts = [
        'is_system' => 'boolean',
    ];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permission', 'role_id', 'permission_id')
            ->withPivot('scope')
            ->withTimestamps();
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(TenantUser::class, 'user_roles', 'role_id', 'user_id');
    }
}
