<?php

/**
 * Dev tool: proves the one-round-trip loaders (App\Support\Database\PostgresFastPath) return the same models as the
 * Eloquent eager-loading path, on the database configured in .env (read-only: it only SELECTs).
 *
 *   php scripts/verify-fast-path.php [--tenant=almustaqbal]
 *
 * Compared: tenant attributes + databaseConfig + features, and for every token user the user attributes, role names,
 * role pivots, permission names and the `scope` on each role_permission pivot, plus permissionScope()/hasPermissionTo().
 */

use App\Models\Tenant;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Support\Database\PostgresFastPath;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$slug = getopt('', ['tenant::'])['tenant'] ?? 'almustaqbal';
$failures = 0;
$check = function (string $label, bool $ok, string $detail = '') use (&$failures) {
    printf("%s %s%s\n", $ok ? 'PASS' : 'FAIL', $label, $ok || $detail === '' ? '' : " — $detail");
    $failures += $ok ? 0 : 1;
};

if (! PostgresFastPath::enabled('pgsql')) {
    fwrite(STDERR, "fast path is not enabled for this connection (driver is not pgsql or DB_FAST_PATH=false)\n");
    exit(2);
}

// --- tenant ------------------------------------------------------------------------------------------
$slow = Tenant::with(['databaseConfig', 'features'])->where('slug', $slug)->firstOrFail();
$fast = PostgresFastPath::tenantBySlug($slug);
$check('tenant: found', $fast !== null);
$check('tenant: attributes', $fast->getAttributes() == $slow->getAttributes(), json_encode(array_diff_assoc($fast->getAttributes(), $slow->getAttributes())));
$check('tenant: toArray equal', $fast->toArray() == $slow->toArray());
$check('tenant: databaseConfig', $fast->databaseConfig?->toArray() == $slow->databaseConfig?->toArray());
$check('tenant: features', $fast->features->sortBy('id')->values()->toArray() == $slow->features->sortBy('id')->values()->toArray());
$check('tenant: hasFeature agrees', collect(['online', 'offline', 'assessment', 'billing', 'credentials', 'analytics'])->every(fn ($k) => $fast->hasFeature($k) === $slow->hasFeature($k)));
$check('tenant: unknown slug -> null', PostgresFastPath::tenantBySlug('no-such-tenant-xyz') === null);

// --- tokens -------------------------------------------------------------------------------------------
app(TenantDatabaseManager::class)->configureConnection($slow);
$users = TenantUser::with('roles')->get();
$check('users exist', $users->isNotEmpty(), 'no users in tenant');

$created = [];
foreach ($users as $user) {
    $made = TenantToken::createTokenFor($user, 'verify-fast-path', 5);
    $created[] = $made['token']->id;
    $hash = hash('sha256', $made['plainTextToken']);

    $a = TenantToken::with('user.roles.permissions')->where('token', $hash)->first();
    $b = PostgresFastPath::tokenWithAuthGraph($hash);
    $tag = "token {$user->email}";

    $check("$tag: found", $b !== null);
    $check("$tag: token attrs", $a->only(['id', 'user_id', 'token', 'name']) == $b->only(['id', 'user_id', 'token', 'name']) && $a->expires_at?->equalTo($b->expires_at));
    $check("$tag: user attrs", $a->user->only(['id', 'name', 'email', 'phone', 'type', 'status']) == $b->user->only(['id', 'name', 'email', 'phone', 'type', 'status']));
    $check("$tag: isActive", $a->user->isActive() === $b->user->isActive());
    $check("$tag: password hash kept (login/hidden)", $a->user->getAuthPassword() === $b->user->getAuthPassword());

    $norm = fn ($u) => $u->roles->sortBy('name')->map(fn ($r) => [
        'name' => $r->name,
        'pivot' => $r->pivot->only(['user_id', 'role_id']),
        'perms' => $r->permissions->sortBy('name')->map(fn ($p) => [$p->name, $p->pivot->scope, $p->pivot->role_id, $p->pivot->permission_id])->values()->all(),
    ])->values()->all();
    $check("$tag: roles + permissions + pivot scope", $norm($a->user) == $norm($b->user), 'role/permission graphs differ');

    $names = $a->user->getAllPermissions()->sort()->values()->all();
    $check("$tag: getAllPermissions", $names == $b->user->getAllPermissions()->sort()->values()->all());
    $scopesEqual = collect($names)->every(fn ($perm) => $a->user->permissionScope($perm) === $b->user->permissionScope($perm) && $a->user->hasPermissionTo($perm) === $b->user->hasPermissionTo($perm));
    $check("$tag: permissionScope/hasPermissionTo (".count($names).' perms)', $scopesEqual);
    $check("$tag: no extra queries needed to use it", (function () use ($b, $names) {
        $count = 0;
        DB::connection('tenant')->listen(function () use (&$count) { $count++; });
        foreach ($names as $perm) {
            $b->user->hasPermissionTo($perm);
            $b->user->permissionScope($perm);
        }
        $b->user->hasRole('teacher');

        return $count === 0;
    })());
}
$check('unknown token -> null', PostgresFastPath::tokenWithAuthGraph(str_repeat('0', 64)) === null);

TenantToken::whereIn('id', $created)->delete();
echo $failures === 0 ? "\nALL CHECKS PASSED\n" : "\n$failures CHECK(S) FAILED\n";
exit($failures === 0 ? 0 : 1);
