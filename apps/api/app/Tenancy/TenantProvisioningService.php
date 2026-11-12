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

            $type = $data['type'] ?? 'individual_teacher';
            $organizationKind = $type === 'organization'
                ? ($data['organization_kind'] ?? $data['brand_settings']['organization_kind'] ?? 'center')
                : null;

            $city = $data['city'] ?? $data['brand_settings']['city'] ?? null;
            $contactPhone = $data['contact_phone'] ?? $data['owner']['phone'] ?? null;
            $onboardingSource = $data['onboarding_source'] ?? ($actorType === 'self_registration' ? 'landing' : 'direct');

            $brandSettings = $data['brand_settings'] ?? [];
            if ($organizationKind) {
                $brandSettings['organization_kind'] = $organizationKind;
            }
            if ($city) {
                $brandSettings['city'] = $city;
            }

            $tenant = Tenant::create([
                'name' => $data['name'],
                'slug' => $slug,
                'type' => $type,
                'organization_kind' => $organizationKind,
                'city' => $city,
                'contact_phone' => $contactPhone,
                'onboarding_source' => $onboardingSource,
                'auth_mode' => $data['auth_mode'] ?? 'hybrid',
                // ADR-006: new academies start with the platform default seat quota.
                'seat_quota' => \App\Domain\Platform\Capacity\TenantCapacityService::defaultQuota(),
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

            // Save requested modules (or derived from OD-31 services)
            if (! empty($data['services']) && is_array($data['services'])) {
                $resolvedModules = config('tenant_profiles.services.core.modules', ['core', 'billing', 'analytics']);
                foreach ($data['services'] as $serviceKey) {
                    $svcModules = config("tenant_profiles.services.{$serviceKey}.modules", []);
                    $resolvedModules = array_merge($resolvedModules, $svcModules);
                }
                $enabledModules = array_values(array_unique($resolvedModules));
            } else {
                $enabledModules = $data['modules'] ?? array_keys(config('authorization.modules', []));
            }

            $allModulesToRecord = array_values(array_unique(array_merge(
                array_keys(config('authorization.modules', [])),
                $enabledModules
            )));

            foreach ($allModulesToRecord as $moduleKey) {
                TenantFeature::create([
                    'tenant_id' => $tenant->id,
                    'feature_key' => $moduleKey,
                    'enabled' => in_array($moduleKey, $enabledModules, true),
                ]);
            }

            DB::commit();

            // 3. Migrate tenant DB
            $this->dbManager->migrateTenant($tenant);

            // 4. Synchronize standard system roles for this archetype (OD-24)
            $this->dbManager->configureConnection($tenant);
            app(TenantContext::class)->setTenant($tenant);
            $allowedRoles = config("tenant_profiles.types.{$type}.roles");
            $this->roleSynchronizer->sync($allowedRoles);

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
                    'staff_type' => $type === 'individual_teacher' ? 'teacher' : 'admin',
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
                    'modules' => $enabledModules,
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
