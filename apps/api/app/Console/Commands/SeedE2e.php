<?php

namespace App\Console\Commands;

use App\Domain\Analytics\Services\AnalyticsCalculationService;
use App\Models\AccessCredential;
use App\Models\Assignment;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\Grade;
use App\Models\Lesson;
use App\Models\Meeting;
use App\Models\Package;
use App\Models\PackageEntitlement;
use App\Models\ParentProfile;
use App\Models\PaymentRequest;
use App\Models\PlatformRole;
use App\Models\PlatformUser;
use App\Models\Question;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Tenancy\TenantContext;
use App\Tenancy\TenantDatabaseManager;
use App\Tenancy\TenantProvisioningService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * R9-1: deterministic data for Playwright. Rebuilds one dedicated tenant from scratch, so tests
 * never depend on demo data or on each other's mutations. Refuses to run in production.
 */
class SeedE2e extends Command
{
    public const SLUG = 'e2e-academy';

    /** Created by the provisioning flow in the browser; removed here so each run can create it again. */
    public const PROVISIONED_SLUG = 'e2e-provisioned';

    public const PASSWORD = 'E2e-Test-Password-1';

    protected $signature = 'lms:seed-e2e {--json= : Write fixture ids to this file}';

    protected $description = 'Recreate the dedicated E2E tenant with known users and content (never in production)';

    public function handle(TenantProvisioningService $provisioning, TenantDatabaseManager $databases, TenantContext $context): int
    {
        if (app()->environment('production')) {
            $this->error('lms:seed-e2e cannot run in production.');

            return self::FAILURE;
        }

        foreach (Tenant::with('databaseConfig')->whereIn('slug', [self::SLUG, self::PROVISIONED_SLUG])->get() as $existing) {
            $databases->deleteDatabase($existing);
            $existing->domains()->delete();
            $existing->features()->delete();
            $existing->databaseConfig()->delete();
            $existing->delete();
        }

        $tenant = $provisioning->provision([
            'name' => 'أكاديمية الاختبار',
            'slug' => self::SLUG,
            'type' => 'school',
            'auth_mode' => 'hybrid',
            'primary_color' => null,
            'secondary_color' => null,
        ], 'system');

        $databases->configureConnection($tenant);
        $context->setTenant($tenant);

        $fixtures = $this->seedContent();
        $fixtures['tenant'] = self::SLUG;
        $fixtures['password'] = self::PASSWORD;
        $fixtures['platform_email'] = $this->seedPlatformUser();
        $fixtures['provisioned_slug'] = self::PROVISIONED_SLUG;

        if ($path = $this->option('json')) {
            file_put_contents($path, json_encode($fixtures, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        $this->info('E2E tenant ready: '.self::SLUG);

        return self::SUCCESS;
    }

    private function seedPlatformUser(): string
    {
        $email = 'e2e@platform.test';
        $user = PlatformUser::firstOrCreate(
            ['email' => $email],
            ['name' => 'مشرف الاختبار', 'password' => Hash::make(self::PASSWORD), 'status' => 'active']
        );
        $role = PlatformRole::firstOrCreate(['name' => 'super_admin'], ['label' => 'مدير المنصة العام']);
        $user->roles()->syncWithoutDetaching([$role->id]);

        return $email;
    }

    /**
     * @return array<string, mixed>
     */
    private function seedContent(): array
    {
        $owner = $this->user('owner', 'مدير الاختبار', 'staff', 'owner');
        Staff::create(['user_id' => $owner->id, 'staff_type' => 'admin', 'status' => 'active']);

        $teacher = $this->user('teacher', 'معلم الاختبار', 'staff', 'teacher');
        $teacherStaff = Staff::create(['user_id' => $teacher->id, 'staff_type' => 'teacher', 'status' => 'active']);

        $finance = $this->user('finance', 'مالية الاختبار', 'staff', 'finance');
        Staff::create(['user_id' => $finance->id, 'staff_type' => 'finance', 'status' => 'active']);

        $assistant = $this->user('assistant', 'مساعد الاختبار', 'staff', 'assistant');
        Staff::create(['user_id' => $assistant->id, 'staff_type' => 'assistant', 'status' => 'active']);

        $studentUser = $this->user('student', 'طالب الاختبار', 'student', 'student');
        $student = Student::create(['user_id' => $studentUser->id, 'student_code' => 'E2E-001', 'grade_level' => 'الثالث الثانوي', 'status' => 'active']);

        $otherUser = $this->user('student2', 'طالب بلا مقررات', 'student', 'student');
        $other = Student::create(['user_id' => $otherUser->id, 'student_code' => 'E2E-002', 'status' => 'active']);

        $parentUser = $this->user('parent', 'ولي أمر الاختبار', 'parent', 'parent');
        ParentProfile::create(['user_id' => $parentUser->id, 'status' => 'active'])
            ->students()->attach($student->id, ['relation_type' => 'father']);

        $course = Course::create(['code' => 'E2E-MATH', 'teacher_staff_id' => $teacherStaff->id, 'title' => 'رياضيات الاختبار', 'description' => 'مقرر لاختبارات النظام', 'status' => 'published', 'is_free' => true]);
        $lesson = Lesson::create(['course_id' => $course->id, 'title' => 'الدرس الأول', 'content' => 'محتوى الدرس', 'type' => 'text', 'sort_order' => 1, 'status' => 'published', 'is_free_preview' => true]);
        Enrollment::create(['student_id' => $student->id, 'course_id' => $course->id, 'status' => 'active', 'enrolled_at' => now()]);

        $class = SchoolClass::create(['code' => 'E2E-A', 'name' => 'شعبة الاختبار', 'teacher_staff_id' => $teacherStaff->id, 'course_id' => $course->id, 'status' => 'active']);
        $class->students()->attach($student->id, ['id' => (string) Str::uuid(), 'status' => 'active', 'enrolled_at' => now()]);
        $session = ClassSession::create(['class_id' => $class->id, 'title' => 'حصة الاختبار', 'starts_at' => now(), 'ends_at' => now()->addHours(2), 'status' => 'in_progress', 'attendance_mode' => 'both', 'timing_mode' => 'open']);

        $assignment = Assignment::create(['course_id' => $course->id, 'title' => 'واجب الاختبار', 'points_possible' => 100, 'due_at' => now()->addDays(3), 'status' => 'published']);
        Grade::create(['student_id' => $student->id, 'gradable_type' => 'assignment', 'gradable_id' => $assignment->id, 'score' => 90, 'max_score' => 100, 'percentage' => 90, 'is_published' => true, 'graded_at' => now()]);

        $exam = Exam::create(['course_id' => $course->id, 'title' => 'اختبار النظام', 'duration_minutes' => 30, 'total_points' => 10, 'status' => 'published', 'is_published' => true, 'max_attempts' => 3, 'show_results' => 'after_submit']);
        Question::create(['exam_id' => $exam->id, 'question_text' => 'كم يساوي ٢ + ٢؟', 'question_type' => 'multiple_choice', 'points' => 10, 'options' => ['3', '4', '5'], 'correct_answer' => '4', 'sort_order' => 1]);

        $package = Package::create(['code' => 'E2E-PKG', 'name' => 'باقة الاختبار', 'price' => 100, 'currency' => 'SAR', 'status' => 'active']);
        PackageEntitlement::create(['package_id' => $package->id, 'entitlement_key' => 'course:'.$course->id]);
        $payment = PaymentRequest::create(['student_id' => $other->id, 'package_id' => $package->id, 'amount' => 100, 'currency' => 'SAR', 'payment_method' => 'bank_transfer', 'status' => 'pending', 'submitted_at' => now()]);

        Meeting::create(['title' => 'حصة مباشرة للاختبار', 'provider' => 'manual', 'external_meeting_id' => 'abc-defg-hij', 'join_url' => 'https://meet.google.com/abc-defg-hij', 'host_url' => 'https://meet.google.com/abc-defg-hij', 'status' => 'scheduled', 'course_id' => $course->id, 'start_time' => now(), 'duration_minutes' => 60]);

        app(AnalyticsCalculationService::class)->computeAllForStudent($student);

        $issued = AccessCredential::generate($student, $owner);

        return [
            'coupon' => ['id' => $issued['credential']->id, 'code' => $issued['credential']->credential_code, 'secret' => $issued['plainTextSecret']],
            'users' => [
                'owner' => $owner->email,
                'teacher' => $teacher->email,
                'finance' => $finance->email,
                'assistant' => $assistant->email,
                'student' => $studentUser->email,
                'student2' => $otherUser->email,
                'parent' => $parentUser->email,
            ],
            'ids' => [
                'course' => $course->id,
                'lesson' => $lesson->id,
                'class' => $class->id,
                'session' => $session->id,
                'assignment' => $assignment->id,
                'exam' => $exam->id,
                'package' => $package->id,
                'student' => $student->id,
                'student2' => $other->id,
                'student_user' => $studentUser->id,
                'payment' => $payment->id,
            ],
        ];
    }

    private function user(string $key, string $name, string $type, string $role): TenantUser
    {
        $user = TenantUser::create([
            'name' => $name,
            'email' => "{$key}@e2e.test",
            'phone' => '+96650'.str_pad((string) crc32($key) % 10000000, 7, '0', STR_PAD_LEFT),
            'password' => Hash::make(self::PASSWORD),
            'type' => $type,
            'status' => 'active',
        ]);
        $user->roles()->attach(Role::where('name', $role)->firstOrFail()->id);

        return $user;
    }
}
