<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Organization Feature Modules
    |--------------------------------------------------------------------------
    |
    | High-level feature modules that can be enabled or disabled per tenant
    | in the `tenant_features` table. Middleware `tenant.module:<key>` gates
    | access to entire route groups based on these keys.
    |
    */
    'modules' => [
        'core' => [
            'name' => 'core',
            'label' => 'النظام الأساسي والمستخدمين',
            'description' => 'إدارة المستخدمين والأدوار والإعدادات العامة للمؤسسة',
            'is_default' => true,
        ],
        'online' => [
            'name' => 'online',
            'label' => 'التعليم الإلكتروني والمحتوى',
            'description' => 'المقررات الدراسية، الدروس، مكتبة الفيديو، والتكامل مع Google Drive و Meet',
            'is_default' => true,
        ],
        'offline' => [
            'name' => 'offline',
            'label' => 'التعليم الحضوري والمراكز',
            'description' => 'إدارة الفروع، القاعات، الفصول الدراسية، ورصد الحضور والغياب ورمز QR',
            'is_default' => true,
        ],
        'assessment' => [
            'name' => 'assessment',
            'label' => 'التقييمات والامتحانات',
            'description' => 'بنك الأسئلة، الاختبارات الإلكترونية، الواجبات، ورصد الدرجات',
            'is_default' => true,
        ],
        'billing' => [
            'name' => 'billing',
            'label' => 'المالية والاشتراكات',
            'description' => 'الباقات الدراسية، مراجعة التحويلات، وتفعيل الاشتراكات والحصص',
            'is_default' => true,
        ],
        'credentials' => [
            'name' => 'credentials',
            'label' => 'أكواد الدخول وحماية الأجهزة',
            'description' => 'إصدار بطاقات الدخول الذكية وإدارة ربط أجهزة الطلبة',
            'is_default' => true,
        ],
        'analytics' => [
            'name' => 'analytics',
            'label' => 'التقارير والتحليلات',
            'description' => 'مؤشرات الأداء، التقارير الإحصائية، وتحليلات تحصيل الطلاب',
            'is_default' => true,
        ],
        'parents' => [
            'name' => 'parents',
            'label' => 'بوابة أولياء الأمور',
            'description' => 'ربط أولياء الأمور بأبنائهم ومتابعة الحضور والدرجات والمدفوعات',
            'is_default' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Canonical Permission Catalog
    |--------------------------------------------------------------------------
    |
    | The single source of truth for all permissions in the LMS.
    | Every permission checked via route middleware (`tenant.can:<name>`),
    | controller authorization (`hasPermissionTo`), or role synchronizer
    | MUST be defined here.
    |
    | Valid scopes: self, linked, own, assigned, branch, tenant.
    |
    */
    'permissions' => [

        // ── Core / Administration ──────────────────────────────────────────
        'tenant.settings' => [
            'module' => 'core',
            'label' => 'إدارة إعدادات المؤسسة',
            'scopes' => ['tenant'],
        ],
        'tenant.branding' => [
            'module' => 'core',
            'label' => 'تخصيص الهوية البصرية والعلامة التجارية',
            'scopes' => ['tenant'],
        ],
        'users.view' => [
            'module' => 'core',
            'label' => 'عرض المستخدمين',
            'scopes' => ['branch', 'tenant'],
        ],
        'users.create' => [
            'module' => 'core',
            'label' => 'إنشاء مستخدمين جدد',
            'scopes' => ['branch', 'tenant'],
        ],
        'users.update' => [
            'module' => 'core',
            'label' => 'تعديل بيانات المستخدمين',
            'scopes' => ['branch', 'tenant'],
        ],
        'users.suspend' => [
            'module' => 'core',
            'label' => 'تعليق وتنشيط حسابات المستخدمين',
            'scopes' => ['branch', 'tenant'],
        ],
        'roles.view' => [
            'module' => 'core',
            'label' => 'عرض الأدوار والصلاحيات',
            'scopes' => ['tenant'],
        ],
        'roles.manage' => [
            'module' => 'core',
            'label' => 'إدارة وتخصيص الأدوار والصلاحيات',
            'scopes' => ['tenant'],
        ],
        'audit.view' => [
            'module' => 'core',
            'label' => 'عرض سجل التدقيق الأمني',
            'scopes' => ['tenant'],
        ],
        'notifications.send' => [
            'module' => 'core',
            'label' => 'إرسال الإشعارات والتعميمات',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'students.view' => [
            'module' => 'core',
            'label' => 'عرض بيانات الطلاب',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'students.create' => [
            'module' => 'core',
            'label' => 'تسجيل وإضافة طلاب جدد',
            'scopes' => ['branch', 'tenant'],
        ],
        'students.update' => [
            'module' => 'core',
            'label' => 'تحديث ملف الطالب',
            'scopes' => ['self', 'branch', 'tenant'],
        ],
        'students.delete' => [
            'module' => 'core',
            'label' => 'حذف ملف الطالب',
            'scopes' => ['tenant'],
        ],
        'parents.manage' => [
            'module' => 'core',
            'label' => 'إدارة وربط أولياء الأمور',
            'scopes' => ['branch', 'tenant'],
        ],
        'staff.manage' => [
            'module' => 'core',
            'label' => 'إدارة الكادر التعليمي والموظفين',
            'scopes' => ['branch', 'tenant'],
        ],
        'enrollments.view' => [
            'module' => 'core',
            'label' => 'عرض التسجيلات في المقررات',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'enrollments.create' => [
            'module' => 'core',
            'label' => 'تسجيل طالب في مقرر',
            'scopes' => ['self', 'own', 'branch', 'tenant'],
        ],

        // ── Online Learning ────────────────────────────────────────────────
        'courses.view' => [
            'module' => 'online',
            'label' => 'عرض المقررات والمناهج',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'courses.create' => [
            'module' => 'online',
            'label' => 'إنشاء مقرر تعليمي جديد',
            'scopes' => ['branch', 'tenant'],
        ],
        'courses.update' => [
            'module' => 'online',
            'label' => 'تعديل بيانات ومحتوى المقرر',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'courses.delete' => [
            'module' => 'online',
            'label' => 'حذف المقرر الدراسي',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'courses.publish' => [
            'module' => 'online',
            'label' => 'نشر أو أرشفة المقرر',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'lessons.view' => [
            'module' => 'online',
            'label' => 'عرض تفاصيل ومحتوى الدرس',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'lessons.create' => [
            'module' => 'online',
            'label' => 'إضافة درس جديد للمقرر',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'lessons.update' => [
            'module' => 'online',
            'label' => 'تحديث محتوى الدرس',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'lessons.delete' => [
            'module' => 'online',
            'label' => 'حذف الدرس',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'lessons.reorder' => [
            'module' => 'online',
            'label' => 'إعادة ترتيب الدروس',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'materials.manage' => [
            'module' => 'online',
            'label' => 'إدارة المرفقات والملازم الدراسية',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'media.view' => [
            'module' => 'online',
            'label' => 'مشاهدة الوسائط ومقاطع الفيديو',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'media.upload' => [
            'module' => 'online',
            'label' => 'رفع وسائط وفيديوهات تعليمية',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'media.delete' => [
            'module' => 'online',
            'label' => 'حذف وسائط من المكتبة',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'progress.view' => [
            'module' => 'online',
            'label' => 'متابعة تقدم مشاهدة الدروس',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'meetings.view' => [
            'module' => 'online',
            'label' => 'عرض الفصول الافتراضية والاجتماعات',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'meetings.create' => [
            'module' => 'online',
            'label' => 'جدولة حصة افتراضية (Google Meet)',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'meetings.manage' => [
            'module' => 'online',
            'label' => 'إدارة وبدء وإلغاء الحصص الافتراضية',
            'scopes' => ['own', 'branch', 'tenant'],
        ],

        // ── Offline / Centered ─────────────────────────────────────────────
        'branches.manage' => [
            'module' => 'offline',
            'label' => 'إدارة فروع المؤسسة ومواقعها',
            'scopes' => ['tenant'],
        ],
        'classrooms.manage' => [
            'module' => 'offline',
            'label' => 'إدارة القاعات الدراسية وسعتها',
            'scopes' => ['branch', 'tenant'],
        ],
        'classes.view' => [
            'module' => 'offline',
            'label' => 'عرض المجموعات والفصول الدراسية',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'classes.create' => [
            'module' => 'offline',
            'label' => 'إنشاء فصل دراسي حضوري',
            'scopes' => ['branch', 'tenant'],
        ],
        'classes.update' => [
            'module' => 'offline',
            'label' => 'تعديل جدول وبيانات الفصل',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'classes.manage_students' => [
            'module' => 'offline',
            'label' => 'تسكين ونقل الطلاب بين الفصول',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'sessions.view' => [
            'module' => 'offline',
            'label' => 'عرض الحصص والجلسات الدراسية',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'sessions.create' => [
            'module' => 'offline',
            'label' => 'إنشاء وجدولة حصة حضورية',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'sessions.update' => [
            'module' => 'offline',
            'label' => 'تعديل موعد أو تفاصيل الحصة',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'attendance.view' => [
            'module' => 'offline',
            'label' => 'عرض سجلات وتقارير الحضور والغياب',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'attendance.record' => [
            'module' => 'offline',
            'label' => 'رصد الحضور والغياب للحصة',
            'scopes' => ['own', 'assigned', 'branch', 'tenant'],
        ],
        'attendance.correct' => [
            'module' => 'offline',
            'label' => 'تصحيح وتعديل حالات الحضور السابقة',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'attendance.scan' => [
            'module' => 'offline',
            'label' => 'مسح بطاقات QR للتحضير السريع',
            'scopes' => ['own', 'assigned', 'branch', 'tenant'],
        ],

        // ── Assessment ─────────────────────────────────────────────────────
        'assignments.view' => [
            'module' => 'assessment',
            'label' => 'عرض الواجبات والمهام المطلوبة',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'assignments.create' => [
            'module' => 'assessment',
            'label' => 'إنشاء وتكليف الطلاب بواجب جديد',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'assignments.update' => [
            'module' => 'assessment',
            'label' => 'تعديل الواجب وموعد تسليمه',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'assignments.grade' => [
            'module' => 'assessment',
            'label' => 'تصحيح تسليمات الطلاب ورصد درجات الواجب',
            'scopes' => ['own', 'assigned', 'branch', 'tenant'],
        ],
        'assignments.publish' => [
            'module' => 'assessment',
            'label' => 'نشر درجات وملاحظات الواجب للطلاب',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'exams.view' => [
            'module' => 'assessment',
            'label' => 'عرض جدول وتفاصيل الاختبارات',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],
        'exams.create' => [
            'module' => 'assessment',
            'label' => 'بناء اختبار إلكتروني وبنك أسئلة',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'exams.update' => [
            'module' => 'assessment',
            'label' => 'تعديل أسئلة وتوقيت الاختبار',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'exams.grade' => [
            'module' => 'assessment',
            'label' => 'تصحيح الأسئلة المقالية ورصد النتائج',
            'scopes' => ['own', 'assigned', 'branch', 'tenant'],
        ],
        'exams.publish' => [
            'module' => 'assessment',
            'label' => 'نشر نتائج الاختبار لجميع الطلبة',
            'scopes' => ['own', 'branch', 'tenant'],
        ],
        'grades.view' => [
            'module' => 'assessment',
            'label' => 'عرض كشوف وشهادات الدرجات',
            'scopes' => ['self', 'linked', 'own', 'assigned', 'branch', 'tenant'],
        ],

        // ── Billing ────────────────────────────────────────────────────────
        'packages.view' => [
            'module' => 'billing',
            'label' => 'استعراض الباقات والخطط المتاحة',
            'scopes' => ['tenant'],
        ],
        'packages.create' => [
            'module' => 'billing',
            'label' => 'إنشاء باقة جديدة وتحديد سعرها',
            'scopes' => ['tenant'],
        ],
        'packages.manage' => [
            'module' => 'billing',
            'label' => 'تعديل وإيقاف الباقات والأسعار',
            'scopes' => ['tenant'],
        ],
        'payments.view' => [
            'module' => 'billing',
            'label' => 'عرض طلبات الدفع وإيصالات التحويل',
            'scopes' => ['self', 'linked', 'tenant'],
        ],
        'payments.approve' => [
            'module' => 'billing',
            'label' => 'اعتماد طلبات الدفع وتأكيد السداد',
            'scopes' => ['tenant'],
        ],
        'payments.reject' => [
            'module' => 'billing',
            'label' => 'رفض طلبات الدفع وتوضيح السبب',
            'scopes' => ['tenant'],
        ],
        'subscriptions.view' => [
            'module' => 'billing',
            'label' => 'عرض الاشتراكات الحالية وسريانها',
            'scopes' => ['self', 'linked', 'tenant'],
        ],
        'subscriptions.manage' => [
            'module' => 'billing',
            'label' => 'تعديل وتمديد وإلغاء الاشتراكات',
            'scopes' => ['tenant'],
        ],
        'entitlements.view' => [
            'module' => 'billing',
            'label' => 'عرض استحقاقات الطلاب وصلاحيات الدخول',
            'scopes' => ['self', 'linked', 'tenant'],
        ],
        'entitlements.grant' => [
            'module' => 'billing',
            'label' => 'منح استحقاق وصول يدوي لمقرر أو فصل',
            'scopes' => ['tenant'],
        ],
        'entitlements.revoke' => [
            'module' => 'billing',
            'label' => 'سحب أو إلغاء استحقاق وصول',
            'scopes' => ['tenant'],
        ],

        // ── Access Credentials & Device Security ───────────────────────────
        'credentials.view' => [
            'module' => 'credentials',
            'label' => 'عرض بطاقات وأكواد دخول الطلاب',
            'scopes' => ['self', 'assigned', 'branch', 'tenant'],
        ],
        'credentials.create' => [
            'module' => 'credentials',
            'label' => 'توليد وإصدار بطاقة وصول جديدة (كوبون / QR)',
            'scopes' => ['assigned', 'branch', 'tenant'],
        ],
        'credentials.issue' => [
            'module' => 'credentials',
            'label' => 'إصدار وتنشيط بطاقة دخول طالب (مطابق للمواصفة)',
            'scopes' => ['assigned', 'branch', 'tenant'],
        ],
        'credentials.revoke' => [
            'module' => 'credentials',
            'label' => 'إلغاء وإيقاف صلاحية بطاقة دخول',
            'scopes' => ['branch', 'tenant'],
        ],
        'credentials.manage_devices' => [
            'module' => 'credentials',
            'label' => 'إدارة وفك ربط أجهزة الطلاب',
            'scopes' => ['assigned', 'branch', 'tenant'],
        ],
        'devices.replace' => [
            'module' => 'credentials',
            'label' => 'فك ربط جهاز الطالب والسماح بربط جهاز جديد',
            'scopes' => ['assigned', 'branch', 'tenant'],
        ],

        // ── Analytics & Reports ────────────────────────────────────────────
        'analytics.view' => [
            'module' => 'analytics',
            'label' => 'استعراض لوحات القياس والرسوم البيانية',
            'scopes' => ['self', 'linked', 'own', 'branch', 'tenant'],
        ],
        'analytics.manage' => [
            'module' => 'analytics',
            'label' => 'إدارة وتخصيص مؤشرات الأداء المستهدفة',
            'scopes' => ['tenant'],
        ],
        'reports.view' => [
            'module' => 'analytics',
            'label' => 'استعراض التقارير الدورية للمؤسسة',
            'scopes' => ['self', 'linked', 'own', 'branch', 'tenant'],
        ],
        'reports.generate' => [
            'module' => 'analytics',
            'label' => 'توليد تقارير الأداء التفصيلية',
            'scopes' => ['tenant'],
        ],
        'reports.download' => [
            'module' => 'analytics',
            'label' => 'تصدير وتحميل التقارير بصيغة PDF/Excel',
            'scopes' => ['tenant'],
        ],
        'metrics.manage' => [
            'module' => 'analytics',
            'label' => 'تحديث مؤشرات التفاعل اليومي',
            'scopes' => ['tenant'],
        ],

        // ── Parents Gateway ────────────────────────────────────────────────
        'parents.view' => [
            'module' => 'parents',
            'label' => 'عرض حسابات أولياء الأمور المرتبطة',
            'scopes' => ['branch', 'tenant'],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Standard System Roles Matrix (OD-1 / Access Model §5)
    |--------------------------------------------------------------------------
    |
    | Defines the default capabilities and default scopes for the 8 standard
    | system roles provisioned inside each tenant database.
    |
    */
    'roles' => [

        // 1. Owner — Full tenant control
        'owner' => [
            'label' => 'مالك المؤسسة / مدير النظام',
            'description' => 'صلاحيات إدارية كاملة غير مقيدة على كافة موارد وأقسام المؤسسة',
            'is_system' => true,
            'permissions' => [
                'tenant.settings' => 'tenant',
                'tenant.branding' => 'tenant',
                'users.view' => 'tenant',
                'users.create' => 'tenant',
                'users.update' => 'tenant',
                'users.suspend' => 'tenant',
                'roles.view' => 'tenant',
                'roles.manage' => 'tenant',
                'audit.view' => 'tenant',
                'notifications.send' => 'tenant',
                'students.view' => 'tenant',
                'students.create' => 'tenant',
                'students.update' => 'tenant',
                'students.delete' => 'tenant',
                'parents.manage' => 'tenant',
                'parents.view' => 'tenant',
                'staff.manage' => 'tenant',
                'enrollments.view' => 'tenant',
                'enrollments.create' => 'tenant',
                'courses.view' => 'tenant',
                'courses.create' => 'tenant',
                'courses.update' => 'tenant',
                'courses.delete' => 'tenant',
                'courses.publish' => 'tenant',
                'lessons.view' => 'tenant',
                'lessons.create' => 'tenant',
                'lessons.update' => 'tenant',
                'lessons.delete' => 'tenant',
                'lessons.reorder' => 'tenant',
                'materials.manage' => 'tenant',
                'media.view' => 'tenant',
                'media.upload' => 'tenant',
                'media.delete' => 'tenant',
                'progress.view' => 'tenant',
                'meetings.view' => 'tenant',
                'meetings.create' => 'tenant',
                'meetings.manage' => 'tenant',
                'branches.manage' => 'tenant',
                'classrooms.manage' => 'tenant',
                'classes.view' => 'tenant',
                'classes.create' => 'tenant',
                'classes.update' => 'tenant',
                'classes.manage_students' => 'tenant',
                'sessions.view' => 'tenant',
                'sessions.create' => 'tenant',
                'sessions.update' => 'tenant',
                'attendance.view' => 'tenant',
                'attendance.record' => 'tenant',
                'attendance.correct' => 'tenant',
                'attendance.scan' => 'tenant',
                'assignments.view' => 'tenant',
                'assignments.create' => 'tenant',
                'assignments.update' => 'tenant',
                'assignments.grade' => 'tenant',
                'assignments.publish' => 'tenant',
                'exams.view' => 'tenant',
                'exams.create' => 'tenant',
                'exams.update' => 'tenant',
                'exams.grade' => 'tenant',
                'exams.publish' => 'tenant',
                'grades.view' => 'tenant',
                'packages.view' => 'tenant',
                'packages.create' => 'tenant',
                'packages.manage' => 'tenant',
                'payments.view' => 'tenant',
                'payments.approve' => 'tenant',
                'payments.reject' => 'tenant',
                'subscriptions.view' => 'tenant',
                'subscriptions.manage' => 'tenant',
                'entitlements.view' => 'tenant',
                'entitlements.grant' => 'tenant',
                'entitlements.revoke' => 'tenant',
                'credentials.view' => 'tenant',
                'credentials.create' => 'tenant',
                'credentials.issue' => 'tenant',
                'credentials.revoke' => 'tenant',
                'credentials.manage_devices' => 'tenant',
                'devices.replace' => 'tenant',
                'analytics.view' => 'tenant',
                'analytics.manage' => 'tenant',
                'reports.view' => 'tenant',
                'reports.generate' => 'tenant',
                'reports.download' => 'tenant',
                'metrics.manage' => 'tenant',
            ],
        ],

        // 2. Center Admin — Academic & operations center director
        'center_admin' => [
            'label' => 'مدير المركز التعليمي',
            'description' => 'إدارة يومية تشغيلية وأكاديمية للمركز بدون إعدادات العلامة التجارية',
            'is_system' => true,
            'permissions' => [
                'users.view' => 'tenant',
                'users.create' => 'tenant',
                'users.update' => 'tenant',
                'roles.view' => 'tenant',
                'audit.view' => 'tenant',
                'notifications.send' => 'tenant',
                'students.view' => 'tenant',
                'students.create' => 'tenant',
                'students.update' => 'tenant',
                'parents.manage' => 'tenant',
                'parents.view' => 'tenant',
                'staff.manage' => 'tenant',
                'enrollments.view' => 'tenant',
                'enrollments.create' => 'tenant',
                'courses.view' => 'tenant',
                'courses.create' => 'tenant',
                'courses.update' => 'tenant',
                'courses.publish' => 'tenant',
                'lessons.view' => 'tenant',
                'lessons.create' => 'tenant',
                'lessons.update' => 'tenant',
                'lessons.reorder' => 'tenant',
                'materials.manage' => 'tenant',
                'media.view' => 'tenant',
                'media.upload' => 'tenant',
                'progress.view' => 'tenant',
                'meetings.view' => 'tenant',
                'meetings.create' => 'tenant',
                'meetings.manage' => 'tenant',
                'classrooms.manage' => 'tenant',
                'classes.view' => 'tenant',
                'classes.create' => 'tenant',
                'classes.update' => 'tenant',
                'classes.manage_students' => 'tenant',
                'sessions.view' => 'tenant',
                'sessions.create' => 'tenant',
                'sessions.update' => 'tenant',
                'attendance.view' => 'tenant',
                'attendance.record' => 'tenant',
                'attendance.correct' => 'tenant',
                'attendance.scan' => 'tenant',
                'assignments.view' => 'tenant',
                'assignments.create' => 'tenant',
                'assignments.update' => 'tenant',
                'assignments.grade' => 'tenant',
                'assignments.publish' => 'tenant',
                'exams.view' => 'tenant',
                'exams.create' => 'tenant',
                'exams.update' => 'tenant',
                'exams.grade' => 'tenant',
                'exams.publish' => 'tenant',
                'grades.view' => 'tenant',
                'packages.view' => 'tenant',
                'packages.create' => 'tenant',
                'packages.manage' => 'tenant',
                'payments.view' => 'tenant',
                'payments.approve' => 'tenant',
                'payments.reject' => 'tenant',
                'subscriptions.view' => 'tenant',
                'subscriptions.manage' => 'tenant',
                'entitlements.view' => 'tenant',
                'entitlements.grant' => 'tenant',
                'entitlements.revoke' => 'tenant',
                'credentials.view' => 'tenant',
                'credentials.create' => 'tenant',
                'credentials.issue' => 'tenant',
                'credentials.revoke' => 'tenant',
                'credentials.manage_devices' => 'tenant',
                'devices.replace' => 'tenant',
                'analytics.view' => 'tenant',
                'reports.view' => 'tenant',
                'reports.generate' => 'tenant',
                'reports.download' => 'tenant',
            ],
        ],

        // 3. Branch Manager — Branch-level scope
        'branch_manager' => [
            'label' => 'مدير الفرع',
            'description' => 'إدارة الفروع الحضورية والطلاب والقاعات في نطاق الفرع المسند إليه',
            'is_system' => true,
            'permissions' => [
                'users.view' => 'branch',
                'students.view' => 'branch',
                'students.create' => 'branch',
                'students.update' => 'branch',
                'parents.view' => 'branch',
                'enrollments.view' => 'branch',
                'courses.view' => 'branch',
                'lessons.view' => 'branch',
                'classrooms.manage' => 'branch',
                'classes.view' => 'branch',
                'classes.create' => 'branch',
                'classes.update' => 'branch',
                'classes.manage_students' => 'branch',
                'sessions.view' => 'branch',
                'sessions.create' => 'branch',
                'sessions.update' => 'branch',
                'attendance.view' => 'branch',
                'attendance.record' => 'branch',
                'attendance.correct' => 'branch',
                'attendance.scan' => 'branch',
                'assignments.view' => 'branch',
                'exams.view' => 'branch',
                'grades.view' => 'branch',
                'credentials.view' => 'branch',
                'credentials.create' => 'branch',
                'credentials.issue' => 'branch',
                'credentials.manage_devices' => 'branch',
                'devices.replace' => 'branch',
                'analytics.view' => 'branch',
                'reports.view' => 'branch',
            ],
        ],

        // 4. Teacher — Own resources
        'teacher' => [
            'label' => 'معلم / مدرب',
            'description' => 'إدارة المقررات والفصول والدروس والواجبات الخاصة به فقط',
            'is_system' => true,
            'permissions' => [
                'students.view' => 'own',
                'enrollments.view' => 'own',
                'courses.view' => 'own',
                'courses.create' => 'tenant',
                'courses.update' => 'own',
                'courses.delete' => 'own',
                'courses.publish' => 'own',
                'lessons.view' => 'own',
                'lessons.create' => 'own',
                'lessons.update' => 'own',
                'lessons.delete' => 'own',
                'lessons.reorder' => 'own',
                'materials.manage' => 'own',
                'media.view' => 'own',
                'media.upload' => 'own',
                'progress.view' => 'own',
                'meetings.view' => 'own',
                'meetings.create' => 'own',
                'meetings.manage' => 'own',
                'classes.view' => 'own',
                'classes.create' => 'tenant',
                'classes.update' => 'own',
                'classes.manage_students' => 'own',
                'sessions.view' => 'own',
                'sessions.create' => 'own',
                'sessions.update' => 'own',
                'attendance.view' => 'own',
                'attendance.record' => 'own',
                'attendance.correct' => 'own',
                'attendance.scan' => 'own',
                'assignments.view' => 'own',
                'assignments.create' => 'own',
                'assignments.update' => 'own',
                'assignments.grade' => 'own',
                'assignments.publish' => 'own',
                'exams.view' => 'own',
                'exams.create' => 'own',
                'exams.update' => 'own',
                'exams.grade' => 'own',
                'exams.publish' => 'own',
                'grades.view' => 'own',
                'analytics.view' => 'own',
                'reports.view' => 'own',
                'notifications.send' => 'own',
            ],
        ],

        // 5. Assistant — Assigned scope
        'assistant' => [
            'label' => 'مساعد تعليمي',
            'description' => 'رصد الحضور ومسح QR وتصحيح الواجبات في الفصول المسندة إليه',
            'is_system' => true,
            'permissions' => [
                'students.view' => 'assigned',
                'enrollments.view' => 'assigned',
                'courses.view' => 'assigned',
                'lessons.view' => 'assigned',
                'classes.view' => 'assigned',
                'sessions.view' => 'assigned',
                'attendance.view' => 'assigned',
                'attendance.record' => 'assigned',
                'attendance.scan' => 'assigned',
                'assignments.view' => 'assigned',
                'assignments.grade' => 'assigned',
                'exams.view' => 'assigned',
                'exams.grade' => 'assigned',
                'grades.view' => 'assigned',
                'credentials.view' => 'assigned',
                'credentials.create' => 'assigned',
                'credentials.issue' => 'assigned',
                'credentials.manage_devices' => 'assigned',
                'devices.replace' => 'assigned',
            ],
        ],

        // 6. Finance — Billing & Payments (OD-7)
        'finance' => [
            'label' => 'مسؤول المالية',
            'description' => 'مراجعة طلبات الدفع وتأكيد التحويلات البنكية وإدارة الباقات والاشتراكات',
            'is_system' => true,
            'permissions' => [
                'students.view' => 'tenant',
                'packages.view' => 'tenant',
                'packages.create' => 'tenant',
                'packages.manage' => 'tenant',
                'payments.view' => 'tenant',
                'payments.approve' => 'tenant',
                'payments.reject' => 'tenant',
                'subscriptions.view' => 'tenant',
                'subscriptions.manage' => 'tenant',
                'entitlements.view' => 'tenant',
                'entitlements.grant' => 'tenant',
                'entitlements.revoke' => 'tenant',
                'reports.view' => 'tenant',
                'reports.download' => 'tenant',
            ],
        ],

        // 7. Student — Self scope
        'student' => [
            'label' => 'طالب',
            'description' => 'حساب الطالب للوصول إلى دروسه واختباراته وحضوره في نطاقه الشخصي فقط',
            'is_system' => true,
            'permissions' => [
                'students.view' => 'self',
                'students.update' => 'self',
                'enrollments.view' => 'self',
                'enrollments.create' => 'self',
                'courses.view' => 'self',
                'lessons.view' => 'self',
                'media.view' => 'self',
                'meetings.view' => 'self',
                'progress.view' => 'self',
                'classes.view' => 'self',
                'sessions.view' => 'self',
                'attendance.view' => 'self',
                'assignments.view' => 'self',
                'exams.view' => 'self',
                'grades.view' => 'self',
                'packages.view' => 'tenant',
                'payments.view' => 'self',
                'subscriptions.view' => 'self',
                'entitlements.view' => 'self',
                'credentials.view' => 'self',
                'analytics.view' => 'self',
            ],
        ],

        // 8. Parent — Linked scope
        'parent' => [
            'label' => 'ولي أمر',
            'description' => 'متابعة الأبناء المرتبطين واستعراض الحضور والدرجات والاشتراكات',
            'is_system' => true,
            'permissions' => [
                'students.view' => 'linked',
                'enrollments.view' => 'linked',
                'courses.view' => 'linked',
                'lessons.view' => 'linked',
                'classes.view' => 'linked',
                'sessions.view' => 'linked',
                'attendance.view' => 'linked',
                'assignments.view' => 'linked',
                'grades.view' => 'linked',
                'progress.view' => 'linked',
                'payments.view' => 'linked',
                'subscriptions.view' => 'linked',
                'entitlements.view' => 'linked',
                'analytics.view' => 'linked',
            ],
        ],
    ],
];
