<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;

class TenantUser extends Authenticatable
{
    use HasFactory, HasUuids, Notifiable;

    protected $connection = 'tenant';

    protected $table = 'tenant_users';

    protected $fillable = [
        'name',
        'phone',
        'email',
        'password',
        'type',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    public function student(): HasOne
    {
        return $this->hasOne(Student::class, 'user_id');
    }

    public function staff(): HasOne
    {
        return $this->hasOne(Staff::class, 'user_id');
    }

    public function parentProfile(): HasOne
    {
        return $this->hasOne(ParentProfile::class, 'user_id');
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles', 'user_id', 'role_id');
    }

    public function tokens(): HasMany
    {
        return $this->hasMany(TenantToken::class, 'user_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function hasRole(string|array $roles): bool
    {
        $roles = is_array($roles) ? $roles : [$roles];

        return $this->roles->pluck('name')->intersect($roles)->isNotEmpty();
    }

    public function hasPermissionTo(string $permission): bool
    {
        return $this->getAllPermissions()->contains($permission);
    }

    public const SCOPE_HIERARCHY = [
        'self' => 1,
        'linked' => 2,
        'own' => 3,
        'assigned' => 4,
        'branch' => 5,
        'tenant' => 6,
    ];

    /**
     * Get the highest resource scope granted to this user for the specified permission.
     * Hierarchy: tenant > branch > assigned > own > linked > self.
     * Returns null if user does not possess the permission.
     */
    public function permissionScope(string $permission): ?string
    {
        $this->loadMissing('roles.permissions');

        $highestScope = null;
        $highestRank = 0;

        foreach ($this->roles as $role) {
            foreach ($role->permissions as $perm) {
                if ($perm->name === $permission) {
                    $scope = $perm->pivot->scope ?? 'tenant';
                    $rank = self::SCOPE_HIERARCHY[$scope] ?? 0;
                    if ($rank > $highestRank) {
                        $highestRank = $rank;
                        $highestScope = $scope;
                    }
                }
            }
        }

        return $highestScope;
    }

    /**
     * Get all permissions with their highest resolved scope.
     *
     * @return array<string, string> Map of permission name => highest scope
     */
    public function getPermissionsWithScope(): array
    {
        $this->loadMissing('roles.permissions');

        $result = [];

        foreach ($this->roles as $role) {
            foreach ($role->permissions as $perm) {
                $name = $perm->name;
                $scope = $perm->pivot->scope ?? 'tenant';
                $rank = self::SCOPE_HIERARCHY[$scope] ?? 0;

                $existingScope = $result[$name] ?? null;
                $existingRank = $existingScope ? (self::SCOPE_HIERARCHY[$existingScope] ?? 0) : 0;

                if ($rank > $existingRank) {
                    $result[$name] = $scope;
                }
            }
        }

        return $result;
    }

    /**
     * Get all unique permissions granted to this user through assigned roles.
     *
     * @return Collection<int, string>
     */
    public function getAllPermissions(): Collection
    {
        return $this->roles
            ->loadMissing('permissions')
            ->flatMap(fn (Role $role) => $role->permissions->pluck('name'))
            ->unique()
            ->values();
    }
}
