# 04 — مصفوفة التغطية: المتطلب ← Backend ← Frontend ← الحالة الحقيقية

> **مفتاح الحالة:**
> - **REAL** — يعمل end-to-end ببيانات حقيقية ومع الصلاحيات الصحيحة.
> - **PARTIAL** — جزء حقيقي وجزء ناقص.
> - **BROKEN** — موجود لكن لا يعمل للمستخدم الحقيقي (صلاحيات/عقد/خطأ).
> - **SIMULATED** — واجهة أو adapter يحاكي سلوكًا غير موجود.
> - **MISSING** — غير موجود.
>
> المرجع: `BRD-FULL.md` (FR-*) و `MASTER-SPECIFICATION.md` (§).
> هذه المصفوفة تصبح **المصدر الوحيد للحالة** بعد اعتمادها (انظر R9 في الخطة).

## Tenancy & Platform

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-TEN-001 | إنشاء مؤسسة | TenantProvisioningService خدمة متكاملة ذرية (R2-4) | واجهة تهيئة فورية حقيقية بالمنصة (R2-6) | **REAL** | T-SEC-01, T-RBAC-03, T-FEAT-25 (مغلق ومفحوص) |
| FR-TEN-002/003 | نوع المؤسسة والإعدادات | TenantCurrentController::update + API (R2-7) | شاشة إعدادات المؤسسة /admin/settings (R2-7) | **REAL** | مغلق ومفحوص |
| FR-TEN-004 | الهوية البصرية | API تحديث الهوية والألوان (R2-7) | محدد ألوان ومعاينة حية لشعار وألوان المنصة (R2-7) | **REAL** | مغلق ومفحوص |
| FR-TEN-005 | تفعيل الأقسام online/offline | TenantModuleMiddleware يفرض التفعيل بمستوى المؤسسة (R1-A5) | يقرأ من عقد /auth/me | **REAL** | T-RBAC-12 (مغلق بالـ Backend) |
| — | التسجيل الذاتي للمؤسسة | SchoolRegistrationController مع honeypot وslug حقيقي (R2-5) | صفحة تسجيل مدرسة حقيقية /register-school (R2-5) | **REAL** | T-FEAT-24 (مغلق ومفحوص) |
| FR-ADMIN-001 | لوحة المنصة | PlatformUser + PlatformToken + PlatformAuthController (R1-A9) | قائمة مؤسسات + تقرير صحة ومؤشرات حقيقية (R0-7, R2-6) | **REAL** | T-FEAT-27 (مغلق ومفحوص) |
| FR-ADMIN-002 | خصوصية المؤسسة | محمي بـ platform.auth (R0-1) | توكن في sessionStorage (R0-7) | **REAL** | T-SEC-01 (مغلق) |
| FR-ADMIN-003/004 | دخول الدعم + تدقيق | كود تبادل لمرة واحدة 60ث + إنهاء جلسة الدعم (R0-5, R1-A9, R2-6) | صفحة سجل جلسات الدعم الفني /platform/support-sessions (R2-6) | **REAL** | T-SEC-01..03 (مغلق ومفحوص) |
| Master §12 | عزل قواعد البيانات | يعمل ومختبر | — | **REAL** | — |

## Identity, Auth, Authorization

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-ID-001/002 | إنشاء المستخدمين/الطلاب | UserManagementService + StudentImportService كامل CRUD (R2-1, R2-2) | شاشات /admin/users و/admin/users/new و/admin/students/import (R2-7) | **REAL** | T-FEAT-34 (مغلق ومفحوص) |
| FR-ID-003/004 | الطالب متعدد المؤسسات | `/student/academies` + ربط global_identity (R2-1) | شريط في لوحة الطالب | PARTIAL | — |
| FR-ID-005/006 | ولي الأمر وأبناؤه | `/me/children` + ParentController + ربط الأبناء (R1-A4, R2-1) | ملف ولي الأمر وعرض الأبناء بشاشة /admin/users/[id] (R2-7) | PARTIAL | T-RBAC-08 |
| FR-AUTH-001 | دخول بكلمة مرور | عقد معتمد موحد عبر AuthPayloadBuilder (R1-A6) | يعمل | REAL | — |
| FR-AUTH-002/003/004 | دخول بالكوبون / hybrid | عقد معتمد موحد عبر AuthPayloadBuilder (R1-A6) | **لا واجهة دخول بالكوبون** | PARTIAL | — |
| FR-AUTH-006 | تحقق الجهاز | يعمل | فك ربط معتمد (unbind) دون بصمات عشوائية (R0-6) | **REAL** | T-SEC-12 (مغلق) |
| FR-AUTHZ-001 | RBAC | كتالوج رسمي 84 صلاحية ونطاقات متسقة (R1-A2) | خطاف `useCan` ومكونات `<Can>` و`<PermissionGate>` (R1-B5) | **REAL** | T-RBAC-01, 02 (مغلق ومفحوص) |
| FR-AUTHZ-002/006 | ABAC Allow/Deny/Inherit | محرك + قاعدة واحدة | — | PARTIAL | — |
| FR-AUTHZ-003 | أدوار نظامية | 8 أدوار معتمدة ومزامنة تلقائية (R1-A3) | حماية الأدوار النظامية ومنع تعديلها بالشاشة (R1-B8) | **REAL** | T-RBAC-11 (مغلق ومفحوص) |
| FR-AUTHZ-004 | أدوار مخصصة | RoleController كامل CRUD مع منع تصعيد الصلاحيات (R1-A7) | شاشة كاملة `/admin/roles` لإنشاء وتعديل وحذف الصلاحيات (R1-B8) | **REAL** | T-RBAC-10 (مغلق ومفحوص) |
| FR-AUTHZ-007 | Scopes | ScopeResolver كامل النطاقات الستة (R1-A4) | مستهلكة عبر `src/types/auth.ts` و`usePermissionScope` (R1-B1, R1-B5) | **REAL** | T-SEC-08, 09 (مغلق ومفحوص) |
| Master §61 | تجارب منفصلة لكل دور | تجارب محسوبة من الـ Backend عبر AuthPayloadBuilder (R1-A6) | NavigationRegistry + حراس ExperienceGuard وmiddleware مع 403 (R1-B3, R1-B4) | **REAL** | T-RBAC-04, 05 (مغلق ومفحوص) |

## Online Learning

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-ONLINE-001 | الكورسات | CRUD (delete بلا ABAC) | إنشاء + عرض | PARTIAL | T-SEC-09 |
| FR-ONLINE-002 | الدروس | إنشاء + عرض فقط | إنشاء درس نصي | PARTIAL | T-FEAT-01, 04 |
| FR-ONLINE-003 | محتوى (فيديو/ملفات/واجبات/امتحانات) داخل الدرس | لا modules، لا مواد | — | **MISSING** | T-FEAT-02 |
| FR-ONLINE-004/005 | Drive/Vimeo + تضمين | تسجيل رابط فقط | تسجيل رابط + مشغل | **SIMULATED** | T-FEAT-06, 07 |
| FR-ONLINE-006 | تقدم المشاهدة | **لا نموذج ولا API** | حالة React | **MISSING** | T-FEAT-03 |
| FR-ONLINE-007 | كشف إساءة الاستخدام | — | — | **MISSING** | — |
| FR-ONLINE-008 | علامة مائية | — | تعمل (متحركة) | REAL | — |
| FR-ONLINE-009 | واجبات | إنشاء/تسليم نصي/تصحيح/نشر | إنشاء + تصحيح، لا نشر | PARTIAL | T-FEAT-18, 19 |
| FR-ONLINE-010 | امتحانات | يعمل + حجب الإجابات عن الطلاب (R0-2) + لا توقيت | تقديم فقط، **لا بناء** | PARTIAL | T-SEC-11, T-FEAT-17 |
| FR-ONLINE-011 | التصحيح والنشر | API موجود | جزئي | PARTIAL | T-FEAT-19 |
| FR-ONLINE-012 / BR-026 | Google Meet | كود عشوائي | إنشاء + فصل افتراضي وهمي | **SIMULATED** | T-FEAT-10, 11 |
| Master §36 | Entitlement يحكم الوصول | **لا enforcement** | — | **MISSING** | T-SEC-07 |

## Offline / Attendance

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-OFFLINE-001/002 | الفروع والقاعات | BranchController + ClassroomController كامل CRUD مع حقل branch_id (R2-3) | شاشة إدارة الفروع والقاعات والسعة /admin/branches (R2-7) | **REAL** | T-FEAT-15 (مغلق ومفحوص) |
| FR-OFFLINE-003/004 | الفصول والجلسات | API بلا scope | عرض فقط، لا إنشاء | PARTIAL | T-SEC-08, T-FEAT-15 |
| FR-OFFLINE-005 | أوضاع الحضور | حقل `attendance_mode` | — | PARTIAL | T-FEAT-16 |
| FR-OFFLINE-006 / FR-CRED-004 | QR للطالب + مسح | يقبل كود ثابت | حقل نصي، لا كاميرا، لا QR للطالب | **SIMULATED** | T-SEC-10, T-FEAT-13, 14 |
| FR-OFFLINE-007 | UX موبايل للمسح | — | modal سطح مكتب | **MISSING** | — |
| FR-OFFLINE-008 | تحقق الحضور | لا تحقق فصل/وقت | — | **BROKEN** | T-SEC-10 |
| Master §32 | منع التكرار | `updateOrCreate` | — | REAL | — |

## Billing & Credentials

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-SUB-002 | الباقات | إنشاء + عرض | **لا واجهة** | PARTIAL | T-FEAT-22 |
| FR-BILL-001..004 | طلب دفع + إثبات | API (إثبات = نص) | **لا واجهة للطالب** | **MISSING (UI)** | T-FEAT-20, 21 |
| FR-BILL-005..007 | قائمة المراجعة + اعتماد/رفض | يعمل + حماية IDOR (R0-3) | زُوّدت بصلاحية payments.view في البذور (R0-3) | REAL (backend) | T-RBAC-01 |
| FR-BILL-008 | تدقيق الدفع | يعمل | — | REAL (backend) | — |
| FR-SUB-003 | فصل الاشتراك عن الوصول | النموذج صحيح | — | PARTIAL (لا enforcement) | T-SEC-07 |
| FR-CRED-001..003 | إصدار الأكواد | يعمل | الصفحة لا تجلب الطلاب (403) | **BROKEN** | T-RBAC-01 |
| FR-CRED-005..008 | دورة الحياة والأجهزة | يعمل | استبدال الجهاز معيب | PARTIAL | T-SEC-12 |

## Analytics, Reporting, Notifications

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-ANALYTICS-001 | KPIs قياسية | snapshot + **100% وهمي** عند الغياب | لوحة الطالب لا تجد `student.id` | **BROKEN** | T-FEAT-29, T-RBAC-06 |
| FR-ANALYTICS-002/003 | KPIs مخصصة وتعريفات | API موجود | **لا واجهة** | PARTIAL | T-FEAT-31 |
| FR-ANALYTICS-004 | تاريخي | versions موجودة | — | PARTIAL | — |
| FR-PARENT-001..005 | تجربة ولي الأمر | لا endpoints مخصصة | فارغة | **BROKEN** | T-RBAC-08, 09 |
| FR-REPORT-001..003 | التقارير | متزامنة | **لا واجهة** | PARTIAL | T-FEAT-31, 32 |
| FR-NOTIFY-001 | إشعارات داخلية | قراءة فقط، **لا إنشاء** | **لا واجهة** | **MISSING** | T-FEAT-28 |
| FR-NOTIFY-002 | بريد | — | — | **MISSING** | T-FEAT-28 |
| BR-029 | قابلية التدقيق | 4 أفعال فقط | لا واجهة | PARTIAL | C-13 |

## Cross-Cutting Frontend

| Req | الوصف | الحالة | Findings |
|---|---|---|---|
| Master §7 | Light + Dark | PARTIAL (يعمل؛ لا لقطات Playwright) | T-UX-03 |
| Master §66 | RTL | REAL | — |
| Master §67 | Mobile-first | PARTIAL (درج تنقل موجود، صفحات ضخمة) | T-UX-06 |
| Master §68-69 | PWA آمن | PARTIAL | T-UX-11 |
| Master §63 | لا God Files | **BROKEN** | T-UX-06 |
| Quality Gate §6 | لا بيانات وهمية | **BROKEN** | T-UX-04, 05, T-FEAT-29, 30, 33, 27b |
| Quality Gate §14 | حالات Loading/Empty/Error/Forbidden | **BROKEN** | T-UX-01 |
| Quality Gate §10 | Landing page | PARTIAL (موجودة بمحتوى تجريبي معلَّم، OD-21) | T-UX-02 |

## الإجمالي

| الحالة | عدد الصفوف أعلاه (64) |
|---|---|
| REAL | 6 |
| PARTIAL | 21 |
| BROKEN | 18 |
| SIMULATED | 5 |
| MISSING | 14 |

**القراءة:** أقل من 10% من المتطلبات تعمل end-to-end كما يصفها التوثيق.
