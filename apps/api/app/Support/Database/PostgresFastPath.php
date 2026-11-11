<?php

namespace App\Support\Database;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantFeature;
use App\Models\TenantToken;
use App\Models\TenantUser;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Facades\DB;

/**
 * One-round-trip loaders for the two lookups every authenticated request makes: the tenant (with its database
 * config and features) and the token with its user, roles and permissions.
 *
 * On a remote database each query costs a network round trip (about 0.5 s on Neon from the Gulf/Egypt), and the
 * Eloquent eager-loading path needs 2 queries for the tenant and 4 for the token. These return the same
 * hydrated models in 1 query each, using Postgres JSON aggregation. Other drivers (sqlite in tests and local
 * development) keep using the Eloquent path; `DB_FAST_PATH=false` disables this everywhere.
 *
 * `scripts/verify-fast-path.php` compares both paths on real data.
 */
final class PostgresFastPath
{
    public static function enabled(string $connection): bool
    {
        return (bool) config('database.fast_path', true) && DB::connection($connection)->getDriverName() === 'pgsql';
    }

    /** Tenant by slug, with `databaseConfig` and `features` already loaded (`domains` stays lazy). */
    public static function tenantBySlug(string $slug): ?Tenant
    {
        $row = DB::selectOne(
            'select t.*,
                (select to_jsonb(d) from tenant_databases d where d.tenant_id = t.id limit 1) as "__database",
                coalesce((select jsonb_agg(to_jsonb(f)) from tenant_features f where f.tenant_id = t.id), \'[]\'::jsonb) as "__features"
             from tenants t where t.slug = ? limit 1',
            [$slug]
        );
        if ($row === null) {
            return null;
        }

        $row = (array) $row;
        $database = json_decode($row['__database'] ?? 'null', true);
        $features = json_decode($row['__features'] ?? '[]', true) ?: [];
        unset($row['__database'], $row['__features']);

        $tenant = self::hydrate(new Tenant, $row);
        $tenant->setRelation('databaseConfig', $database ? self::hydrate(new TenantDatabase, $database) : null);
        $tenant->setRelation('features', new Collection(array_map(fn (array $f) => self::hydrate(new TenantFeature, $f), $features)));

        return $tenant;
    }

    /**
     * Token by its sha256 hash with `user.roles.permissions` loaded (roles carry the user_roles pivot, permissions the
     * role_permission pivot including `scope`). Expiry is checked by the caller.
     */
    public static function tokenWithAuthGraph(string $hashedToken): ?TenantToken
    {
        $row = DB::connection('tenant')->selectOne(
            'select t.*,
                (select to_jsonb(u) from tenant_users u where u.id = t.user_id) as "__user",
                coalesce((
                    select jsonb_agg(jsonb_build_object(
                        \'role\', to_jsonb(r),
                        \'pivot\', jsonb_build_object(\'user_id\', ur.user_id, \'role_id\', ur.role_id),
                        \'permissions\', coalesce((
                            select jsonb_agg(jsonb_build_object(
                                \'permission\', to_jsonb(p),
                                \'pivot\', jsonb_build_object(\'role_id\', rp.role_id, \'permission_id\', rp.permission_id, \'scope\', rp.scope)
                            ))
                            from role_permission rp join permissions p on p.id = rp.permission_id
                            where rp.role_id = r.id
                        ), \'[]\'::jsonb)
                    ))
                    from user_roles ur join roles r on r.id = ur.role_id
                    where ur.user_id = t.user_id
                ), \'[]\'::jsonb) as "__roles"
             from tenant_tokens t where t.token = ? limit 1',
            [$hashedToken]
        );
        if ($row === null) {
            return null;
        }

        $row = (array) $row;
        $userRow = json_decode($row['__user'] ?? 'null', true);
        $roleRows = json_decode($row['__roles'] ?? '[]', true) ?: [];
        unset($row['__user'], $row['__roles']);

        $token = self::hydrate(new TenantToken, $row);
        if ($userRow === null) {
            $token->setRelation('user', null);

            return $token;
        }

        $user = self::hydrate(new TenantUser, $userRow);
        $roles = new Collection;
        foreach ($roleRows as $r) {
            $role = self::hydrate(new Role, $r['role']);
            $role->setRelation('pivot', Pivot::fromRawAttributes($user, $r['pivot'], 'user_roles', true));

            $permissions = new Collection;
            foreach ($r['permissions'] as $p) {
                $permission = self::hydrate(new Permission, $p['permission']);
                $permission->setRelation('pivot', Pivot::fromRawAttributes($role, $p['pivot'], 'role_permission', true));
                $permissions->push($permission);
            }
            $role->setRelation('permissions', $permissions);
            $roles->push($role);
        }
        $user->setRelation('roles', $roles);
        $token->setRelation('user', $user);

        return $token;
    }

    /** @param  array<string, mixed>  $attributes */
    private static function hydrate(Model $prototype, array $attributes): Model
    {
        // Nested JSON columns come back decoded here but as strings from a plain select: normalise to strings.
        foreach ($attributes as $key => $value) {
            if (is_array($value)) {
                $attributes[$key] = json_encode($value);
            }
        }

        return $prototype->newFromBuilder($attributes, $prototype->getConnectionName());
    }
}
