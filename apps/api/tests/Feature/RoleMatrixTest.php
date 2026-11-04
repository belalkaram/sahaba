<?php

namespace Tests\Feature;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantToken;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * R9-3: every system role × every permission-protected route. The expected result comes from
 * config/authorization.php, so a route or role change cannot silently widen access.
 * Only the permission gate is asserted here; scope is covered by ScopeEnforcementTest.
 */
class RoleMatrixTest extends TestCase
{
    use RefreshDatabase;

    private const FAKE_ID = '00000000-0000-4000-8000-000000000000';

    public function test_every_role_gets_exactly_the_access_the_catalog_defines(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);

        $conn = 'role_matrix_'.uniqid();
        $tenant = Tenant::create(['name' => 'Matrix', 'slug' => 'matrix-'.uniqid(), 'type' => 'school', 'status' => 'active']);
        TenantDatabase::create(['tenant_id' => $tenant->id, 'connection_identifier' => $conn, 'status' => 'ready']);
        TenantDomain::create(['tenant_id' => $tenant->id, 'domain' => $tenant->slug.'.localhost', 'active' => true]);

        $db = app(TenantDatabaseManager::class);
        $db->migrateTenant($tenant);
        $db->configureConnection($tenant);
        app(TenantContext::class)->setTenant($tenant);

        foreach (array_keys(config('authorization.modules')) as $module) {
            $tenant->features()->create(['feature_key' => $module, 'enabled' => true]);
        }
        app(RoleSynchronizer::class)->sync();

        $routes = $this->protectedRoutes();
        $this->assertGreaterThan(50, count($routes), 'Expected many permission-protected routes');

        $mismatches = [];

        foreach (config('authorization.roles') as $roleName => $definition) {
            $user = TenantUser::create([
                'name' => $roleName,
                'email' => "{$roleName}@matrix.test",
                'phone' => '+2010'.random_int(10000000, 99999999),
                'password' => Hash::make('password123'),
                'type' => in_array($roleName, ['student', 'parent'], true) ? $roleName : 'staff',
                'status' => 'active',
            ]);
            $user->roles()->attach(Role::where('name', $roleName)->firstOrFail()->id);

            $headers = [
                'X-Tenant-Slug' => $tenant->slug,
                'Authorization' => 'Bearer '.TenantToken::createTokenFor($user)['plainTextToken'],
                'Accept' => 'application/json',
            ];

            $granted = array_keys($definition['permissions'] ?? []);

            foreach ($routes as [$method, $uri, $permissions]) {
                $response = $this->json($method, $uri, [], $headers);
                $denied = $response->getStatusCode() === 403
                    && str_contains((string) $response->json('error.message'), 'Missing required permission');

                $shouldPass = array_intersect($permissions, $granted) !== [];

                if ($denied === $shouldPass) {
                    $mismatches[] = "{$roleName} {$method} {$uri} [".implode(',', $permissions).'] expected '.($shouldPass ? 'allowed' : 'denied');
                }
            }
        }

        DB::purge('tenant');
        @unlink(database_path("tenants/{$conn}.sqlite"));

        $this->assertSame([], $mismatches, implode("\n", array_slice($mismatches, 0, 40)));
    }

    /**
     * @return array<int, array{0: string, 1: string, 2: array<int, string>}>
     */
    private function protectedRoutes(): array
    {
        $routes = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/')) {
                continue;
            }

            $permissions = [];
            foreach ($route->gatherMiddleware() as $name) {
                if (is_string($name) && str_starts_with($name, 'tenant.can:')) {
                    array_push($permissions, ...explode(',', substr($name, strlen('tenant.can:'))));
                }
            }
            if (! $permissions) {
                continue;
            }

            $uri = '/'.preg_replace('/\{[^}]+\}/', self::FAKE_ID, $route->uri());
            foreach ($route->methods() as $method) {
                if ($method !== 'HEAD') {
                    $routes[] = [$method, $uri, $permissions];
                }
            }
        }

        return $routes;
    }
}
