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
     * Per-instance (= per-request) lookups. Listing N courses used to cost 4 queries per course; the lookups below are
     * loaded once by preloadForCourses() and the decisions are memoised, so a list costs a constant number of queries.
     * Everything falls back to the original per-course queries when nothing was preloaded.
     */
    /** @var array<string, ContentAccessDecision> */
    private array $decisions = [];

    /** @var array<string, Enrollment|null> studentId|courseId => active enrollment */
    private array $enrollments = [];

    /** @var array<string, \Illuminate\Support\Collection<int, Entitlement>> studentId => entitlements (relevant keys) */
    private array $entitlements = [];

    /** @var \Illuminate\Support\Collection<int, PackageEntitlement>|null */
    private ?\Illuminate\Support\Collection $packageEntitlements = null;

    /** @var string[]|null */
    private ?array $activePackageIds = null;

    /**
     * Load everything canAccessCourse() needs for these courses in a constant number of queries.
     *
     * @param  iterable<Course>  $courses
     */
    public function preloadForCourses(?TenantUser $user, iterable $courses): void
    {
        $courses = collect($courses);
        if ($courses->isEmpty() || ! $user?->student) {
            return;
        }

        $studentId = $user->student->id;
        $courseIds = $courses->pluck('id')->all();
        $keys = array_merge(['all_courses', 'ONLINE_ACCESS'], array_map(fn ($id) => 'course:'.$id, $courseIds));

        $active = Enrollment::where('student_id', $studentId)->where('status', 'active')->whereIn('course_id', $courseIds)->get();
        foreach ($courseIds as $id) {
            $this->enrollments[$studentId.'|'.$id] = $active->firstWhere('course_id', $id);
        }

        $this->entitlements[$studentId] = Entitlement::where('student_id', $studentId)->whereIn('entitlement_key', $keys)->get();
        $this->packageEntitlements = PackageEntitlement::whereIn('entitlement_key', $keys)->get(['entitlement_key', 'package_id']);
    }

    /** Drop preloaded state (use when the same instance outlives a data change). */
    public function flush(): void
    {
        $this->decisions = $this->enrollments = $this->entitlements = [];
        $this->packageEntitlements = $this->activePackageIds = null;
    }

    /**
     * Check if user can access a specific course.
     */
    public function canAccessCourse(?TenantUser $user, Course $course): ContentAccessDecision
    {
        if ($user === null) {
            return ContentAccessDecision::deny('unauthenticated');
        }

        $memo = $user->id.'|'.$course->id;

        return $this->decisions[$memo] ??= $this->decideCourseAccess($user, $course);
    }

    private function decideCourseAccess(TenantUser $user, Course $course): ContentAccessDecision
    {

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
            $enrollment = $this->activeEnrollment($user->student->id, $course->id);

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
        $enrollment = $this->activeEnrollment($user->student->id, $course->id);

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

        $entitlements = isset($this->entitlements[$studentId])
            ? $this->entitlements[$studentId]->whereIn('entitlement_key', $keys)->values()
            : Entitlement::where('student_id', $studentId)->whereIn('entitlement_key', $keys)->get();

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

        $packageIds = ($this->packageEntitlements !== null
            ? $this->packageEntitlements->whereIn('entitlement_key', $keys)->pluck('package_id')
            : PackageEntitlement::whereIn('entitlement_key', $keys)->pluck('package_id'))
            ->unique()
            ->values()
            ->all();

        if (empty($packageIds)) {
            // Default to all active packages if none explicitly bound
            return $this->activePackageIds ??= Package::where('status', 'active')->pluck('id')->values()->all();
        }

        return $packageIds;
    }

    private function activeEnrollment(string $studentId, string $courseId): ?Enrollment
    {
        $key = $studentId.'|'.$courseId;
        if (array_key_exists($key, $this->enrollments)) {
            return $this->enrollments[$key];
        }

        return Enrollment::where('student_id', $studentId)->where('course_id', $courseId)->where('status', 'active')->first();
    }
}
