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
| FR-ONLINE-001 | الكورسات | CRUD مع ownership/scope (R1-A4) | `/teacher/courses` (R4-5) | **REAL** | T-SEC-09 (مغلق ومفحوص) |
| FR-ONLINE-002 | الدروس | CRUD + ترتيب + نشر (R4-2) | Course Builder `/teacher/courses/[id]` (R4-5) | **REAL** | T-FEAT-01, 04 (مغلق؛ صفحة > 900 سطر) |
| FR-ONLINE-003 | محتوى داخل الدرس | `course_modules` + `lesson_materials` + أنواع الدروس (R4-1) | Builder + Player (R4-5, R4-6) | **REAL** | T-FEAT-02 (مغلق) |
| FR-ONLINE-004/005 | Drive/Vimeo + تضمين | تسجيل رابط + embed بعد فحص الوصول (R3-1)؛ رفع Drive الحقيقي **غير منفذ** | تسجيل رابط + مشغل | PARTIAL (BLOCKED: بيانات Google Cloud، OD-3) | T-FEAT-06, 07 |
| FR-ONLINE-006 | تقدم المشاهدة | `video_events` + `ProgressAggregator` (R4-4) | مشغل يرسل heartbeat ويستكمل من آخر موضع | **REAL** | T-FEAT-03 (مغلق؛ سيناريو E2E موجود لم يُشغَّل في هذه المراجعة) |
| FR-ONLINE-007 | كشف إساءة الاستخدام | إشارات abuse تُسجَّل (R4-4) | لا واجهة مراجعة | PARTIAL | — |
| FR-ONLINE-008 | علامة مائية | — | تعمل (متحركة) | REAL | — |
| FR-ONLINE-009 | واجبات | إنشاء/تسليم نصي وملفات/تصحيح/نشر (R6-4) | إنشاء + تصحيح `/teacher/grading` | PARTIAL (لا E2E) | T-FEAT-18, 19 |
| FR-ONLINE-010 | امتحانات | lifecycle + توقيت سيرفر + بنك أسئلة (R6-1..3) + حجب الإجابات (R0-2) | Builder (1162 سطر) + تقديم ونتيجة | PARTIAL (لا E2E للبناء) | T-SEC-11, T-FEAT-17 |
| FR-ONLINE-011 | التصحيح والنشر | API موجود | `/teacher/grading` | PARTIAL (لا E2E) | T-FEAT-19 |
| FR-ONLINE-012 / BR-026 | Google Meet | روابط يدوية معلّمة + فرض الانضمام؛ إنشاء Google الحقيقي **غير منفذ** | الفصل الوهمي أُزيل؛ `/student/meetings` يفتح الرابط | PARTIAL (BLOCKED: بيانات Google Cloud، OD-5) | T-FEAT-10, 11 |
| Master §36 | Entitlement يحكم الوصول | `ContentAccessPolicy` على كل endpoint محتوى (R3-1, R3-2) | شاشة "اشترك" | **REAL** | T-SEC-07 (مغلق ومفحوص) |

## Offline / Attendance

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-OFFLINE-001/002 | الفروع والقاعات | BranchController + ClassroomController كامل CRUD مع حقل branch_id (R2-3) | شاشة إدارة الفروع والقاعات والسعة /admin/branches (R2-7) | **REAL** | T-FEAT-15 (مغلق ومفحوص) |
| FR-OFFLINE-003/004 | الفصول والجلسات | scope مفروض (R1-A4) | `/teacher/classes`, `/teacher/sessions` (R5-7) | PARTIAL (لا E2E) | T-SEC-08, T-FEAT-15 |
| FR-OFFLINE-005 | أوضاع الحضور والتصحيح | تصحيح بسبب + سجل تدقيق (R5-4) | — | **REAL** (backend) | T-FEAT-16 (مغلق ومفحوص) |
| FR-OFFLINE-006 / FR-CRED-004 | QR للطالب + مسح | توكن موقّع قصير العمر (R5-1) + تحقق المسح (R5-2) | `/student/card` + ماسح كاميرا (R5-5, R5-6) | **REAL** | T-SEC-10, T-FEAT-13 (مغلق؛ QR الجلسة مؤجل OD-4) |
| FR-OFFLINE-007 | UX موبايل للمسح | — | `/staff/attendance/scan/[sessionId]` (739 سطر) | **REAL** | T-FEAT-14 |
| FR-OFFLINE-008 | تحقق الحضور | تحقق مؤسسة/طالب/جلسة/فصل/نطاق + تكرار حتمي (R5-2) | — | **REAL** (backend) | T-SEC-10 (مغلق ومفحوص) |
| Master §32 | منع التكرار | `updateOrCreate` | — | REAL | — |

## Billing & Credentials

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-SUB-002 | الباقات | تعديل/أرشفة + منح/سحب يدوي مع سبب (R3-4) | `/admin/packages` (R3-6) | PARTIAL (لا E2E؛ تعارض مع ADR-004/006 OD-34 مفتوح، PAY-UX-1) | T-FEAT-22 |
| FR-BILL-001..004 | طلب دفع + إثبات | رفع ملف + رابط موقّع (R3-3) | `/student/plans`, `/student/payments` (R3-5) | PARTIAL (لا E2E للواجهة؛ سيناريو E2E موجود لم يُشغَّل هنا) | T-FEAT-20, 21 |
| FR-BILL-005..007 | قائمة المراجعة + اعتماد/رفض | يعمل + IDOR (R0-3) + أثر جانبي (R3-7) + مراجعة الأكاديمية لباقاتها (PAY-REV-1) | `/teacher/payments` | REAL (backend)؛ لا اختبار مخصص لرفض 403 في PAY-REV-1 | T-RBAC-01 |
| FR-BILL-008 | تدقيق الدفع | يعمل | — | REAL (backend) | — |
| FR-SUB-003 | فصل الاشتراك عن الوصول | `ContentAccessPolicy` (R3-1) | — | **REAL** | T-SEC-07 |
| FR-CRED-001..003 | إصدار الأكواد | يعمل | الصفحة تعمل بعد منح الصلاحيات (R1-A3) | PARTIAL (لا E2E) | T-RBAC-01 |
| FR-CRED-005..008 | دورة الحياة والأجهزة | unbind بدل fingerprint عشوائي (R0-6) | — | **REAL** | T-SEC-12 |

## Analytics, Reporting, Notifications

| Req | الوصف | Backend | Frontend | الحالة | Findings |
|---|---|---|---|---|---|
| FR-ANALYTICS-001 | KPIs قياسية | snapshots؛ "لا توجد بيانات" بدل 100% (R8-4) | لوحات الأدوار | PARTIAL (API للمقرر/الفصل فقط) | T-FEAT-29, T-RBAC-06 |
| FR-ANALYTICS-002/003 | KPIs مخصصة وتعريفات | API موجود | لا واجهة تعريف المقاييس | PARTIAL | T-FEAT-31 |
| FR-ANALYTICS-004 | تاريخي | versions موجودة | — | PARTIAL | — |
| FR-PARENT-001..005 | تجربة ولي الأمر | `/me/children` (R1-A8) + ربط إلزامي (P9) | `/parent/*` | PARTIAL (لا E2E؛ سجل الحضور بلا قائمة جلسات J-03) | T-RBAC-08, 09 |
| FR-REPORT-001..003 | التقارير | Jobs + CSV/طباعة (R8-5)؛ PDF غير منفذ | `/teacher/reports` | PARTIAL | T-FEAT-31, 32 |
| FR-NOTIFY-001 | إشعارات داخلية | أحداث نطاق + توجيه طالب/ولي أمر (R8-1, P9) | الجرس + `/notifications` + تفضيلات (R8-2) | PARTIAL (لا E2E للجرس خارج سيناريو الدفع) | T-FEAT-28 |
| FR-NOTIFY-002 | بريد / واتساب | `SendNotificationEmail`، `SendWhatsAppMessage` (adapter؛ بانتظار بيانات Meta و SMTP) | — | PARTIAL | T-FEAT-28 |
| BR-029 | قابلية التدقيق | `AuditLogger` + `/admin/audit` | شاشة `/admin/audit` | PARTIAL | C-13 |

## Cross-Cutting Frontend

| Req | الوصف | الحالة | Findings |
|---|---|---|---|
| Master §7 | Light + Dark | PARTIAL (يعمل؛ لا لقطات Playwright) | T-UX-03 |
| Master §66 | RTL | REAL | — |
| Master §67 | Mobile-first | PARTIAL (درج تنقل موجود، صفحات ضخمة) | T-UX-06 |
| Master §68-69 | PWA آمن | PARTIAL (`offline.html` في precache والـ SW لا يخزّن API؛ لا اختبار آلي) | T-UX-11 |
| Master §63 | لا God Files | **BROKEN** (39 ملف .tsx > 300 سطر؛ الأكبر: exam builder 1162، admin/users 1043، teacher/courses/[id] 969) | T-UX-06 |
| Quality Gate §6 | لا بيانات وهمية | PARTIAL (محاكاة AI Tutor والفصل الوهمي أُزيلتا؛ بقي محتوى الـ landing التجريبي المعلَّم OD-21) | T-UX-04, 05, T-FEAT-29, 30, 33, 27b |
| Quality Gate §14 | حالات Loading/Empty/Error/Forbidden | PARTIAL (طبقة `data-state` موجودة؛ أُغلقت المواضع السبعة التي تبتلع الخطأ في 2026-11-24؛ لم يُفحص في المتصفح ولا E2E) | T-UX-01 |
| Quality Gate §10 | Landing page | PARTIAL (موجودة بمحتوى تجريبي معلَّم، OD-21) | T-UX-02 |

## الإجمالي

> آخر تحديث: 2026-11-16 (مراجعة الريكفري). الأساس: الـ tracker + الكود + PHPUnit 346/346 (SQLite) + `tsc` نظيف + 37 اختبار واجهة. **لم تُشغَّل** Playwright ولا Postgres في هذه المراجعة، فصفوف "REAL" للواجهة تعتمد على تقارير المراحل السابقة.

| الحالة | عدد الصفوف أعلاه (63) |
|---|---|
| REAL | 34 |
| PARTIAL | 28 |
| BROKEN | 1 (Master §63 God Files) |
| SIMULATED | 0 |
| MISSING | 0 |

**القراءة:** لا يوجد SIMULATED أو MISSING في النطاق. المانع الوحيد لبوابة الإصدار من هذه المصفوفة: **God Files (T-UX-06)**. أما الصفوف PARTIAL فأغلبها "لا E2E" أو بانتظار بيانات Google/Meta/SMTP.
