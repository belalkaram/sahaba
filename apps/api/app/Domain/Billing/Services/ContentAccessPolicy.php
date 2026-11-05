<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\ValueObjects\ContentAccessDecision;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Entitlement;
use App\Models\Exam;
use App\Models\Lesson;
use App\Models\Meeting;
use App\Models\Package;
use App\Models\PackageEntitlement;
use App\Models\TenantUser;

class ContentAccessPolicy
{
    /**
     * Check if user can access a specific course.
     */
    public function canAccessCourse(?TenantUser $user, Course $course): ContentAccessDecision
    {
        if ($user === null) {
            return ContentAccessDecision::deny('unauthenticated');
        }

        // 1. Staff bypass (teacher, admin, supervisor with staff profile or courses.update)
        if (($user->staff || $user->type === 'staff') && ($user->hasPermissionTo('courses.view') || $user->hasPermissionTo('courses.update'))) {
            return ContentAccessDecision::allow();
        }

        if ($user->staff && $course->teacher_staff_id && $user->staff->id === $course->teacher_staff_id) {
            return ContentAccessDecision::allow();
        }

        // 2. Student check
        if (! $user->student) {
            return ContentAccessDecision::deny('forbidden');
        }

        // Draft courses not visible to students
        if ($course->status !== 'published') {
            return ContentAccessDecision::deny('draft');
        }

        // Free courses require active enrollment only
        if ($course->is_free) {
            $enrollment = Enrollment::where('student_id', $user->student->id)
                ->where('course_id', $course->id)
                ->where('status', 'active')
                ->first();

            if (! $enrollment) {
                return ContentAccessDecision::deny('not_enrolled', $this->getPackageIdsForCourse($course));
            }

            if ($enrollment->mode === 'offline') {
                return ContentAccessDecision::deny('offline_mode_restricted');
            }

            return ContentAccessDecision::allow();
        }

        $packageIds = $this->getPackageIdsForCourse($course);

        // Check active enrollment
        $enrollment = Enrollment::where('student_id', $user->student->id)
            ->where('course_id', $course->id)
            ->where('status', 'active')
            ->first();

        if (! $enrollment) {
            return ContentAccessDecision::deny('not_enrolled', $packageIds);
        }

        if ($enrollment->mode === 'offline') {
            return ContentAccessDecision::deny('offline_mode_restricted');
        }

        // Check active entitlement covering this course
        return $this->evaluateEntitlement($user->student->id, $course, $packageIds);
    }

    /**
     * Check if user can access a specific lesson.
     */
    public function canAccessLesson(?TenantUser $user, Lesson $lesson): ContentAccessDecision
    {
        // 1. Free preview lessons are accessible even without subscription
        if ($lesson->is_free_preview) {
            return ContentAccessDecision::allow();
        }

        if ($user === null) {
            return ContentAccessDecision::deny('unauthenticated');
        }

        // 2. Staff bypass
        if (($user->staff || $user->type === 'staff') && ($user->hasPermissionTo('courses.view') || $user->hasPermissionTo('courses.update'))) {
            return ContentAccessDecision::allow();
        }

        $course = $lesson->course ?? Course::find($lesson->course_id);
        if (! $course) {
            return ContentAccessDecision::deny('not_found');
        }

        return $this->canAccessCourse($user, $course);
    }

    /**
     * Check if user can attempt an exam.
     */
    public function canAttemptExam(?TenantUser $user, Exam $exam): ContentAccessDecision
    {
        if ($user === null) {
            return ContentAccessDecision::deny('unauthenticated');
        }

        if (($user->staff || $user->type === 'staff') && ($user->hasPermissionTo('exams.view') || $user->hasPermissionTo('exams.grade'))) {
            return ContentAccessDecision::allow();
        }

        $course = $exam->course ?? ($exam->course_id ? Course::find($exam->course_id) : null);
        if ($course) {
            $courseDecision = $this->canAccessCourse($user, $course);
            if (! $courseDecision->isAllowed()) {
                return $courseDecision;
            }
        }

        // If exam requires EXAM_ACCESS entitlement specifically
        if ($user->student) {
            $examEntitlement = Entitlement::where('student_id', $user->student->id)
                ->whereIn('entitlement_key', ['EXAM_ACCESS', 'all_courses'])
                ->get();

            if ($examEntitlement->isNotEmpty() && $examEntitlement->every(fn ($e) => ! $e->isValid())) {
                return ContentAccessDecision::deny('expired');
            }
        }

        return ContentAccessDecision::allow();
    }

    /**
     * Check if user can join a live meeting.
     */
    public function canJoinMeeting(?TenantUser $user, Meeting $meeting): ContentAccessDecision
    {
        if ($user === null) {
            return ContentAccessDecision::deny('unauthenticated');
        }

        if (($user->staff || $user->type === 'staff') && ($user->hasPermissionTo('meetings.view') || $user->hasPermissionTo('meetings.manage'))) {
            return ContentAccessDecision::allow();
        }

        $course = $meeting->course ?? ($meeting->course_id ? Course::find($meeting->course_id) : null);
        if ($course) {
            return $this->canAccessCourse($user, $course);
        }

        return ContentAccessDecision::allow();
    }

    /**
     * Evaluate entitlement keys for a student against a course.
     */
    protected function evaluateEntitlement(string $studentId, Course $course, array $packageIds): ContentAccessDecision
    {
        $keys = [
            'course:'.$course->id,
            'all_courses',
            'ONLINE_ACCESS',
        ];

        $entitlements = Entitlement::where('student_id', $studentId)
            ->whereIn('entitlement_key', $keys)
            ->get();

        if ($entitlements->isEmpty()) {
            return ContentAccessDecision::deny('no_entitlement', $packageIds);
        }

        $hasValid = $entitlements->contains(fn (Entitlement $e) => $e->isValid());

        if ($hasValid) {
            return ContentAccessDecision::allow();
        }

        return ContentAccessDecision::deny('expired', $packageIds);
    }

    /**
     * Find packages that unlock this course.
     *
     * @return string[]
     */
    public function getPackageIdsForCourse(Course $course): array
    {
        $keys = [
            'course:'.$course->id,
            'all_courses',
            'ONLINE_ACCESS',
        ];

        $packageIds = PackageEntitlement::whereIn('entitlement_key', $keys)
            ->pluck('package_id')
            ->unique()
            ->values()
            ->all();

        if (empty($packageIds)) {
            // Default to all active packages if none explicitly bound
            return Package::where('status', 'active')->pluck('id')->values()->all();
        }

        return $packageIds;
    }
}
