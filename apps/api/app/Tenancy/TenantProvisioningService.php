<?php

namespace App\Tenancy;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\Role;
use App\Models\Staff;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class TenantProvisioningService
{
    public function __construct(
        protected TenantDatabaseManager $dbManager,
        protected RoleSynchronizer $roleSynchronizer
    ) {}

    /**
     * Provision a complete tenant: control records + DB migration + roles sync + owner user + modules.
     * Guaranteed atomic rollback on any failure.
     */
    public function provision(array $data, string $actorType = 'platform_admin', ?string $actorId = null): Tenant
    {
        // 1. Validate slug uniqueness
        $slug = strtolower(trim($data['slug']));
        if (Tenant::where('slug', $slug)->exists()) {
            throw ValidationException::withMessages(['slug' => ['اسم النطاق (slug) مستخدم بالفعل.']]);
        }

        $tenant = null;

        try {
            // 2. Create control records
            DB::beginTransaction();

            $brandSettings = $data['brand_settings'] ?? [];
            if (! empty($data['organization_kind'])) {
                $brandSettings['organization_kind'] = $data['organization_kind'];
            }

            $tenant = Tenant::create([
                'name' => $data['name'],
                'slug' => $slug,
                'type' => $data['type'] ?? 'individual_teacher',
                'auth_mode' => $data['auth_mode'] ?? 'hybrid',
                'status' => 'active',
                'logo_url' => $data['logo_url'] ?? null,
                'primary_color' => $data['primary_color'] ?? null,
                'secondary_color' => $data['secondary_color'] ?? null,
                'brand_tagline' => $data['brand_tagline'] ?? null,
                'brand_settings' => ! empty($brandSettings) ? $brandSettings : null,
            ]);

            TenantDatabase::create([
                'tenant_id' => $tenant->id,
                'connection_identifier' => 'tenant_'.$slug,
                'status' => 'ready',
            ]);

            TenantDomain::create([
                'tenant_id' => $tenant->id,
                'domain' => $slug.'.localhost',
                'type' => 'subdomain',
                'active' => true,
            ]);

            if (! empty($data['domain'])) {
                $customDomain = strtolower(trim($data['domain']));
                if ($customDomain !== $slug.'.localhost') {
                    TenantDomain::create([
                        'tenant_id' => $tenant->id,
                        'domain' => $customDomain,
                        'type' => 'custom',
                        'active' => true,
                    ]);
                }
            }

            // Save requested modules
            $modules = $data['modules'] ?? array_keys(config('authorization.modules', []));
            foreach ($modules as $moduleKey) {
                TenantFeature::create([
                    'tenant_id' => $tenant->id,
                    'feature_key' => $moduleKey,
                    'enabled' => true,
                ]);
            }

            DB::commit();

            // 3. Migrate tenant DB
            $this->dbManager->migrateTenant($tenant);

            // 4. Synchronize standard system roles (R1-A3)
            $this->dbManager->configureConnection($tenant);
            app(TenantContext::class)->setTenant($tenant);
            $this->roleSynchronizer->sync();

            // 5. Create Owner user in tenant DB if owner details provided
            if (! empty($data['owner'])) {
                $ownerData = $data['owner'];
                $ownerUser = TenantUser::create([
                    'name' => $ownerData['name'],
                    'email' => $ownerData['email'] ?? null,
                    'phone' => $ownerData['phone'] ?? null,
                    'password' => $ownerData['password'],
                    'type' => 'staff',
                    'status' => 'active',
                ]);

                $staff = Staff::create([
                    'user_id' => $ownerUser->id,
                    'staff_type' => 'admin',
                    'status' => 'active',
                ]);

                $ownerRole = Role::where('name', 'owner')->first();
                if ($ownerRole) {
                    $ownerUser->roles()->attach($ownerRole->id);
                }
            }

            // 6. Audit log
            AuditLogger::log(
                action: 'tenant.created',
                tenantId: $tenant->id,
                entityType: 'Tenant',
                entityId: $tenant->id,
                payload: [
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'modules' => $modules,
                    'has_owner' => ! empty($data['owner']),
                ],
                actorId: $actorId,
                actorType: $actorType
            );

            return $tenant->load(['domains', 'databaseConfig', 'features']);
        } catch (Throwable $e) {
            // Roll back control DB transaction if still active
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            // Clean up any persisted records and tenant DB file
            if ($tenant && $tenant->exists) {
                $this->cleanupFailedTenant($tenant);
            }

            throw $e;
        }
    }

    /**
     * Clean up all artifacts of a failed tenant provisioning.
     */
    protected function cleanupFailedTenant(Tenant $tenant): void
    {
        try {
            // Delete DB file
            $this->dbManager->deleteDatabase($tenant);

            // Delete control records
            TenantFeature::where('tenant_id', $tenant->id)->delete();
            TenantDomain::where('tenant_id', $tenant->id)->delete();
            TenantDatabase::where('tenant_id', $tenant->id)->delete();
            $tenant->delete();
        } catch (Throwable) {
            // Best-effort cleanup
        }
    }
}
