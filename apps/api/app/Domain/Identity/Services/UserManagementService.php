<?php

namespace App\Domain\Identity\Services;

use App\Models\GlobalIdentity;
use App\Models\ParentProfile;
use App\Models\Role;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\StaffBranch;
use App\Models\Student;
use App\Models\StudentIdentityLink;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Support\Audit\AuditLogger;
use App\Tenancy\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UserManagementService
{
    /**
     * List users with filtering, searching, and pagination.
     */
    public function listUsers(array $filters, TenantUser $requestingUser): LengthAwarePaginator
    {
        $query = TenantUser::with(['roles', 'student', 'staff.branches', 'parentProfile']);

        // Persona filter
        if (! empty($filters['persona'])) {
            $query->where('type', $filters['persona']);
        }

        // Status filter
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Role filter
        if (! empty($filters['role'])) {
            $roleName = $filters['role'];
            $query->whereHas('roles', function ($q) use ($roleName) {
                $q->where('name', $roleName);
            });
        }

        // Branch filter / Branch scoping
        $branchScope = $requestingUser->permissionScope('users.view');
        if ($branchScope === 'branch') {
            $assignedBranchIds = $requestingUser->staff?->branches()->pluck('branches.id')->toArray() ?? [];
            $query->where(function ($q) use ($assignedBranchIds) {
                // Staff in these branches
                $q->whereHas('staff.branches', function ($bq) use ($assignedBranchIds) {
                    $bq->whereIn('branches.id', $assignedBranchIds);
                })
                // Students in classes within these branches
                    ->orWhereHas('student.classes', function ($cq) use ($assignedBranchIds) {
                        $cq->whereIn('classes.branch_id', $assignedBranchIds);
                    });
            });
        } elseif (! empty($filters['branch_id'])) {
            $branchId = $filters['branch_id'];
            $query->where(function ($q) use ($branchId) {
                $q->whereHas('staff.branches', function ($bq) use ($branchId) {
                    $bq->where('branches.id', $branchId);
                })->orWhereHas('student.classes', function ($cq) use ($branchId) {
                    $cq->where('classes.branch_id', $branchId);
                });
            });
        }

        // Search by name, email, phone
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhereHas('student', function ($sq) use ($search) {
                        $sq->where('student_code', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = (int) ($filters['per_page'] ?? 15);
        $perPage = max(1, min($perPage, 100));

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /**
     * Create a new student (user + student profile + optional parent link).
     */
    public function createStudent(array $data, TenantUser $creator): Student
    {
        $this->ensureUniquePhoneAndEmail($data['email'] ?? null, $data['phone'] ?? null);

        return DB::connection('tenant')->transaction(function () use ($data, $creator) {
            $password = ! empty($data['password']) ? $data['password'] : Str::random(10);

            // 1. Create tenant user
            $user = TenantUser::create([
                'name' => $data['name'],
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'password' => $password,
                'type' => 'student',
                'status' => $data['status'] ?? 'active',
            ]);

            // 2. Assign student role
            $studentRole = Role::where('name', 'student')->first();
            if ($studentRole) {
                $user->roles()->attach($studentRole->id);
            }

            // 3. Resolve or link global identity (Master §13-14)
            $globalId = $this->resolveGlobalIdentity($data['name'], $data['phone'] ?? null, $data['email'] ?? null);

            // 4. Generate student code
            $studentCode = $data['student_code'] ?? $this->generateStudentCode();

            // 5. Create student profile
            $student = Student::create([
                'user_id' => $user->id,
                'student_code' => $studentCode,
                'grade_level' => $data['grade_level'] ?? null,
                'global_identity_id' => $globalId,
                'status' => $user->status,
            ]);

            // 6. Link global identity link record in control DB
            if ($globalId) {
                $currentTenant = TenantContext::getActiveTenant();
                if ($currentTenant) {
                    StudentIdentityLink::firstOrCreate([
                        'global_identity_id' => $globalId,
                        'tenant_id' => $currentTenant->id,
                        'tenant_student_id' => $student->id,
                    ]);
                }
            }

            // 7. Optional parent link
            if (! empty($data['parent_id'])) {
                $student->parents()->attach($data['parent_id'], [
                    'relation_type' => $data['relation_type'] ?? 'guardian',
                ]);
            } elseif (! empty($data['parent_phone'])) {
                // Look up or create parent by phone
                $parent = $this->findOrCreateParentByPhone(
                    $data['parent_name'] ?? 'ولي أمر '.$data['name'],
                    $data['parent_phone'],
                    $creator
                );
                $student->parents()->attach($parent->id, [
                    'relation_type' => $data['relation_type'] ?? 'guardian',
                ]);
            }

            // 8. Audit log
            AuditLogger::log(
                action: 'student.created',
                tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
                entityType: 'Student',
                entityId: $student->id,
                payload: [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'student_code' => $student->student_code,
                    'grade_level' => $student->grade_level,
                ],
                actorId: $creator->id,
                actorType: 'tenant_user'
            );

            return $student->load(['user', 'parents.user']);
        });
    }

    /**
     * Update an existing student.
     */
    public function updateStudent(Student $student, array $data, TenantUser $updater): Student
    {
        return DB::connection('tenant')->transaction(function () use ($student, $data, $updater) {
            $user = $student->user;

            $this->ensureUniquePhoneAndEmail(
                $data['email'] ?? null,
                $data['phone'] ?? null,
                $user->id
            );

            // Update user fields
            $userUpdates = array_filter([
                'name' => $data['name'] ?? null,
                'email' => array_key_exists('email', $data) ? $data['email'] : null,
                'phone' => array_key_exists('phone', $data) ? $data['phone'] : null,
                'status' => $data['status'] ?? null,
            ], fn ($v) => $v !== null);

            if (! empty($userUpdates)) {
                $user->update($userUpdates);
            }

            // Update student profile fields
            $studentUpdates = array_filter([
                'grade_level' => array_key_exists('grade_level', $data) ? $data['grade_level'] : null,
                'status' => $data['status'] ?? null,
            ], fn ($v) => $v !== null);

            if (! empty($studentUpdates)) {
                $student->update($studentUpdates);
            }

            AuditLogger::log(
                action: 'student.updated',
                tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
                entityType: 'Student',
                entityId: $student->id,
                payload: $data,
                actorId: $updater->id,
                actorType: 'tenant_user'
            );

            return $student->fresh(['user', 'parents']);
        });
    }

    /**
     * Suspend or activate a student.
     */
    public function setStudentStatus(Student $student, string $status, TenantUser $updater): Student
    {
        return DB::connection('tenant')->transaction(function () use ($student, $status, $updater) {
            $student->update(['status' => $status]);
            $student->user->update(['status' => $status]);

            AuditLogger::log(
                action: 'student.status_changed',
                tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
                entityType: 'Student',
                entityId: $student->id,
                payload: ['status' => $status],
                actorId: $updater->id,
                actorType: 'tenant_user'
            );

            return $student->fresh(['user', 'parents']);
        });
    }

    /**
     * Create a staff member with roles, branches, and assignments.
     */
    public function createStaff(array $data, TenantUser $creator): Staff
    {
        $this->ensureUniquePhoneAndEmail($data['email'] ?? null, $data['phone'] ?? null);

        return DB::connection('tenant')->transaction(function () use ($data, $creator) {
            $password = ! empty($data['password']) ? $data['password'] : Str::random(10);

            // 1. Create tenant user
            $user = TenantUser::create([
                'name' => $data['name'],
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'password' => $password,
                'type' => 'staff',
                'status' => $data['status'] ?? 'active',
            ]);

            // 2. Create staff profile
            $staff = Staff::create([
                'user_id' => $user->id,
                'staff_type' => $data['staff_type'] ?? 'teacher',
                'status' => $user->status,
            ]);

            // 3. Assign roles
            if (! empty($data['role_ids'])) {
                $user->roles()->sync($data['role_ids']);
            } elseif (! empty($data['roles'])) {
                $roles = Role::whereIn('name', (array) $data['roles'])->get();
                $user->roles()->sync($roles->pluck('id'));
            } else {
                // Default role by staff_type
                $defaultRole = Role::where('name', $staff->staff_type)->first()
                    ?? Role::where('name', 'teacher')->first();
                if ($defaultRole) {
                    $user->roles()->attach($defaultRole->id);
                }
            }

            // 4. Assign branches
            if (! empty($data['branch_ids'])) {
                foreach ($data['branch_ids'] as $branchId) {
                    StaffBranch::create([
                        'staff_id' => $staff->id,
                        'branch_id' => $branchId,
                    ]);
                }
            }

            // 5. Assign assignments
            if (! empty($data['assignments'])) {
                foreach ($data['assignments'] as $asgn) {
                    StaffAssignment::create([
                        'staff_id' => $staff->id,
                        'assignable_type' => $asgn['assignable_type'],
                        'assignable_id' => $asgn['assignable_id'],
                        'role_context' => $asgn['role_context'] ?? null,
                    ]);
                }
            }

            AuditLogger::log(
                action: 'staff.created',
                tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
                entityType: 'Staff',
                entityId: $staff->id,
                payload: [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'staff_type' => $staff->staff_type,
                    'roles' => $user->roles->pluck('name')->toArray(),
                ],
                actorId: $creator->id,
                actorType: 'tenant_user'
            );

            return $staff->load(['user', 'branches', 'assignments']);
        });
    }

    /**
     * Create a parent profile.
     */
    public function createParent(array $data, TenantUser $creator): ParentProfile
    {
        $this->ensureUniquePhoneAndEmail($data['email'] ?? null, $data['phone'] ?? null);

        return DB::connection('tenant')->transaction(function () use ($data, $creator) {
            $password = ! empty($data['password']) ? $data['password'] : Str::random(10);

            $user = TenantUser::create([
                'name' => $data['name'],
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'password' => $password,
                'type' => 'parent',
                'status' => $data['status'] ?? 'active',
            ]);

            $parentRole = Role::where('name', 'parent')->first();
            if ($parentRole) {
                $user->roles()->attach($parentRole->id);
            }

            $parent = ParentProfile::create([
                'user_id' => $user->id,
                'status' => $user->status,
            ]);

            if (! empty($data['children'])) {
                foreach ($data['children'] as $child) {
                    $parent->students()->attach($child['student_id'], [
                        'relation_type' => $child['relation_type'] ?? 'guardian',
                    ]);
                }
            }

            AuditLogger::log(
                action: 'parent.created',
                tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
                entityType: 'ParentProfile',
                entityId: $parent->id,
                payload: [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'phone' => $user->phone,
                ],
                actorId: $creator->id,
                actorType: 'tenant_user'
            );

            return $parent->load(['user', 'students']);
        });
    }

    /**
     * Link a child to a parent.
     */
    public function linkChild(ParentProfile $parent, string $studentId, string $relationType, TenantUser $actor): void
    {
        $parent->students()->syncWithoutDetaching([
            $studentId => ['relation_type' => $relationType],
        ]);

        AuditLogger::log(
            action: 'parent.child_linked',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'ParentProfile',
            entityId: $parent->id,
            payload: ['student_id' => $studentId, 'relation_type' => $relationType],
            actorId: $actor->id,
            actorType: 'tenant_user'
        );
    }

    /**
     * Unlink a child from a parent.
     */
    public function unlinkChild(ParentProfile $parent, string $studentId, TenantUser $actor): void
    {
        $parent->students()->detach($studentId);

        AuditLogger::log(
            action: 'parent.child_unlinked',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'ParentProfile',
            entityId: $parent->id,
            payload: ['student_id' => $studentId],
            actorId: $actor->id,
            actorType: 'tenant_user'
        );
    }

    /**
     * Reset password for any tenant user.
     */
    public function resetPassword(TenantUser $user, ?string $newPassword, TenantUser $actor): string
    {
        $password = $newPassword ?: Str::random(10);
        $user->update(['password' => $password]);

        AuditLogger::log(
            action: 'user.password_reset',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'TenantUser',
            entityId: $user->id,
            payload: ['user_id' => $user->id],
            actorId: $actor->id,
            actorType: 'tenant_user'
        );

        return $password;
    }

    /**
     * Add assignments to a staff member.
     */
    public function assignStaff(Staff $staff, array $assignments, TenantUser $actor): void
    {
        foreach ($assignments as $asgn) {
            StaffAssignment::create([
                'staff_id' => $staff->id,
                'assignable_type' => $asgn['assignable_type'],
                'assignable_id' => $asgn['assignable_id'],
                'role_context' => $asgn['role_context'] ?? null,
            ]);
        }

        AuditLogger::log(
            action: 'staff.assignments_updated',
            tenantId: TenantContext::getActiveTenant()?->id ?? 'unknown',
            entityType: 'Staff',
            entityId: $staff->id,
            payload: ['assignments_count' => count($assignments)],
            actorId: $actor->id,
            actorType: 'tenant_user'
        );
    }

    // -------------------------------------------------------------------------
    // Private Helpers
    // -------------------------------------------------------------------------

    private function ensureUniquePhoneAndEmail(?string $email, ?string $phone, ?string $excludeUserId = null): void
    {
        if ($email) {
            $query = TenantUser::where('email', $email);
            if ($excludeUserId) {
                $query->where('id', '!=', $excludeUserId);
            }
            if ($query->exists()) {
                throw ValidationException::withMessages(['email' => ['البريد الإلكتروني مسجل مسبقاً في هذه المؤسسة.']]);
            }
        }

        if ($phone) {
            $query = TenantUser::where('phone', $phone);
            if ($excludeUserId) {
                $query->where('id', '!=', $excludeUserId);
            }
            if ($query->exists()) {
                throw ValidationException::withMessages(['phone' => ['رقم الهاتف مسجل مسبقاً في هذه المؤسسة.']]);
            }
        }
    }

    private function generateStudentCode(): string
    {
        $prefix = 'STU-';
        $rand = strtoupper(Str::random(6));

        while (Student::where('student_code', $prefix.$rand)->exists()) {
            $rand = strtoupper(Str::random(6));
        }

        return $prefix.$rand;
    }

    private function resolveGlobalIdentity(string $name, ?string $phone, ?string $email): ?string
    {
        if (! $phone && ! $email) {
            return null;
        }

        $query = GlobalIdentity::query();
        if ($phone) {
            $query->where('phone', $phone);
        } elseif ($email) {
            $query->where('email', $email);
        }

        $existing = $query->first();
        if ($existing) {
            return $existing->id;
        }

        $created = GlobalIdentity::create([
            'name' => $name,
            'phone' => $phone,
            'email' => $email,
            'type' => 'student',
            'status' => 'active',
        ]);

        return $created->id;
    }

    private function findOrCreateParentByPhone(string $name, string $phone, TenantUser $creator): ParentProfile
    {
        $existingUser = TenantUser::where('phone', $phone)->first();
        if ($existingUser && $existingUser->parentProfile) {
            return $existingUser->parentProfile;
        }

        return $this->createParent([
            'name' => $name,
            'phone' => $phone,
        ], $creator);
    }
}
