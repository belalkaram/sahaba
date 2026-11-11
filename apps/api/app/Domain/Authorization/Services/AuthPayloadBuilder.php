<?php

namespace App\Domain\Authorization\Services;

use App\Models\Tenant;
use App\Models\TenantToken;
use App\Models\TenantUser;

/**
 * AuthPayloadBuilder (R1-A6)
 *
 * Implements the canonical auth payload contract per `03-target-access-model.md` §7:
 *  - user (id, name, email, phone, status)
 *  - persona ('staff' | 'student' | 'parent')
 *  - profiles (student, staff with branch_ids, parent)
 *  - roles ([{ name, label }])
 *  - permissions (map of permission_name => scope)
 *  - tenant (id, slug, name, modules: active_keys, auth_mode, branding)
 *  - experience ('admin' | 'staff' | 'student' | 'parent')
 *  - support_session ({ id, expires_at } | null)
 */
class AuthPayloadBuilder
{
    /**
     * Build the canonical auth session payload for a given user, tenant, and optional token.
     *
     * @return array<string, mixed>
     */
    public static function build(
        TenantUser $user,
        Tenant $tenant,
        ?TenantToken $token = null
    ): array {
        $user->loadMissing([
            'roles.permissions',
            'student',
            'staff.branches',
            'parentProfile',
        ]);

        // 1. User
        $userData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'type' => $user->type,
            'status' => $user->status,
            'roles' => $user->roles->pluck('name')->values()->all(),
        ];

        // 2. Persona
        $persona = 'staff';
        if ($user->student) {
            $persona = 'student';
        } elseif ($user->parentProfile) {
            $persona = 'parent';
        }

        // 3. Profiles
        $profiles = [
            'student' => $user->student ? [
                'id' => $user->student->id,
                'student_code' => $user->student->student_code,
                'grade_level' => $user->student->grade_level,
            ] : null,
            'staff' => $user->staff ? [
                'id' => $user->staff->id,
                'staff_type' => $user->staff->staff_type,
                'branch_ids' => $user->staff->branches ? $user->staff->branches->pluck('id')->values()->all() : [],
            ] : null,
            'parent' => $user->parentProfile ? [
                'id' => $user->parentProfile->id,
            ] : null,
        ];

        // 4. Roles
        $roles = $user->roles->map(fn ($r) => [
            'name' => $r->name,
            'label' => $r->label ?? $r->name,
        ])->values()->all();

        // 5. Effective Permissions with Scopes
        $permissions = $user->getPermissionsWithScope();

        // 6. Tenant info & enabled modules
        $allModules = array_keys(config('authorization.modules', []));
        $activeModules = array_values(array_filter($allModules, fn ($key) => $tenant->hasFeature($key)));

        $tenantData = [
            'id' => $tenant->id,
            'slug' => $tenant->slug,
            'name' => $tenant->name,
            'type' => $tenant->type,
            'organization_kind' => $tenant->organization_kind,
            'city' => $tenant->city,
            'services' => $tenant->services(),
            'modules' => $activeModules,
            'auth_mode' => $tenant->auth_mode ?? 'hybrid',
            'branding' => [
                'logo_url' => $tenant->logo_url ?? null,
                'primary_color' => $tenant->primary_color ?? '#0C7F6D',
            ],
        ];

        // 7. Experience determination
        if ($persona === 'student') {
            $experience = 'student';
        } elseif ($persona === 'parent') {
            $experience = 'parent';
        } else {
            $hasAdminPerms = false;
            foreach ($permissions as $perm => $scope) {
                if (
                    str_starts_with($perm, 'users.') ||
                    str_starts_with($perm, 'roles.') ||
                    str_starts_with($perm, 'tenant.') ||
                    str_starts_with($perm, 'audit.')
                ) {
                    $hasAdminPerms = true;
                    break;
                }
            }

            if ($hasAdminPerms || $user->roles->contains('name', 'owner')) {
                $experience = 'admin';
            } else {
                $experience = 'staff';
            }
        }

        // 8. Support Session
        $supportSession = null;
        if ($token && $token->name === 'support_token') {
            $supportSession = [
                'id' => $token->id,
                'expires_at' => $token->expires_at?->toIso8601String(),
            ];
        }

        // Backward compatibility legacy profile
        $legacyProfile = null;
        if ($user->student) {
            $legacyProfile = [
                'type' => 'student',
                'student_code' => $user->student->student_code,
                'grade_level' => $user->student->grade_level,
                'global_identity_id' => $user->student->global_identity_id,
            ];
        } elseif ($user->staff) {
            $legacyProfile = [
                'type' => 'staff',
                'staff_type' => $user->staff->staff_type,
            ];
        } elseif ($user->parentProfile) {
            $legacyProfile = [
                'type' => 'parent',
            ];
        }

        return [
            // Target Access Model (03-target-access-model.md §7)
            'user' => $userData,
            'persona' => $persona,
            'profiles' => $profiles,
            'roles' => $roles,
            'permissions' => $permissions,
            'tenant' => $tenantData,
            'experience' => $experience,
            'support_session' => $supportSession,

            // Backward compatibility aliases
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'type' => $user->type,
            'status' => $user->status,
            'profile' => $legacyProfile,
        ];
    }
}
