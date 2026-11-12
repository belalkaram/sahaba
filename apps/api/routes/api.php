<?php

use App\Http\Controllers\Api\AcademicSettingsController;
use App\Http\Controllers\Api\Analytics\AnalyticsInsightsController;
use App\Http\Controllers\Api\Analytics\DashboardController;
use App\Http\Controllers\Api\Analytics\MetricController;
use App\Http\Controllers\Api\Assessment\AssessmentOverviewController;
use App\Http\Controllers\Api\Assessment\AssignmentController;
use App\Http\Controllers\Api\Assessment\AssignmentQuestionController;
use App\Http\Controllers\Api\Assessment\ExamController;
use App\Http\Controllers\Api\Assessment\ModelAnswerController;
use App\Http\Controllers\Api\Assessment\QuestionMediaController;
use App\Http\Controllers\Api\Assessment\GradeController;
use App\Http\Controllers\Api\Assessment\GradingInboxController;
use App\Http\Controllers\Api\Assessment\QuestionBankController;
use App\Http\Controllers\Api\Attendance\AttendanceController;
use App\Http\Controllers\Api\Attendance\BranchController;
use App\Http\Controllers\Api\Attendance\ClassController;
use App\Http\Controllers\Api\Attendance\ClassroomController;
use App\Http\Controllers\Api\Attendance\OfflineAssessmentController;
use App\Http\Controllers\Api\Attendance\OfflineHomeworkCheckController;
use App\Http\Controllers\Api\Attendance\SessionController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\LogoutController;
use App\Http\Controllers\Api\Auth\MeController;
use App\Http\Controllers\Api\Auth\SupportExchangeController;
use App\Http\Controllers\Api\Authorization\RoleController;
use App\Http\Controllers\Api\Billing\EntitlementController;
use App\Http\Controllers\Api\Billing\PackageController;
use App\Http\Controllers\Api\Billing\PaymentRequestController;
use App\Http\Controllers\Api\Billing\SubscriptionController;
use App\Http\Controllers\Api\Credential\CredentialController;
use App\Http\Controllers\Api\Education\CourseController;
use App\Http\Controllers\Api\Education\CourseModuleController;
use App\Http\Controllers\Api\Education\EnrollmentController;
use App\Http\Controllers\Api\Education\LessonController;
use App\Http\Controllers\Api\Education\LessonMaterialController;
use App\Http\Controllers\Api\Education\ProfileImageController;
use App\Http\Controllers\Api\Education\StudentController;
use App\Http\Controllers\Api\Education\StudentUnifiedOverviewController;
use App\Http\Controllers\Api\Education\VideoEventController;
use App\Http\Controllers\Api\HealthCheckController;
use App\Http\Controllers\Api\Identity\ParentController;
use App\Http\Controllers\Api\Identity\StaffController;
use App\Http\Controllers\Api\Identity\StudentImportController;
use App\Http\Controllers\Api\Identity\UserController;
use App\Http\Controllers\Api\Integration\MediaController;
use App\Http\Controllers\Api\Integration\MeetingController;
use App\Http\Controllers\Api\Integration\WebhookController;
use App\Http\Controllers\Api\Me\MyResourceController;
use App\Http\Controllers\Api\Me\NotificationPreferenceController;
use App\Http\Controllers\Api\Me\MyAnnouncementController;
use App\Http\Controllers\Api\Communication\AnnouncementController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\Platform\PlatformAuthController;
use App\Http\Controllers\Api\Platform\PlatformDirectoryController;
use App\Http\Controllers\Api\Platform\PlatformPaymentController;
use App\Http\Controllers\Api\Platform\PlatformPricingController;
use App\Http\Controllers\Api\Platform\PlatformSettingsController;
use App\Http\Controllers\Api\Platform\SupportAccessController;
use App\Http\Controllers\Api\Platform\TenantController;
use App\Http\Controllers\Api\Public\ContactMessageController;
use App\Http\Controllers\Api\Identity\RegistrationRequestController;
use App\Http\Controllers\Api\Public\PublicAcademyController;
use App\Http\Controllers\Api\Public\PublicRegistrationController;
use App\Http\Controllers\Api\Public\PublicConfigController;
use App\Http\Controllers\Api\Public\PublicDirectoryController;
use App\Http\Controllers\Api\Public\SchoolRegistrationController;
use App\Http\Controllers\Api\Reporting\ReportController;
use App\Http\Controllers\Api\TenantCurrentController;
use App\Http\Controllers\Api\CapacityController;
use App\Http\Controllers\Api\Platform\PlatformCapacityController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes (v1)
|--------------------------------------------------------------------------
|
| All routes defined here are automatically assigned to the "api" middleware
| group and prefixed with "/api/v1".
|
*/

// Public platform endpoints
Route::get('/health', HealthCheckController::class)->name('api.health');
Route::post('/platform/auth/login', [PlatformAuthController::class, 'login'])
    ->middleware('throttle:auth')
    ->name('api.platform.auth.login');
Route::post('/public/register-school', [SchoolRegistrationController::class, 'register'])
    ->middleware('throttle:auth')
    ->name('api.public.register_school');
Route::get('/public/config', [PublicConfigController::class, 'show'])
    ->name('api.public.config');
Route::get('/public/directory/teachers', [PublicDirectoryController::class, 'teachers'])
    ->name('api.public.directory.teachers');
Route::get('/public/registration/options', [PublicRegistrationController::class, 'options'])
    ->name('api.public.registration.options');
Route::get('/public/registration/academies', [PublicRegistrationController::class, 'directory'])
    ->middleware('throttle:60,1')
    ->name('api.public.registration.academies');
Route::post('/public/registration', [PublicRegistrationController::class, 'store'])
    ->middleware('throttle:auth')
    ->name('api.public.registration.store');
Route::get('/public/registration/status', [PublicRegistrationController::class, 'status'])
    ->middleware('throttle:auth')
    ->name('api.public.registration.status');
Route::post('/public/contact', [ContactMessageController::class, 'store'])
    ->middleware('throttle:auth')
    ->name('api.public.contact');
Route::get('/public/pricing', [PlatformPricingController::class, 'publicPricing'])
    ->name('api.public.pricing');

// Platform Administration (Global endpoints) — protected by platform.auth (R0-1, R1-A9)
Route::middleware(['platform.auth'])->group(function () {
    Route::get('/platform/auth/me', [PlatformAuthController::class, 'me'])->name('api.platform.auth.me');
    Route::post('/platform/auth/logout', [PlatformAuthController::class, 'logout'])->name('api.platform.auth.logout');
    Route::post('/platform/support-sessions/{id}/end', [PlatformAuthController::class, 'endSupportSession'])->name('api.platform.support_sessions.end');
    Route::get('/platform/support-sessions', [TenantController::class, 'supportSessions'])->name('api.platform.support_sessions.index');
    Route::post('/platform/support-sessions', [SupportAccessController::class, 'generateToken'])->name('api.platform.support_sessions.create');
    Route::get('/platform/metrics', [TenantController::class, 'metrics'])->name('api.platform.metrics');
    Route::post('/platform/metrics/refresh', [TenantController::class, 'refreshMetrics'])->name('api.platform.metrics.refresh');
    Route::get('/platform/settings', [PlatformSettingsController::class, 'show'])->name('api.platform.settings.show');
    Route::put('/platform/settings', [PlatformSettingsController::class, 'update'])->name('api.platform.settings.update');
    Route::get('/platform/contact-messages', [PlatformSettingsController::class, 'contactMessages'])->name('api.platform.contact_messages.index');
    Route::post('/platform/contact-messages/{id}/handled', [PlatformSettingsController::class, 'markHandled'])->whereNumber('id')->name('api.platform.contact_messages.handled');

    Route::prefix('tenants')->group(function () {
        Route::get('/', [TenantController::class, 'index'])->name('api.platform.tenants.index');
        Route::post('/', [TenantController::class, 'store'])->name('api.platform.tenants.store');
        Route::get('/{id}', [TenantController::class, 'show'])->name('api.platform.tenants.show');
        Route::put('/{id}', [TenantController::class, 'update'])->name('api.platform.tenants.update');
        Route::post('/{id}/suspend', [TenantController::class, 'suspend'])->name('api.platform.tenants.suspend');
        Route::post('/{id}/activate', [TenantController::class, 'activate'])->name('api.platform.tenants.activate');
        Route::put('/{id}/modules', [TenantController::class, 'updateModules'])->name('api.platform.tenants.update_modules');
        Route::post('/{id}/convert-to-organization', [TenantController::class, 'convertToOrganization'])->name('api.platform.tenants.convert_to_organization');

        // Support Access — returns a one-time exchange code (R0-5), not the token directly
        Route::post('/{id}/support-access', [SupportAccessController::class, 'generateToken'])->name('api.platform.tenants.support_access');
    });

    // Platform Centralized Audit Logs
    Route::get('/platform/audit-logs', [App\Http\Controllers\Api\Platform\AuditLogController::class, 'index'])->name('api.platform.audit_logs.index');

    // Platform Directory (PS-2, F-1)
    Route::get('/platform/directory/teachers', [PlatformDirectoryController::class, 'index'])->name('api.platform.directory.index');
    Route::post('/platform/directory/teachers/{id}/toggle-featured', [PlatformDirectoryController::class, 'toggleFeatured'])->whereNumber('id')->name('api.platform.directory.toggle_featured');

    // Platform Payments Review Inbox & Reports (OD-27, ADR-004)
    Route::get('/platform/payments', [PlatformPaymentController::class, 'index'])->name('api.platform.payments.index');
    Route::get('/platform/payments/reports', [PlatformPaymentController::class, 'reports'])->name('api.platform.payments.reports');
    Route::get('/platform/payments/{tenantId}/{paymentId}', [PlatformPaymentController::class, 'show'])->name('api.platform.payments.show');
    Route::get('/platform/payments/{tenantId}/{paymentId}/proof', [PlatformPaymentController::class, 'proof'])->name('api.platform.payments.proof');
    Route::post('/platform/payments/{tenantId}/{paymentId}/approve', [PlatformPaymentController::class, 'approve'])->name('api.platform.payments.approve');
    Route::post('/platform/payments/{tenantId}/{paymentId}/reject', [PlatformPaymentController::class, 'reject'])->name('api.platform.payments.reject');

    // ADR-006 (CAP-1): academy capacity, granted by the super admin only
    Route::get('/platform/capacity/requests', [PlatformCapacityController::class, 'requests'])->name('api.platform.capacity.requests');
    Route::get('/platform/capacity/requests/{id}/proof', [PlatformCapacityController::class, 'proof'])->name('api.platform.capacity.proof');
    Route::post('/platform/capacity/requests/{id}/approve', [PlatformCapacityController::class, 'approve'])->name('api.platform.capacity.approve');
    Route::post('/platform/capacity/requests/{id}/reject', [PlatformCapacityController::class, 'reject'])->name('api.platform.capacity.reject');
    Route::get('/platform/capacity/tenants', [PlatformCapacityController::class, 'tenants'])->name('api.platform.capacity.tenants');
    Route::put('/platform/capacity/tenants/{id}', [PlatformCapacityController::class, 'setQuota'])->name('api.platform.capacity.set_quota');
    Route::put('/platform/capacity/default', [PlatformCapacityController::class, 'setDefault'])->name('api.platform.capacity.default');

    // Platform Pricing Settings (OD-27)
    Route::get('/platform/pricing', [PlatformPricingController::class, 'show'])->name('api.platform.pricing.show');
    Route::put('/platform/pricing', [PlatformPricingController::class, 'update'])->name('api.platform.pricing.update');
});

// Tenant-scoped endpoints (protected by TenantResolutionMiddleware)
Route::middleware(['tenant', 'throttle:api'])->group(function () {
    Route::get('/tenant/current', TenantCurrentController::class)->name('api.tenant.current');

    // Public academy landing data (opt-in content only)
    Route::prefix('public/academy')->group(function () {
        Route::get('/logo', [PublicAcademyController::class, 'logo'])->name('api.public.academy.logo');
        Route::get('/courses', [PublicAcademyController::class, 'courses'])->name('api.public.academy.courses');
        Route::get('/courses/{id}', [PublicAcademyController::class, 'course'])->name('api.public.academy.course');
        Route::get('/courses/{id}/image', [PublicAcademyController::class, 'courseImage'])->name('api.public.academy.course_image');
        Route::get('/teachers', [PublicAcademyController::class, 'teachers'])->name('api.public.academy.teachers');
        Route::get('/teachers/{id}', [PublicAcademyController::class, 'teacher'])->name('api.public.academy.teacher');
        Route::get('/teachers/{id}/image', [PublicAcademyController::class, 'teacherImage'])->name('api.public.academy.teacher_image');
    });

    // Tenant Authentication endpoints (throttled to 10/min)
    Route::post('/auth/login', LoginController::class)
        ->middleware('throttle:auth')
        ->name('api.auth.login');

    // Support exchange: POSTing the one-time code (from platform) returns the bearer token.
    // Not behind tenant.auth — the code itself is the credential.
    Route::post('/auth/support/exchange', [SupportExchangeController::class, 'exchange'])
        ->middleware('throttle:auth')
        ->name('api.auth.support.exchange');

    Route::middleware('tenant.auth')->group(function () {
        Route::get('/auth/me', MeController::class)->name('api.auth.me');
        Route::post('/auth/logout', LogoutController::class)->name('api.auth.logout');

        // Scoped "My" Resource Endpoints (R1-A8, R3-4)
        Route::prefix('me')->group(function () {
            Route::get('/children', [MyResourceController::class, 'children'])->name('api.me.children');
            Route::get('/courses', [MyResourceController::class, 'courses'])->name('api.me.courses');
            Route::get('/classes', [MyResourceController::class, 'classes'])->name('api.me.classes');
            Route::get('/students', [MyResourceController::class, 'students'])->name('api.me.students');
            Route::get('/sessions', [MyResourceController::class, 'sessions'])->name('api.me.sessions');
            Route::get('/subscriptions', [MyResourceController::class, 'subscriptions'])->name('api.me.subscriptions');
            Route::get('/entitlements', [MyResourceController::class, 'entitlements'])->name('api.me.entitlements');
            Route::get('/progress', [VideoEventController::class, 'myProgress'])->name('api.me.progress');
            Route::get('/attendance-qr', [MyResourceController::class, 'attendanceQr'])->name('api.me.attendance_qr');
            Route::get('/attendance', [MyResourceController::class, 'attendance'])->name('api.me.attendance');
            Route::get('/notification-preferences', [NotificationPreferenceController::class, 'show'])->name('api.me.notification_preferences.show');
            Route::put('/notification-preferences', [NotificationPreferenceController::class, 'update'])->name('api.me.notification_preferences.update');
            // OD-37: announcements addressed to me (banner / modal) and receipts
            Route::get('/announcements', [MyAnnouncementController::class, 'index'])->name('api.me.announcements.index');
            Route::post('/announcements/{id}/seen', [MyAnnouncementController::class, 'seen'])->name('api.me.announcements.seen');
            Route::post('/announcements/{id}/dismiss', [MyAnnouncementController::class, 'dismiss'])->name('api.me.announcements.dismiss');
        });

        // OD-37 (ANN-1): academy announcements, notifications.send (scope tenant = anyone, own = own courses)
        Route::prefix('announcements')->middleware('tenant.can:notifications.send')->group(function () {
            Route::get('/options', [AnnouncementController::class, 'options'])->name('api.announcements.options');
            Route::post('/preview', [AnnouncementController::class, 'preview'])->name('api.announcements.preview');
            Route::get('/', [AnnouncementController::class, 'index'])->name('api.announcements.index');
            Route::post('/', [AnnouncementController::class, 'store'])->name('api.announcements.store');
            Route::get('/{id}/recipients', [AnnouncementController::class, 'recipients'])->name('api.announcements.recipients');
            Route::post('/{id}/withdraw', [AnnouncementController::class, 'withdraw'])->name('api.announcements.withdraw');
        });

        // Centralized Tenant Audit Logs — requires audit.view permission (R0-4)
        Route::get('/audit-logs', [AuditLogController::class, 'index'])
            ->middleware('tenant.can:audit.view')
            ->name('api.audit_logs.index');

        // Notifications
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index'])->name('api.notifications.index');
            Route::post('/read-all', [NotificationController::class, 'markAllAsRead'])->name('api.notifications.read_all');
            Route::post('/{id}/read', [NotificationController::class, 'markAsRead'])->name('api.notifications.read');
        });

        // Core - Roles & Permissions Management (R1-A7)
        Route::get('/permissions', [RoleController::class, 'permissions'])
            ->middleware('tenant.can:roles.view')
            ->name('api.permissions.index');

        Route::prefix('roles')->group(function () {
            Route::get('/', [RoleController::class, 'index'])
                ->middleware('tenant.can:roles.view')
                ->name('api.roles.index');
            Route::post('/', [RoleController::class, 'store'])
                ->middleware('tenant.can:roles.manage')
                ->name('api.roles.store');
            Route::get('/{id}', [RoleController::class, 'show'])
                ->middleware('tenant.can:roles.view')
                ->name('api.roles.show');
            Route::put('/{id}', [RoleController::class, 'update'])
                ->middleware('tenant.can:roles.manage')
                ->name('api.roles.update');
            Route::delete('/{id}', [RoleController::class, 'destroy'])
                ->middleware('tenant.can:roles.manage')
                ->name('api.roles.destroy');
        });

        Route::get('/users/{id}/roles', [RoleController::class, 'getUserRoles'])
            ->middleware('tenant.can:roles.view')
            ->name('api.users.roles.index');
        Route::put('/users/{id}/roles', [RoleController::class, 'updateUserRoles'])
            ->middleware('tenant.can:roles.manage')
            ->name('api.users.roles.update');
        Route::get('/users/{id}/effective-permissions', [RoleController::class, 'getUserEffectivePermissions'])
            ->middleware('tenant.can:roles.view')
            ->name('api.users.effective_permissions');

        // ADR-006 (CAP-1): seats (student = code). The academy can read and request; only the platform can grant.
        Route::get('/tenant/capacity', [CapacityController::class, 'show'])
            ->middleware('tenant.can:students.view')
            ->name('api.tenant.capacity.show');
        Route::get('/tenant/capacity-requests', [CapacityController::class, 'index'])
            ->middleware('tenant.can:tenant.settings')
            ->name('api.tenant.capacity_requests.index');
        Route::post('/tenant/capacity-requests', [CapacityController::class, 'store'])
            ->middleware(['tenant.can:tenant.settings', 'throttle:10,1'])
            ->name('api.tenant.capacity_requests.store');

        // Tenant Settings (R2-7)
        Route::put('/tenant/settings', [TenantCurrentController::class, 'update'])
            ->middleware('tenant.can:tenant.settings')
            ->name('api.tenant.settings.update');
        Route::post('/tenant/logo', [TenantCurrentController::class, 'storeLogo'])
            ->middleware('tenant.can:tenant.settings')
            ->name('api.tenant.logo.store');
        Route::delete('/tenant/logo', [TenantCurrentController::class, 'destroyLogo'])
            ->middleware('tenant.can:tenant.settings')
            ->name('api.tenant.logo.destroy');
        Route::get('/tenant/academic-settings', [AcademicSettingsController::class, 'show'])
            ->middleware('tenant.can:tenant.settings')
            ->name('api.tenant.academic_settings.show');
        Route::put('/tenant/academic-settings', [AcademicSettingsController::class, 'update'])
            ->middleware('tenant.can:tenant.settings')
            ->name('api.tenant.academic_settings.update');

        // Core - Users (R2-1)
        Route::get('/users', [UserController::class, 'index'])->name('api.users.index');
        Route::get('/users/{id}', [UserController::class, 'show'])->name('api.users.show');
        Route::post('/users/{id}/reset-password', [UserController::class, 'resetPassword'])->name('api.users.reset_password');

        // Core - Students (R2-1, R2-2)
        Route::get('/students', [StudentController::class, 'index'])->name('api.students.index');
        Route::post('/students', [StudentController::class, 'store'])->name('api.students.store');
        Route::get('/students/{id}', [StudentController::class, 'show'])->name('api.students.show');
        Route::put('/students/{id}', [StudentController::class, 'update'])->name('api.students.update');
        Route::post('/students/{id}/suspend', [StudentController::class, 'suspend'])->name('api.students.suspend');
        Route::post('/students/{id}/activate', [StudentController::class, 'activate'])->name('api.students.activate');
        Route::post('/students/import', [StudentImportController::class, 'store'])->name('api.students.import');

        // Student self-registration inbox (tenant-scope students.create)
        Route::get('/registration-requests', [RegistrationRequestController::class, 'index'])->name('api.registration_requests.index');
        Route::get('/registration-requests/pending-count', [RegistrationRequestController::class, 'pendingCount'])->name('api.registration_requests.pending_count');
        Route::post('/registration-requests/{id}/approve', [RegistrationRequestController::class, 'approve'])->name('api.registration_requests.approve');
        Route::post('/registration-requests/{id}/reject', [RegistrationRequestController::class, 'reject'])->name('api.registration_requests.reject');
        Route::get('/imports', [StudentImportController::class, 'index'])->name('api.imports.index');
        Route::get('/imports/{id}', [StudentImportController::class, 'show'])->name('api.imports.show');
        Route::get('/student/academies', StudentUnifiedOverviewController::class)->name('api.student.academies');

        // Core - Staff (R2-1)
        Route::get('/staff', [StaffController::class, 'index'])->name('api.staff.index');
        Route::post('/staff', [StaffController::class, 'store'])->name('api.staff.store');
        Route::get('/staff/{id}', [StaffController::class, 'show'])->name('api.staff.show');
        Route::post('/staff/{id}/assignments', [StaffController::class, 'assign'])->name('api.staff.assignments');
        Route::get('/staff/{id}/public-profile', [ProfileImageController::class, 'showStaffProfile'])->name('api.staff.public_profile.show');
        Route::put('/staff/{id}/public-profile', [ProfileImageController::class, 'updateStaffProfile'])->name('api.staff.public_profile.update');
        Route::post('/staff/{id}/photo', [ProfileImageController::class, 'storeStaffPhoto'])->name('api.staff.photo.store');
        Route::delete('/staff/{id}/photo', [ProfileImageController::class, 'destroyStaffPhoto'])->name('api.staff.photo.destroy');
        Route::get('/staff/{id}/photo', [ProfileImageController::class, 'showStaffPhoto'])->name('api.staff.photo.show');

        // Core - Parents (R2-1)
        Route::get('/parents', [ParentController::class, 'index'])->name('api.parents.index');
        Route::post('/parents', [ParentController::class, 'store'])->name('api.parents.store');
        Route::get('/parents/{id}', [ParentController::class, 'show'])->name('api.parents.show');
        Route::post('/parents/{id}/children', [ParentController::class, 'linkChild'])->name('api.parents.children.link');
        Route::delete('/parents/{id}/children/{studentId}', [ParentController::class, 'unlinkChild'])->name('api.parents.children.unlink');
        Route::post('/parents/{id}/whatsapp-opt-in', [ParentController::class, 'setWhatsAppOptIn'])->name('api.parents.whatsapp.optin');

        // Online Learning Module (courses, lessons, enrollments, meetings, media)
        Route::middleware(['tenant.module:online'])->group(function () {
            // Courses (R4-2)
            Route::get('/courses', [CourseController::class, 'index'])->name('api.courses.index');
            Route::post('/courses', [CourseController::class, 'store'])
                ->middleware('tenant.can:courses.create')
                ->name('api.courses.create');
            Route::get('/courses/{id}', [CourseController::class, 'show'])->name('api.courses.show');
            Route::get('/courses/{id}/outline', [CourseController::class, 'outline'])->name('api.courses.outline');
            Route::put('/courses/{id}', [CourseController::class, 'update'])
                ->middleware('tenant.can:courses.update')
                ->name('api.courses.update');
            Route::post('/courses/{id}/cover', [ProfileImageController::class, 'storeCourseCover'])->name('api.courses.cover.store');
            Route::delete('/courses/{id}/cover', [ProfileImageController::class, 'destroyCourseCover'])->name('api.courses.cover.destroy');
            Route::get('/courses/{id}/cover', [ProfileImageController::class, 'showCourseCover'])->name('api.courses.cover.show');
            Route::post('/courses/{id}/publish', [CourseController::class, 'publish'])
                ->middleware('tenant.can:courses.publish')
                ->name('api.courses.publish');
            Route::post('/courses/{id}/unpublish', [CourseController::class, 'unpublish'])
                ->middleware('tenant.can:courses.publish')
                ->name('api.courses.unpublish');
            Route::delete('/courses/{id}', [CourseController::class, 'destroy'])
                ->middleware('tenant.can:courses.delete')
                ->name('api.courses.destroy');
            Route::get('/courses/{id}/progress', [VideoEventController::class, 'courseProgress'])
                ->middleware('tenant.can:courses.view')
                ->name('api.courses.progress');

            // Course Modules (R4-2)
            Route::get('/courses/{id}/modules', [CourseModuleController::class, 'index'])->name('api.modules.index');
            Route::post('/courses/{id}/modules', [CourseModuleController::class, 'store'])
                ->middleware('tenant.can:courses.update')
                ->name('api.modules.create');
            Route::put('/modules/{id}', [CourseModuleController::class, 'update'])
                ->middleware('tenant.can:courses.update')
                ->name('api.modules.update');
            Route::delete('/modules/{id}', [CourseModuleController::class, 'destroy'])
                ->middleware('tenant.can:courses.delete')
                ->name('api.modules.destroy');
            Route::post('/courses/{id}/modules/reorder', [CourseModuleController::class, 'reorder'])
                ->middleware('tenant.can:lessons.reorder')
                ->name('api.modules.reorder');

            // Lessons (R4-2, R4-4)
            Route::get('/courses/{courseId}/lessons', [LessonController::class, 'index'])->name('api.lessons.index');
            Route::post('/courses/{courseId}/lessons', [LessonController::class, 'store'])
                ->middleware('tenant.can:lessons.create')
                ->name('api.lessons.create');
            Route::get('/courses/{courseId}/lessons/{id}', [LessonController::class, 'show'])->name('api.lessons.show');
            Route::put('/lessons/{id}', [LessonController::class, 'update'])
                ->middleware('tenant.can:lessons.update')
                ->name('api.lessons.update');
            Route::delete('/lessons/{id}', [LessonController::class, 'destroy'])
                ->middleware('tenant.can:lessons.delete')
                ->name('api.lessons.destroy');
            Route::post('/lessons/{id}/publish', [LessonController::class, 'publish'])
                ->middleware('tenant.can:lessons.update')
                ->name('api.lessons.publish');
            Route::post('/lessons/{id}/unpublish', [LessonController::class, 'unpublish'])
                ->middleware('tenant.can:lessons.update')
                ->name('api.lessons.unpublish');
            Route::post('/modules/{id}/lessons/reorder', [LessonController::class, 'reorder'])
                ->middleware('tenant.can:lessons.reorder')
                ->name('api.lessons.reorder');
            Route::post('/lessons/{id}/complete', [LessonController::class, 'complete'])->name('api.lessons.complete');
            Route::post('/lessons/{id}/events', [VideoEventController::class, 'store'])->name('api.lessons.events');

            // Materials (R4-2)
            Route::post('/lessons/{id}/materials', [LessonMaterialController::class, 'store'])
                ->middleware('tenant.can:materials.manage')
                ->name('api.materials.create');
            Route::get('/materials/{id}/download', [LessonMaterialController::class, 'download'])
                ->name('api.materials.download');
            Route::delete('/materials/{id}', [LessonMaterialController::class, 'destroy'])
                ->middleware('tenant.can:materials.manage')
                ->name('api.materials.destroy');

            // Enrollments
            Route::post('/courses/{courseId}/enroll', [EnrollmentController::class, 'enroll'])->name('api.enrollments.enroll');
            Route::get('/courses/{courseId}/enrollments', [EnrollmentController::class, 'index'])
                ->middleware('tenant.can:enrollments.view')
                ->name('api.enrollments.index');
            Route::get('/students/{studentId}/enrollments', [EnrollmentController::class, 'studentEnrollments'])->name('api.students.enrollments');

            // Integrations & Media (Meetings & Videos)
            Route::get('/meetings', [MeetingController::class, 'index'])->middleware('tenant.can:meetings.view')->name('api.meetings.index');
            Route::post('/meetings', [MeetingController::class, 'store'])->middleware('tenant.can:meetings.create')->name('api.meetings.create');
            Route::get('/meetings/{id}', [MeetingController::class, 'show'])->middleware('tenant.can:meetings.view')->name('api.meetings.show');
            Route::get('/meetings/{id}/join', [MeetingController::class, 'joinUrl'])->middleware('tenant.can:meetings.view')->name('api.meetings.join');
            Route::post('/meetings/{id}/cancel', [MeetingController::class, 'cancel'])->middleware('tenant.can:meetings.manage')->name('api.meetings.cancel');

            Route::get('/media', [MediaController::class, 'index'])->middleware('tenant.can:media.view')->name('api.media.index');
            Route::post('/media', [MediaController::class, 'store'])->middleware('tenant.can:media.upload')->name('api.media.upload');
            Route::get('/media/{id}', [MediaController::class, 'show'])->middleware('tenant.can:media.view')->name('api.media.show');
            Route::get('/media/{id}/embed', [MediaController::class, 'embedUrl'])->middleware('tenant.can:media.view')->name('api.media.embed');
        });

        // Offline Learning Module (classes, sessions, attendance, branches, classrooms)
        Route::middleware(['tenant.module:offline'])->group(function () {
            // Branches (R2-3)
            Route::prefix('branches')->group(function () {
                Route::get('/', [BranchController::class, 'index'])->name('api.branches.index');
                Route::post('/', [BranchController::class, 'store'])->name('api.branches.store');
                Route::get('/{id}', [BranchController::class, 'show'])->name('api.branches.show');
                Route::put('/{id}', [BranchController::class, 'update'])->name('api.branches.update');
                Route::delete('/{id}', [BranchController::class, 'destroy'])->name('api.branches.destroy');
                Route::get('/{id}/classrooms', [BranchController::class, 'classrooms'])->name('api.branches.classrooms.index');
                Route::post('/{id}/classrooms', [BranchController::class, 'storeClassroom'])->name('api.branches.classrooms.store');
            });

            // Classrooms (R2-3)
            Route::prefix('classrooms')->group(function () {
                Route::get('/', [ClassroomController::class, 'index'])->name('api.classrooms.index');
                Route::get('/{id}', [ClassroomController::class, 'show'])->name('api.classrooms.show');
                Route::put('/{id}', [ClassroomController::class, 'update'])->name('api.classrooms.update');
                Route::delete('/{id}', [ClassroomController::class, 'destroy'])->name('api.classrooms.destroy');
            });

            // Classes
            Route::get('/classes', [ClassController::class, 'index'])->name('api.classes.index');
            Route::post('/classes', [ClassController::class, 'store'])
                ->middleware('tenant.can:classes.create')
                ->name('api.classes.create');
            Route::get('/classes/{id}', [ClassController::class, 'show'])->name('api.classes.show');
            Route::put('/classes/{id}', [ClassController::class, 'update'])
                ->middleware('tenant.can:classes.create')
                ->name('api.classes.update');
            Route::delete('/classes/{id}', [ClassController::class, 'destroy'])
                ->middleware('tenant.can:classes.create')
                ->name('api.classes.destroy');
            Route::post('/classes/{id}/students', [ClassController::class, 'enrollStudent'])
                ->middleware('tenant.can:classes.manage_students')
                ->name('api.classes.students.enroll');
            Route::delete('/classes/{id}/students/{studentId}', [ClassController::class, 'removeStudent'])
                ->middleware('tenant.can:classes.manage_students')
                ->name('api.classes.students.remove');

            // Sessions
            Route::get('/sessions', [SessionController::class, 'indexAll'])->name('api.sessions.index_all');
            Route::get('/sessions/{id}', [SessionController::class, 'showById'])->name('api.sessions.show_by_id');
            Route::post('/sessions/{id}/start', [SessionController::class, 'start'])
                ->middleware('tenant.can:sessions.update')
                ->name('api.sessions.start');
            Route::post('/sessions/{id}/end', [SessionController::class, 'end'])
                ->middleware('tenant.can:sessions.update')
                ->name('api.sessions.end');
            Route::post('/sessions/{id}/cancel', [SessionController::class, 'cancel'])
                ->middleware('tenant.can:sessions.update')
                ->name('api.sessions.cancel');
            Route::get('/classes/{classId}/sessions', [SessionController::class, 'index'])->name('api.sessions.index');
            Route::post('/classes/{classId}/sessions', [SessionController::class, 'store'])
                ->middleware('tenant.can:sessions.create')
                ->name('api.sessions.create');
            Route::get('/classes/{classId}/sessions/{id}', [SessionController::class, 'show'])->name('api.sessions.show');

            // Attendance - Records, Corrections & Reporting
            Route::post('/sessions/{sessionId}/attendance', [AttendanceController::class, 'record'])
                ->middleware('tenant.can:attendance.record')
                ->name('api.attendance.record');
            Route::post('/sessions/{sessionId}/attendance/scan', [AttendanceController::class, 'qrScan'])
                ->middleware('tenant.can:attendance.record')
                ->name('api.attendance.scan');
            Route::put('/attendance-records/{id}', [AttendanceController::class, 'correct'])
                ->middleware('tenant.can:attendance.correct')
                ->name('api.attendance.correct');
            Route::delete('/attendance-records/{id}', [AttendanceController::class, 'destroy'])
                ->middleware('tenant.can:attendance.record')
                ->name('api.attendance.destroy');
            Route::get('/sessions/{sessionId}/attendance/report', [AttendanceController::class, 'report'])
                ->middleware('tenant.can:attendance.view')
                ->name('api.attendance.report');

            // Offline Homework Checks (OD-32)
            Route::get('/sessions/{sessionId}/homework-checks', [OfflineHomeworkCheckController::class, 'index'])
                ->middleware('tenant.can:sessions.view')
                ->name('api.homework_checks.index');
            Route::post('/sessions/{sessionId}/homework-checks', [OfflineHomeworkCheckController::class, 'store'])
                ->middleware('tenant.can:homework_checks.record')
                ->name('api.homework_checks.store');
            Route::post('/sessions/{sessionId}/homework-checks/bulk', [OfflineHomeworkCheckController::class, 'bulk'])
                ->middleware('tenant.can:homework_checks.record')
                ->name('api.homework_checks.bulk');

            // Offline Assessments & Paper Scores (OD-32)
            Route::get('/classes/{classId}/offline-assessments', [OfflineAssessmentController::class, 'index'])
                ->middleware('tenant.can:classes.view')
                ->name('api.offline_assessments.index');
            Route::post('/classes/{classId}/offline-assessments', [OfflineAssessmentController::class, 'store'])
                ->middleware('tenant.can:offline_assessments.manage')
                ->name('api.offline_assessments.store');
            Route::get('/offline-assessments/{id}', [OfflineAssessmentController::class, 'show'])
                ->middleware('tenant.can:classes.view')
                ->name('api.offline_assessments.show');
            Route::post('/offline-assessments/{id}/scores', [OfflineAssessmentController::class, 'recordScores'])
                ->middleware('tenant.can:offline_scores.record')
                ->name('api.offline_assessments.scores');
        });

        // Assessment Module (assignments, exams, grades, question banks, grading inbox)
        Route::middleware(['tenant.module:assessment'])->group(function () {
            // Assignments (R6-4)
            Route::get('/courses/{courseId}/assignments', [AssignmentController::class, 'index'])->name('api.assignments.index');
            Route::post('/courses/{courseId}/assignments', [AssignmentController::class, 'store'])
                ->middleware('tenant.can:assignments.create')
                ->name('api.assignments.create');
            Route::get('/courses/{courseId}/assignments/{id}', [AssignmentController::class, 'show'])->name('api.assignments.show');
            Route::put('/courses/{courseId}/assignments/{id}', [AssignmentController::class, 'update'])
                ->middleware('tenant.can:assignments.create')
                ->name('api.assignments.update');
            Route::delete('/courses/{courseId}/assignments/{id}', [AssignmentController::class, 'destroy'])
                ->middleware('tenant.can:assignments.create')
                ->name('api.assignments.destroy');
            Route::get('/courses/{courseId}/assignments/{id}/submissions', [AssignmentController::class, 'submissions'])
                ->middleware('tenant.can:assignments.grade')
                ->name('api.assignments.submissions');
            Route::post('/courses/{courseId}/assignments/{id}/submit', [AssignmentController::class, 'submit'])->name('api.assignments.submit');
            Route::get('/courses/{courseId}/assignments/{id}/submissions/{submissionId}/file', [AssignmentController::class, 'downloadFile'])->name('api.assignments.download_file');
            Route::post('/courses/{courseId}/assignments/{id}/submissions/{submissionId}/grade', [AssignmentController::class, 'grade'])
                ->middleware('tenant.can:assignments.grade')
                ->name('api.assignments.grade');
            // Assignment questions (same shape as exam questions, optional image) and their grading
            Route::get('/courses/{courseId}/assignments/{id}/questions', [AssignmentQuestionController::class, 'index'])->name('api.assignments.questions.index');
            Route::post('/courses/{courseId}/assignments/{id}/questions', [AssignmentQuestionController::class, 'store'])
                ->middleware('tenant.can:assignments.create')
                ->name('api.assignments.questions.add');
            Route::put('/courses/{courseId}/assignments/{id}/questions/{questionId}', [AssignmentQuestionController::class, 'update'])
                ->middleware('tenant.can:assignments.create')
                ->name('api.assignments.questions.update');
            Route::delete('/courses/{courseId}/assignments/{id}/questions/{questionId}', [AssignmentQuestionController::class, 'destroy'])
                ->middleware('tenant.can:assignments.create')
                ->name('api.assignments.questions.delete');
            Route::get('/courses/{courseId}/assignments/{id}/submissions/{submissionId}/answers', [AssignmentQuestionController::class, 'submissionAnswers'])
                ->middleware('tenant.can:assignments.grade')
                ->name('api.assignments.submission_answers');
            Route::post('/courses/{courseId}/assignments/{id}/submissions/{submissionId}/answers/{answerId}/grade', [AssignmentQuestionController::class, 'gradeAnswer'])
                ->middleware('tenant.can:assignments.grade')
                ->name('api.assignments.grade_answer');

            // Question / model-answer images and model-answer release (exams and assignments)
            Route::post('/courses/{courseId}/{kind}/{id}/questions/{questionId}/image', [QuestionMediaController::class, 'store'])
                ->where('kind', 'exams|assignments')->name('api.questions.image.store');
            Route::delete('/courses/{courseId}/{kind}/{id}/questions/{questionId}/image', [QuestionMediaController::class, 'destroy'])
                ->where('kind', 'exams|assignments')->name('api.questions.image.destroy');
            Route::get('/courses/{courseId}/{kind}/{id}/questions/{questionId}/image', [QuestionMediaController::class, 'show'])
                ->where('kind', 'exams|assignments')->name('api.questions.image.show');
            Route::get('/courses/{courseId}/{kind}/{id}/model-answers', [ModelAnswerController::class, 'show'])
                ->where('kind', 'exams|assignments')->name('api.model_answers.show');
            Route::get('/courses/{courseId}/{kind}/{id}/model-answers/status', [ModelAnswerController::class, 'status'])
                ->where('kind', 'exams|assignments')->name('api.model_answers.status');
            Route::post('/courses/{courseId}/{kind}/{id}/model-answers/release', [ModelAnswerController::class, 'release'])
                ->where('kind', 'exams|assignments')->name('api.model_answers.release');
            Route::post('/courses/{courseId}/{kind}/{id}/model-answers/revoke', [ModelAnswerController::class, 'revoke'])
                ->where('kind', 'exams|assignments')->name('api.model_answers.revoke');
            Route::post('/courses/{courseId}/{kind}/{id}/model-answers/auto-release', [ModelAnswerController::class, 'setAutoRelease'])
                ->where('kind', 'exams|assignments')->name('api.model_answers.auto_release');

            Route::post('/courses/{courseId}/assignments/{id}/publish-grades', [AssignmentController::class, 'publishGrades'])
                ->middleware('tenant.can:assignments.grade')
                ->name('api.assignments.publish_grades');

            // Exams (R6-1, R6-2, R6-3)
            Route::get('/courses/{courseId}/exams', [ExamController::class, 'index'])->name('api.exams.index');
            Route::post('/courses/{courseId}/exams', [ExamController::class, 'store'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.create');
            Route::get('/courses/{courseId}/exams/{id}', [ExamController::class, 'show'])->name('api.exams.show');
            Route::put('/courses/{courseId}/exams/{id}', [ExamController::class, 'update'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.update');
            Route::delete('/courses/{courseId}/exams/{id}', [ExamController::class, 'destroy'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.destroy');
            Route::post('/courses/{courseId}/exams/{id}/publish', [ExamController::class, 'publish'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.publish');
            Route::post('/courses/{courseId}/exams/{id}/close', [ExamController::class, 'close'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.close');
            Route::post('/courses/{courseId}/exams/{id}/archive', [ExamController::class, 'archive'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.archive');

            // Exam Questions (R6-3)
            Route::get('/courses/{courseId}/exams/{id}/questions', [ExamController::class, 'questions'])->name('api.exams.questions.index');
            Route::post('/courses/{courseId}/exams/{id}/questions', [ExamController::class, 'addQuestion'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.questions.add');
            Route::put('/courses/{courseId}/exams/{id}/questions/{questionId}', [ExamController::class, 'updateQuestion'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.questions.update');
            Route::delete('/courses/{courseId}/exams/{id}/questions/{questionId}', [ExamController::class, 'deleteQuestion'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.questions.delete');
            Route::post('/courses/{courseId}/exams/{id}/questions/reorder', [ExamController::class, 'reorderQuestions'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.questions.reorder');
            Route::post('/courses/{courseId}/exams/{id}/questions/import-from-bank', [QuestionBankController::class, 'importToExam'])
                ->middleware('tenant.can:exams.create')
                ->name('api.exams.questions.import');

            // Exam Runner & Attempts (R6-2)
            Route::post('/courses/{courseId}/exams/{id}/start', [ExamController::class, 'start'])->name('api.exams.start');
            Route::get('/courses/{courseId}/exams/{id}/active-attempt', [ExamController::class, 'activeAttempt'])->name('api.exams.active_attempt');
            Route::post('/courses/{courseId}/exams/{id}/attempts/{attemptId}/integrity-events', [ExamController::class, 'recordIntegrityEvent'])
                ->middleware('throttle:60,1')
                ->name('api.exams.integrity_events');
            Route::post('/courses/{courseId}/exams/{id}/attempts/{attemptId}/heartbeat', [ExamController::class, 'heartbeat'])->name('api.exams.heartbeat');
            Route::get('/courses/{courseId}/exams/{id}/attempts/{attemptId}', [ExamController::class, 'getAttempt'])->name('api.exams.attempts.show');
            Route::post('/courses/{courseId}/exams/{id}/attempts/{attemptId}/answers', [ExamController::class, 'submitAnswer'])->name('api.exams.answers.submit');
            Route::post('/courses/{courseId}/exams/{id}/attempts/{attemptId}/submit', [ExamController::class, 'submit'])->name('api.exams.submit');
            Route::get('/courses/{courseId}/exams/{id}/attempts/{attemptId}/results', [ExamController::class, 'results'])->name('api.exams.attempts.results');
            Route::post('/courses/{courseId}/exams/{id}/attempts/{attemptId}/grade', [ExamController::class, 'grade'])
                ->middleware('tenant.can:exams.grade')
                ->name('api.exams.grade');
            Route::post('/courses/{courseId}/exams/{id}/publish-grades', [ExamController::class, 'publishGrades'])
                ->middleware('tenant.can:exams.grade')
                ->name('api.exams.publish_grades');

            // Question Banks (R6-3)
            Route::get('/courses/{courseId}/question-banks', [QuestionBankController::class, 'index'])->name('api.question_banks.index');
            Route::post('/courses/{courseId}/question-banks', [QuestionBankController::class, 'store'])
                ->middleware('tenant.can:exams.create')
                ->name('api.question_banks.store');
            Route::get('/courses/{courseId}/question-banks/{bankId}', [QuestionBankController::class, 'show'])->name('api.question_banks.show');
            Route::put('/courses/{courseId}/question-banks/{bankId}', [QuestionBankController::class, 'update'])
                ->middleware('tenant.can:exams.create')
                ->name('api.question_banks.update');
            Route::delete('/courses/{courseId}/question-banks/{bankId}', [QuestionBankController::class, 'destroy'])
                ->middleware('tenant.can:exams.create')
                ->name('api.question_banks.destroy');
            Route::post('/courses/{courseId}/question-banks/{bankId}/questions', [QuestionBankController::class, 'addQuestion'])
                ->middleware('tenant.can:exams.create')
                ->name('api.question_banks.questions.add');
            Route::put('/courses/{courseId}/question-banks/{bankId}/questions/{questionId}', [QuestionBankController::class, 'updateQuestion'])
                ->middleware('tenant.can:exams.create')
                ->name('api.question_banks.questions.update');
            Route::delete('/courses/{courseId}/question-banks/{bankId}/questions/{questionId}', [QuestionBankController::class, 'deleteQuestion'])
                ->middleware('tenant.can:exams.create')
                ->name('api.question_banks.questions.delete');

            // Staff list pages with participation and result counters on every row
            Route::get('/assessments/exams-overview', [AssessmentOverviewController::class, 'exams'])
                ->middleware('tenant.can:exams.view')
                ->name('api.assessments.exams_overview');
            Route::get('/assessments/assignments-overview', [AssessmentOverviewController::class, 'assignments'])
                ->middleware('tenant.can:assignments.view')
                ->name('api.assessments.assignments_overview');

            // Staff Grading Inbox (R6-5)
            Route::get('/grading/pending', [GradingInboxController::class, 'pending'])
                ->middleware('tenant.can:exams.grade')
                ->name('api.grading.pending');
            Route::post('/grading/publish-bulk', [GradingInboxController::class, 'bulkPublish'])
                ->middleware('tenant.can:exams.grade')
                ->name('api.grading.bulk_publish');

            // Grades
            Route::get('/students/{studentId}/grades', [GradeController::class, 'studentGrades'])->name('api.students.grades');
        });

        // Billing Module (packages, payment requests, subscriptions, entitlements)
        Route::middleware(['tenant.module:billing'])->group(function () {
            // Packages (R3-4)
            Route::get('/packages', [PackageController::class, 'index'])->name('api.packages.index');
            Route::post('/packages', [PackageController::class, 'store'])
                ->middleware('tenant.can:packages.create')
                ->name('api.packages.create');
            Route::get('/packages/{id}', [PackageController::class, 'show'])->name('api.packages.show');
            Route::put('/packages/{id}', [PackageController::class, 'update'])
                ->middleware('tenant.can:packages.manage')
                ->name('api.packages.update');
            Route::post('/packages/{id}/archive', [PackageController::class, 'archive'])
                ->middleware('tenant.can:packages.manage')
                ->name('api.packages.archive');

            // Payment Requests (R3-3, OD-27)
            Route::get('/billing/pricing', [PaymentRequestController::class, 'pricing'])->name('api.billing.pricing');
            Route::get('/payment-requests', [PaymentRequestController::class, 'index'])->name('api.payments.index');
            Route::post('/payment-requests', [PaymentRequestController::class, 'store'])->name('api.payments.store');
            Route::get('/payment-requests/{id}', [PaymentRequestController::class, 'show'])->name('api.payments.show');
            Route::get('/payment-requests/{id}/proof', [PaymentRequestController::class, 'proof'])->name('api.payments.proof');
            Route::post('/payment-requests/{id}/approve', [PaymentRequestController::class, 'approve'])
                ->middleware('tenant.can:payments.approve')
                ->name('api.payments.approve');
            Route::post('/payment-requests/{id}/reject', [PaymentRequestController::class, 'reject'])
                ->middleware('tenant.can:payments.reject')
                ->name('api.payments.reject');

            // Subscriptions & Entitlements (R3-4)
            Route::get('/students/{studentId}/subscriptions', [SubscriptionController::class, 'index'])->name('api.students.subscriptions');
            Route::get('/students/{studentId}/entitlements', [EntitlementController::class, 'index'])->name('api.students.entitlements');
            Route::post('/students/{studentId}/entitlements', [EntitlementController::class, 'grant'])
                ->middleware('tenant.can:entitlements.grant')
                ->name('api.students.entitlements.grant');
            Route::post('/entitlements/{id}/revoke', [EntitlementController::class, 'revoke'])
                ->middleware('tenant.can:entitlements.revoke')
                ->name('api.entitlements.revoke');
        });

        // Credentials & Devices Module
        Route::middleware(['tenant.module:credentials'])->group(function () {
            Route::get('/students/{studentId}/credentials', [CredentialController::class, 'index'])->name('api.credentials.index');
            Route::post('/credentials', [CredentialController::class, 'store'])
                ->middleware('tenant.can:credentials.create')
                ->name('api.credentials.store');
            Route::post('/credentials/{id}/activate', [CredentialController::class, 'activate'])->name('api.credentials.activate');
            Route::post('/credentials/verify', [CredentialController::class, 'verify'])
                ->middleware('throttle:auth')
                ->name('api.credentials.verify');
            Route::post('/credentials/{id}/replace-device', [CredentialController::class, 'replaceDevice'])
                ->middleware('tenant.can:credentials.manage_devices')
                ->name('api.credentials.replace_device');
            Route::post('/credentials/{id}/revoke', [CredentialController::class, 'revoke'])
                ->middleware('tenant.can:credentials.revoke')
                ->name('api.credentials.revoke');
            Route::post('/credentials/{id}/request-replacement', [CredentialController::class, 'requestReplacement'])
                ->name('api.credentials.request_replacement');
        });

        // Analytics & Reporting Module
        Route::middleware(['tenant.module:analytics'])->group(function () {
            // Metrics & Dashboards
            Route::get('/metrics', [MetricController::class, 'index'])->middleware('tenant.can:analytics.view')->name('api.metrics.index');
            Route::post('/metrics', [MetricController::class, 'store'])->middleware('tenant.can:analytics.manage')->name('api.metrics.store');
            Route::get('/metrics/{id}', [MetricController::class, 'show'])->middleware('tenant.can:analytics.view')->name('api.metrics.show');
            Route::post('/metrics/{id}/versions', [MetricController::class, 'addVersion'])->middleware('tenant.can:analytics.manage')->name('api.metrics.add_version');
            Route::get('/students/{studentId}/dashboard', [DashboardController::class, 'studentDashboard'])->name('api.students.dashboard');
            Route::post('/students/{studentId}/dashboard/refresh', [DashboardController::class, 'refresh'])
                ->middleware('tenant.can:analytics.manage')
                ->name('api.students.dashboard.refresh');

            // Reporting
            Route::get('/reports', [ReportController::class, 'index'])->name('api.reports.index');
            Route::post('/reports', [ReportController::class, 'store'])->name('api.reports.store');
            Route::get('/reports/{id}', [ReportController::class, 'show'])->name('api.reports.show');
            Route::get('/reports/{id}/download', [ReportController::class, 'download'])->name('api.reports.download');
            Route::get('/reports/{id}/file', [ReportController::class, 'file'])->name('api.reports.file');

            // Staff analytics (R8-4); scope is checked per resource in the controller
            Route::middleware('tenant.can:analytics.view')->prefix('analytics')->group(function () {
                Route::get('/at-risk', [AnalyticsInsightsController::class, 'atRisk'])->name('api.analytics.at_risk');
                Route::get('/courses/{id}', [AnalyticsInsightsController::class, 'course'])->name('api.analytics.course');
                Route::get('/classes/{id}', [AnalyticsInsightsController::class, 'schoolClass'])->name('api.analytics.class');
            });
        });
    });

    // Provider Webhooks (authenticated via webhook signature verification)
    Route::post('/integrations/webhooks/{provider}', [WebhookController::class, 'handle'])->name('api.integrations.webhook');
});
