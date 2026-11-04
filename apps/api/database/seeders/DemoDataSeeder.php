<?php

namespace Database\Seeders;

use App\Domain\Authorization\Services\RoleSynchronizer;
use App\Models\AccessCredential;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Classroom;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\DeviceBinding;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\Grade;
use App\Models\Lesson;
use App\Models\Meeting;
use App\Models\Package;
use App\Models\ParentProfile;
use App\Models\PaymentRequest;
use App\Models\Role;
use App\Models\SchoolClass;
use App\Models\Staff;
use App\Models\StaffAssignment;
use App\Models\Student;
use App\Models\StudentAnalyticsSnapshot;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantDatabase;
use App\Models\TenantDomain;
use App\Models\TenantFeature;
use App\Models\TenantUser;
use App\Tenancy\TenantDatabaseManager;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create or get Demo Tenant
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'almustaqbal'],
            [
                'name' => 'أكاديمية المستقبل للغات والعلوم',
                'type' => 'school',
                'status' => 'active',
            ]
        );

        TenantDatabase::firstOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'connection_identifier' => 'tenant_'.$tenant->slug,
                'status' => 'ready',
            ]
        );

        TenantDomain::firstOrCreate(
            ['domain' => 'almustaqbal.localhost'],
            [
                'tenant_id' => $tenant->id,
                'active' => true,
            ]
        );

        // Enable all standard modules in tenant_features (R1-A5)
        foreach (array_keys(config('authorization.modules', [])) as $moduleKey) {
            TenantFeature::firstOrCreate(
                ['tenant_id' => $tenant->id, 'feature_key' => $moduleKey],
                ['enabled' => true]
            );
        }

        // 2. Migrate Tenant Database
        $dbManager = app(TenantDatabaseManager::class);
        $dbManager->migrateTenant($tenant);
        $dbManager->configureConnection($tenant);

        // 3. Permissions & Standard System Roles via RoleSynchronizer (R1-A3)
        $synchronizer = app(RoleSynchronizer::class);
        $synchronizer->sync();

        $ownerRole = Role::where('name', 'owner')->firstOrFail();
        $teacherRole = Role::where('name', 'teacher')->firstOrFail();
        $assistantRole = Role::where('name', 'assistant')->firstOrFail();
        $financeRole = Role::where('name', 'finance')->firstOrFail();
        $studentRole = Role::where('name', 'student')->firstOrFail();
        $parentRole = Role::where('name', 'parent')->firstOrFail();

        // 4. Create Users
        // Admin / Owner
        $adminUser = TenantUser::firstOrCreate(
            ['email' => 'admin@almustaqbal.edu'],
            [
                'name' => 'إدارة الأكاديمية',
                'phone' => '+966500000001',
                'password' => Hash::make('password123'),
                'type' => 'staff',
                'status' => 'active',
            ]
        );
        $adminUser->roles()->sync([$ownerRole->id]);
        Staff::firstOrCreate(
            ['user_id' => $adminUser->id],
            ['staff_type' => 'admin', 'status' => 'active']
        );

        // Teacher
        $teacherUser = TenantUser::firstOrCreate(
            ['email' => 'teacher@almustaqbal.edu'],
            [
                'name' => 'د. سارة عبد الله',
                'phone' => '+966500000002',
                'password' => Hash::make('password123'),
                'type' => 'staff',
                'status' => 'active',
            ]
        );
        $teacherUser->roles()->sync([$teacherRole->id]);
        $teacherStaff = Staff::firstOrCreate(
            ['user_id' => $teacherUser->id],
            ['staff_type' => 'teacher', 'status' => 'active']
        );

        // Assistant (R1-A3)
        $assistantUser = TenantUser::firstOrCreate(
            ['email' => 'assistant@almustaqbal.edu'],
            [
                'name' => 'أ. كريم محمود (مساعد تعليمي)',
                'phone' => '+966500000005',
                'password' => Hash::make('password123'),
                'type' => 'staff',
                'status' => 'active',
            ]
        );
        $assistantUser->roles()->sync([$assistantRole->id]);
        $assistantStaff = Staff::firstOrCreate(
            ['user_id' => $assistantUser->id],
            ['staff_type' => 'assistant', 'status' => 'active']
        );

        // Finance (R1-A3 / OD-7)
        $financeUser = TenantUser::firstOrCreate(
            ['email' => 'finance@almustaqbal.edu'],
            [
                'name' => 'أ. فؤاد المالي (شؤون مالية)',
                'phone' => '+966500000006',
                'password' => Hash::make('password123'),
                'type' => 'staff',
                'status' => 'active',
            ]
        );
        $financeUser->roles()->sync([$financeRole->id]);
        Staff::firstOrCreate(
            ['user_id' => $financeUser->id],
            ['staff_type' => 'finance', 'status' => 'active']
        );

        // Student
        $studentUser = TenantUser::firstOrCreate(
            ['email' => 'student@almustaqbal.edu'],
            [
                'name' => 'عمر أحمد فاروق',
                'phone' => '+966500000003',
                'password' => Hash::make('password123'),
                'type' => 'student',
                'status' => 'active',
            ]
        );
        $studentUser->roles()->sync([$studentRole->id]);
        $studentOmar = Student::firstOrCreate(
            ['user_id' => $studentUser->id],
            [
                'student_code' => 'STU-2026-001',
                'grade_level' => 'الصف الثالث الثانوي',
                'status' => 'active',
            ]
        );

        // Parent
        $parentUser = TenantUser::firstOrCreate(
            ['email' => 'parent@almustaqbal.edu'],
            [
                'name' => 'أحمد فاروق محمود',
                'phone' => '+966500000004',
                'password' => Hash::make('password123'),
                'type' => 'parent',
                'status' => 'active',
            ]
        );
        $parentUser->roles()->sync([$parentRole->id]);
        $parentProfile = ParentProfile::firstOrCreate(
            ['user_id' => $parentUser->id],
            ['status' => 'active']
        );
        $parentProfile->students()->syncWithoutDetaching([$studentOmar->id]);

        // 5. Courses & Lessons
        $course1 = Course::firstOrCreate(
            ['code' => 'MATH-201'],
            [
                'title' => 'رياضيات متقدمة - تفاضل وتكامل',
                'description' => 'شرح شامل لمنهج التفاضل والتكامل مع حل نماذج الامتحانات الوزارية والتطبيقات الفيزيائية والهندسية.',
                'status' => 'published',
            ]
        );

        Lesson::firstOrCreate(
            ['course_id' => $course1->id, 'order' => 1],
            ['title' => 'مقدمة في النهايات والاتصال وحساب المشتقة', 'status' => 'published']
        );
        Lesson::firstOrCreate(
            ['course_id' => $course1->id, 'order' => 2],
            ['title' => 'قواعد الاشتقاق الأساسية والاشتقاق الضمني', 'status' => 'published']
        );
        Lesson::firstOrCreate(
            ['course_id' => $course1->id, 'order' => 3],
            ['title' => 'تطبيقات القيم العظمى والصغرى ورسم المنحنيات', 'status' => 'published']
        );

        $course2 = Course::firstOrCreate(
            ['code' => 'PHYS-102'],
            [
                'title' => 'فيزياء عامة - كهرومغناطيسية وحركة',
                'description' => 'دراسة القوى الكهربائية والمغناطيسية، وتطبيقات الحث الكهرومغناطيسي وقوانين كيرشوف للدوائر المعقدة.',
                'status' => 'published',
            ]
        );

        Lesson::firstOrCreate(
            ['course_id' => $course2->id, 'order' => 1],
            ['title' => 'قانون كولوم والمجال الكهربائي المنتظم', 'status' => 'published']
        );
        Lesson::firstOrCreate(
            ['course_id' => $course2->id, 'order' => 2],
            ['title' => 'التيار المستمر وقوانين كيرشوف للدوائر المغلقة', 'status' => 'published']
        );

        $course3 = Course::firstOrCreate(
            ['code' => 'ARAB-301'],
            [
                'title' => 'لغة عربية - مهارات البلاغة والأدب',
                'description' => 'البيان والبديع والمعاني مع دراسة نصوص الأدب وتحليل الأساليب الجمالية.',
                'status' => 'published',
            ]
        );

        // 6. Enrollments
        Enrollment::firstOrCreate(
            ['student_id' => $studentOmar->id, 'course_id' => $course1->id],
            ['status' => 'active', 'enrolled_at' => now()]
        );
        Enrollment::firstOrCreate(
            ['student_id' => $studentOmar->id, 'course_id' => $course2->id],
            ['status' => 'active', 'enrolled_at' => now()]
        );
        Enrollment::firstOrCreate(
            ['student_id' => $studentOmar->id, 'course_id' => $course3->id],
            ['status' => 'active', 'enrolled_at' => now()]
        );

        // 7. Classroom & Class Sessions & Attendance
        $branch = Branch::firstOrCreate(
            ['code' => 'MAIN-RYD'],
            ['name' => 'الفرع الرئيسي - الرياض', 'status' => 'active']
        );

        $classroom = Classroom::firstOrCreate(
            ['branch_id' => $branch->id, 'name' => 'قاعة الخوارزمي 101'],
            ['capacity' => 45, 'status' => 'active']
        );

        $schoolClass = SchoolClass::firstOrCreate(
            ['code' => 'MATH-SEC-A'],
            [
                'name' => 'شعبة الرياضيات المتقدمة A',
                'branch_id' => $branch->id,
                'classroom_id' => $classroom->id,
                'teacher_staff_id' => $teacherStaff->id,
                'status' => 'active',
            ]
        );

        // Assign assistant to this demo class (R1-A3 / R1-A4)
        StaffAssignment::firstOrCreate(
            [
                'staff_id' => $assistantStaff->id,
                'assignable_type' => 'class',
                'assignable_id' => $schoolClass->id,
            ],
            [
                'role_context' => 'assistant',
            ]
        );

        $session1 = ClassSession::firstOrCreate(
            ['class_id' => $schoolClass->id, 'title' => 'المحاضرة 1: مراجعة النهايات والدوال المثلثية'],
            [
                'classroom_id' => $classroom->id,
                'starts_at' => now()->subDays(3)->setTime(10, 0),
                'ends_at' => now()->subDays(3)->setTime(12, 0),
                'status' => 'completed',
            ]
        );

        AttendanceRecord::firstOrCreate(
            ['session_id' => $session1->id, 'student_id' => $studentOmar->id],
            [
                'recorded_by_user_id' => $teacherUser->id,
                'status' => 'present',
                'attendance_mode' => 'qr_scan',
                'recorded_at' => now()->subDays(3)->setTime(10, 5),
            ]
        );

        $session2 = ClassSession::firstOrCreate(
            ['class_id' => $schoolClass->id, 'title' => 'المحاضرة 2: تطبيقات الاشتقاق في الفيزياء'],
            [
                'classroom_id' => $classroom->id,
                'starts_at' => now()->subDay()->setTime(10, 0),
                'ends_at' => now()->subDay()->setTime(12, 0),
                'status' => 'completed',
            ]
        );

        AttendanceRecord::firstOrCreate(
            ['session_id' => $session2->id, 'student_id' => $studentOmar->id],
            [
                'recorded_by_user_id' => $teacherUser->id,
                'status' => 'present',
                'attendance_mode' => 'qr_scan',
                'recorded_at' => now()->subDay()->setTime(10, 3),
            ]
        );

        // 8. Assignments & Submissions & Grades
        $assignment1 = Assignment::firstOrCreate(
            ['course_id' => $course1->id, 'title' => 'واجب التفاضل: مسائل القيم القصوى والمعدلات الزمنية'],
            [
                'max_score' => 100,
                'due_at' => now()->addDays(4),
                'status' => 'published',
            ]
        );

        $sub1 = AssignmentSubmission::firstOrCreate(
            ['assignment_id' => $assignment1->id, 'student_id' => $studentOmar->id],
            [
                'submitted_at' => now()->subHours(8),
                'status' => 'submitted',
                'content' => 'تم إرفاق إجابات الأسئلة من 1 إلى 15 كاملة مع خطوات الحل والرسومات البيانية.',
            ]
        );

        Grade::firstOrCreate(
            ['student_id' => $studentOmar->id, 'gradable_type' => Assignment::class, 'gradable_id' => $assignment1->id],
            [
                'score' => 96.00,
                'max_score' => 100.00,
                'percentage' => 96.00,
                'is_published' => true,
                'graded_at' => now()->subHours(2),
            ]
        );

        $assignment2 = Assignment::firstOrCreate(
            ['course_id' => $course2->id, 'title' => 'مشروع الدوائر الكهربائية وقوانين كيرشوف'],
            [
                'max_score' => 50,
                'due_at' => now()->addDays(7),
                'status' => 'published',
            ]
        );

        // 9. Exams
        Exam::firstOrCreate(
            ['course_id' => $course1->id, 'title' => 'اختبار منتصف الفصل الدراسي - تفاضل وتكامل'],
            [
                'duration_minutes' => 60,
                'passing_score' => 60.00,
                'status' => 'published',
            ]
        );

        // 10. Live Meetings
        Meeting::firstOrCreate(
            ['title' => 'جلسة المراجعة المباشرة للامتحان النصفي'],
            [
                'provider' => 'mock',
                'external_meeting_id' => 'meet-live-2026-01',
                'join_url' => 'https://meet.google.com/lms-math-review',
                'duration_minutes' => 90,
                'starts_at' => now()->addDays(1)->setTime(18, 0),
                'status' => 'scheduled',
            ]
        );

        // 11. Billing & Entitlements
        $package = Package::firstOrCreate(
            ['code' => 'ANNUAL-2026'],
            [
                'name' => 'الباقة السنوية الأكاديمية الشاملة',
                'price' => 1500.00,
                'currency' => 'SAR',
                'status' => 'active',
            ]
        );

        $payment = PaymentRequest::firstOrCreate(
            ['student_id' => $studentOmar->id, 'package_id' => $package->id],
            [
                'amount' => 1500.00,
                'currency' => 'SAR',
                'payment_method' => 'bank_transfer',
                'status' => 'approved',
                'reviewed_at' => now()->subMonth(),
                'reviewed_by_user_id' => $adminUser->id,
            ]
        );

        Subscription::firstOrCreate(
            ['student_id' => $studentOmar->id, 'package_id' => $package->id],
            [
                'payment_request_id' => $payment->id,
                'starts_at' => now()->subMonth(),
                'ends_at' => now()->addMonths(11),
                'status' => 'active',
            ]
        );

        // 12. Access Credentials & Device Binding
        $cred = AccessCredential::firstOrCreate(
            ['student_id' => $studentOmar->id, 'credential_code' => 'CRD-OMAR-2026'],
            [
                'secret_hash' => hash('sha256', '123456'),
                'status' => 'active',
                'created_by_user_id' => $teacherUser->id,
                'issued_at' => now()->subMonth(),
            ]
        );

        DeviceBinding::firstOrCreate(
            ['credential_id' => $cred->id, 'device_id' => 'ipad-pro-omar-01'],
            [
                'device_name' => 'Omar iPad Pro 12.9',
                'device_fingerprint' => hash('sha256', 'ipad-hardware-guid-001'),
                'is_active' => true,
            ]
        );

        // 13. Student Analytics Snapshot
        StudentAnalyticsSnapshot::updateOrCreate(
            ['student_id' => $studentOmar->id],
            [
                'attendance_rate' => 98.50,
                'assignment_completion_rate' => 100.00,
                'exam_average' => 96.00,
                'overall_score' => 97.20,
                'risk_level' => 'low',
                'computed_at' => now(),
            ]
        );
    }
}
