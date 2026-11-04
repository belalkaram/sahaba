<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends TenantModel
{
    protected $table = 'permissions';

    protected $fillable = [
        'name',
        'module',
        'description',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permission', 'permission_id', 'role_id')
            ->withPivot('scope')
            ->withTimestamps();
    }
}
