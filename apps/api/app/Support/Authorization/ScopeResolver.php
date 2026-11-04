<?php

namespace App\Support\Authorization;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\PaymentRequest;
use App\Models\SchoolClass;
use App\Models\StaffAssignment;
use App\Models\Student;
use App\Models\TenantUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * ScopeResolver (R1-A4)
 *
 * Enforces resource-level boundary scoping (self, linked, own, assigned, branch, tenant).
 * Queries are scoped to return ONLY entities within the user's highest resolved scope.
 */
class ScopeResolver
{
    /**
     * Resolve the effective permission scope for a user on a given permission.
     */
    public static function resolveScope(TenantUser $user, string $permission): ?string
    {
        return $user->permissionScope($permission);
    }

    /**
     * Scope a Students query according to user's permission scope.
     */
    public static function scopeStudents(Builder $query, TenantUser $user, string $permission): Builder
    {
        $scope = $user->permissionScope($permission);

        if ($scope === null) {
            return $query->whereRaw('1 = 0');
        }

        return match ($scope) {
            'tenant' => $query,

            'branch' => $query->whereHas('classes.classroom', function ($q) use ($user) {
                $branchIds = $user->staff?->branches()->pluck('branches.id') ?? collect();
                $q->whereIn('branch_id', $branchIds);
            }),

            'assigned' => $query->where(function ($q) use ($user) {
                $staff = $user->staff;
                if (! $staff) {
                    $q->whereRaw('1 = 0');

                    return;
                }

                $assignedStudentIds = StaffAssignment::where('staff_id', $staff->id)
                    ->where('assignable_type', 'student')
                    ->pluck('assignable_id');

                $assignedClassIds = StaffAssignment::where('staff_id', $staff->id)
                    ->where('assignable_type', 'class')
                    ->pluck('assignable_id');

                $q->whereIn('id', $assignedStudentIds)
                    ->orWhereHas('classes', fn ($cq) => $cq->whereIn('classes.id', $assignedClassIds));
            }),

            'own' => $query->where(function ($q) use ($user) {
                $staff = $user->staff;
                if (! $staff) {
                    $q->whereRaw('1 = 0');

                    return;
                }

                $q->whereHas('classes', fn ($cq) => $cq->where('teacher_staff_id', $staff->id))
                    ->orWhereHas('enrollments.course', fn ($eq) => $eq->where('teacher_staff_id', $staff->id));
            }),

            'linked' => $query->where(function ($q) use ($user) {
                $parent = $user->parentProfile;
                if (! $parent) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $childIds = $parent->students()->pluck('students.id');
                $q->whereIn('id', $childIds);
            }),

            'self' => $query->where(function ($q) use ($user) {
                if ($user->student) {
                    $q->where('id', $user->student->id);
                } else {
                    $q->where('user_id', $user->id);
                }
            }),

            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Scope a Courses query according to user's permission scope.
     */
    public static function scopeCourses(Builder $query, TenantUser $user, string $permission): Builder
    {
        $scope = $user->permissionScope($permission);

        if ($scope === null) {
            return $query->whereRaw('1 = 0');
        }

        return match ($scope) {
            'tenant' => $query,

            'branch' => $query, // Courses are typically tenant-wide or assigned

            'assigned' => $query->where(function ($q) use ($user) {
                $staff = $user->staff;
                if (! $staff) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $assignedIds = StaffAssignment::where('staff_id', $staff->id)
                    ->where('assignable_type', 'course')
                    ->pluck('assignable_id');
                $q->whereIn('id', $assignedIds);
            }),

            'own' => $query->where(function ($q) use ($user) {
                $staff = $user->staff;
                if (! $staff) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $q->where('teacher_staff_id', $staff->id);
            }),

            'self' => $query->where(function ($q) use ($user) {
                $student = $user->student;
                if (! $student) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $enrolledCourseIds = Enrollment::where('student_id', $student->id)
                    ->where('status', 'active')
                    ->pluck('course_id');
                $q->whereIn('id', $enrolledCourseIds);
            }),

            'linked' => $query->where(function ($q) use ($user) {
                $parent = $user->parentProfile;
                if (! $parent) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $childIds = $parent->students()->pluck('students.id');
                $enrolledCourseIds = Enrollment::whereIn('student_id', $childIds)
                    ->where('status', 'active')
                    ->pluck('course_id');
                $q->whereIn('id', $enrolledCourseIds);
            }),

            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Scope a SchoolClasses query according to user's permission scope.
     */
    public static function scopeClasses(Builder $query, TenantUser $user, string $permission): Builder
    {
        $scope = $user->permissionScope($permission);

        if ($scope === null) {
            return $query->whereRaw('1 = 0');
        }

        return match ($scope) {
            'tenant' => $query,

            'branch' => $query->whereHas('classroom', function ($q) use ($user) {
                $branchIds = $user->staff?->branches()->pluck('branches.id') ?? collect();
                $q->whereIn('branch_id', $branchIds);
            }),

            'assigned' => $query->where(function ($q) use ($user) {
                $staff = $user->staff;
                if (! $staff) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $assignedIds = StaffAssignment::where('staff_id', $staff->id)
                    ->where('assignable_type', 'class')
                    ->pluck('assignable_id');
                $q->whereIn('id', $assignedIds);
            }),

            'own' => $query->where(function ($q) use ($user) {
                $staff = $user->staff;
                if (! $staff) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $q->where('teacher_staff_id', $staff->id);
            }),

            'self' => $query->whereHas('students', function ($q) use ($user) {
                $student = $user->student;
                if (! $student) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $q->where('students.id', $student->id);
            }),

            'linked' => $query->whereHas('students', function ($q) use ($user) {
                $parent = $user->parentProfile;
                if (! $parent) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $childIds = $parent->students()->pluck('students.id');
                $q->whereIn('students.id', $childIds);
            }),

            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Scope a Sessions query according to user's permission scope.
     */
    public static function scopeSessions(Builder $query, TenantUser $user, string $permission): Builder
    {
        return $query->whereIn(
            'class_id',
            self::scopeClasses(SchoolClass::query(), $user, $permission)->select('id')
        );
    }

    /**
     * Scope an AttendanceRecords query according to user's permission scope.
     */
    public static function scopeAttendanceRecords(Builder $query, TenantUser $user, string $permission): Builder
    {
        $scope = $user->permissionScope($permission);

        if ($scope === null) {
            return $query->whereRaw('1 = 0');
        }

        if ($scope === 'self' && $user->student) {
            return $query->where('student_id', $user->student->id);
        }

        if ($scope === 'linked' && $user->parentProfile) {
            $studentIds = $user->parentProfile->students()->pluck('students.id');

            return $query->whereIn('student_id', $studentIds);
        }

        return $query->whereIn(
            'session_id',
            self::scopeSessions(ClassSession::query(), $user, $permission)->select('id')
        );
    }

    /**
     * Scope a PaymentRequests query according to user's permission scope.
     */
    public static function scopePaymentRequests(Builder $query, TenantUser $user, string $permission): Builder
    {
        $scope = $user->permissionScope($permission);

        if ($scope === null) {
            return $query->whereRaw('1 = 0');
        }

        return match ($scope) {
            'tenant' => $query,

            'self' => $query->where(function ($q) use ($user) {
                $student = $user->student;
                if (! $student) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $q->where('student_id', $student->id);
            }),

            'linked' => $query->where(function ($q) use ($user) {
                $parent = $user->parentProfile;
                if (! $parent) {
                    $q->whereRaw('1 = 0');

                    return;
                }
                $childIds = $parent->students()->pluck('students.id');
                $q->whereIn('student_id', $childIds);
            }),

            default => $query->whereRaw('1 = 0'),
        };
    }

    /**
     * Check if a user can access or mutate a specific model instance.
     */
    public static function canAccess(TenantUser $user, string $permission, Model $resource): bool
    {
        $scope = $user->permissionScope($permission);

        if ($scope === null) {
            return false;
        }

        if ($scope === 'tenant') {
            return true;
        }

        if ($resource instanceof Course) {
            return match ($scope) {
                'own' => $resource->teacher_staff_id === $user->staff?->id,
                'assigned' => StaffAssignment::where('staff_id', $user->staff?->id)
                    ->where('assignable_type', 'course')
                    ->where('assignable_id', $resource->id)
                    ->exists(),
                'self' => Enrollment::where('student_id', $user->student?->id)
                    ->where('course_id', $resource->id)
                    ->where('status', 'active')
                    ->exists(),
                default => false,
            };
        }

        if ($resource instanceof SchoolClass) {
            return match ($scope) {
                'own' => $resource->teacher_staff_id === $user->staff?->id,
                'assigned' => StaffAssignment::where('staff_id', $user->staff?->id)
                    ->where('assignable_type', 'class')
                    ->where('assignable_id', $resource->id)
                    ->exists(),
                'self' => $resource->students()->where('students.id', $user->student?->id)->exists(),
                default => false,
            };
        }

        if ($resource instanceof Student) {
            return self::scopeStudents(Student::query()->whereKey($resource->id), $user, $permission)->exists();
        }

        if ($resource instanceof PaymentRequest) {
            return match ($scope) {
                'self' => $resource->student_id === $user->student?->id,
                'linked' => $user->parentProfile?->students()->where('students.id', $resource->student_id)->exists() ?? false,
                default => false,
            };
        }

        return false;
    }
}
