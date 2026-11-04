# 02 — المشاكل التقنية (بالأدلة)

> **الخطورة:**
> - **P0** — ثغرة أمنية أو كسر يجعل الميزة غير قابلة للاستخدام. يُصلح قبل أي شيء آخر.
> - **P1** — ميزة أساسية ناقصة أو مزيفة أو مخالفة صريحة للتوثيق.
> - **P2** — جودة / UX / دين تقني.
>
> المسارات نسبية لـ `apps/`. أرقام الأسطر من نسخة 2026-10-30.
> العمود "Root" يربط بالمشكلة النظرية في `01-conceptual-problems.md`.

---

## A. الأمان (Security)

| ID | P | Root | المشكلة | الدليل | الأثر |
|---|---|---|---|---|---|
| T-SEC-01 | **P0** | C-03 | كل endpoints المنصة بدون authentication: list/create/update tenants، **إصدار توكن دعم**، سجل التدقيق العام | `api/routes/api.php:50-61` (خارج أي `auth` middleware) | أي شخص يحصل على توكن دخول لأي مؤسسة، ويعلّق/يعدل أي مؤسسة |
| T-SEC-02 | **P0** | C-03 | Support session: `platform_user_id` افتراضي = 1، توكن `abilities: ['*']`، مستخدم دعم دائم في قاعدة المؤسسة بلا role، لا endpoint لإنهاء الجلسة | `api/app/Http/Controllers/Api/Platform/SupportAccessController.php:36, 64-77` | لا مساءلة، لا revoke (مخالفة Master §52-53) |
| T-SEC-03 | **P0** | C-03 | توكن الدعم يُمرر في الـ URL query string | `web/src/app/platform/tenants/page.tsx:142` | التوكن يظهر في السجلات وتاريخ المتصفح |
| T-SEC-04 | **P0** | C-04 | **تسريب إجابات الامتحانات**: `GET /courses/{id}/exams` يرجع `questions` بما فيها `correct_answer`، والـ route بلا صلاحية، و `Question` لا يخفي الحقل | `api/app/Http/Controllers/Api/Assessment/ExamController.php:26`، `api/app/Models/Question.php` (لا `$hidden`)، `api/routes/api.php:164` | أي طالب يقرأ كل الإجابات قبل البدء |
| T-SEC-05 | **P0** | C-04 | IDOR: `GET /payment-requests/{id}` بلا أي فحص ← أي مستخدم يرى إثبات دفع وهاتف أي طالب | `api/app/Http/Controllers/Api/Billing/PaymentRequestController.php:90` | تسريب بيانات مالية وشخصية |
| T-SEC-06 | **P0** | C-04 | سجل تدقيق المؤسسة متاح لأي مستخدم مسجل (حتى الطالب) | `api/routes/api.php:77` (لا `tenant.can`) | تسريب نشاط الإدارة |
| T-SEC-07 | P1 | C-05 | تجاوز الدفع: الطالب يسجل نفسه في أي كورس (حتى draft)، والكورس المنشور مفتوح بالكامل بدون Entitlement؛ `hasEntitlement()` غير مستدعاة | `EnrollmentController.php` (self-enroll بلا فحص)، `CourseController.php:37`، `LessonController.php:authorizeCourseAccess`، `api/app/Models/Student.php:79` | نظام الدفع بلا أثر |
| T-SEC-08 | P1 | C-04 | Endpoints بلا scope: `GET /classes` و `/classes/{id}` (تكشف الطلاب) و `/classes/{id}/sessions` و `/meetings` لكل مسجل | `ClassController.php:19`، `SessionController.php`، `MeetingController.php:21` | الطالب يرى كل فصول وطلاب المؤسسة |
| T-SEC-09 | P1 | C-04 | لا ownership: أي مدرس يضيف دروسًا/امتحانات/واجبات/جلسات لأي كورس أو فصل، ويرصد حضورًا لأي جلسة، و `courses.destroy` بلا ABAC | `LessonController.php:34`، `ExamController.php:34,62`، `AssignmentController.php:32`، `SessionController.php`، `AttendanceController.php`، `CourseController.php:136` | مدرس يعدّل محتوى مدرس آخر |
| T-SEC-10 | P1 | C-08 | QR الحضور = `student_code` أو UUID ثابت؛ لا تحقق من أن الطالب في الفصل، ولا من وقت الجلسة أو حالتها | `api/app/Http/Controllers/Api/Attendance/AttendanceController.php:68-75` | تزوير حضور بتصوير الكود؛ مخالفة FR-OFFLINE-008 و Master §20 (opaque QR) |
| T-SEC-11 | P1 | — | مدة الامتحان لا تُفرض على السيرفر (لا فحص `duration_minutes` عند الإجابة/التسليم) | `ExamController.php:139-220` | مخالفة Master §35 "server is authoritative" |
| T-SEC-12 | P1 | — | استبدال الجهاز في الواجهة يرسل fingerprint عشوائي ← الجهاز الحقيقي للطالب يُحظر بعد الاستبدال | `web/src/app/teacher/credentials/page.tsx:166-167` | الطالب يُقفل خارج حسابه |
| T-SEC-13 | P2 | — | التوكن في `localStorage`، ولا معالجة لـ 401 (لا logout تلقائي ولا refresh) | `web/src/lib/token-store.ts`، `web/src/lib/api-client.ts` | جلسات منتهية تظهر كصفحات فارغة |
| T-SEC-14 | P2 | — | فحوصات الثغرات في CI لا تفشل أبدًا (`|| true`) | `.github/workflows/ci.yml:103,107` | gate أمني شكلي |
| T-SEC-16 | P1 | — | الـ changelog (M15-004) يسجل وضع Google **Client Secret** في `apps/web/.env` (الـ frontend). لم يُفتح الملف في هذه المراجعة؛ يجب التأكد أن السر غير موجود في أي ملف frontend وأنه في الـ backend فقط، وتدويره إن كان قد وصل للمتصفح أو لـ git | `docs/project-management/changelog.md` (M15-004) | تسريب سر OAuth |
| T-SEC-15 | P2 | C-02 | `switchRole` في الـ frontend يسمح بتبديل الواجهة يدويًا | `web/src/context/auth-context.tsx:149` | الواجهة ليست حدًا أمنيًا لكنه يخالف FE-SEC-INV ويربك |

---

## B. الأدوار والصلاحيات والأقسام (RBAC / Navigation) — الشكوى الرئيسية

| ID | P | Root | المشكلة | الدليل | الأثر |
|---|---|---|---|---|---|
| T-RBAC-01 | **P0** | C-01 | 7 صلاحيات تُفحص ولا تُنشأ: `students.view`, `grades.view`, `payments.view`, `subscriptions.view`, `entitlements.view`, `credentials.view`, `reports.download` | فحص في `StudentController`, `GradeController`, `PaymentRequestController`, `SubscriptionController`, `EntitlementController`, `CredentialController`, `ReportController` مقابل القائمة في `api/database/seeders/DatabaseSeeder.php:74-89` | **حتى الأدمن** يرى قوائم الطلاب والمدفوعات والأكواد فارغة |
| T-RBAC-02 | **P0** | C-01 | دورا `student` و `parent` بلا أي صلاحية؛ مسارات الطالب تتطلب `meetings.view` و `media.view` | `DatabaseSeeder.php:103-104` (لا `sync`)، `api/routes/api.php:222-232` | الطالب: الحصص المباشرة والفيديو = 403 = فارغ |
| T-RBAC-03 | **P0** | C-11 | المؤسسة الجديدة بلا roles ولا permissions ولا مستخدم | `api/app/Http/Controllers/Api/Platform/TenantController.php:87` (migrate فقط) | لا أحد يستطيع الدخول لمؤسسة جديدة |
| T-RBAC-04 | **P0** | C-02 | الـ frontend يحدد الدور من **أول** role بالاسم؛ `admin` (مدير المؤسسة) يُوجَّه لـ `/platform/dashboard`؛ أي `staff` = teacher | `web/src/context/auth-context.tsx:34-41, 96` | مدير المؤسسة يدخل لوحة المنصة؛ المساعد = مدرس |
| T-RBAC-05 | **P0** | C-06 | لا حماية مسارات: لا `middleware.ts`، ولا فحص في أي layout؛ أي مستخدم يفتح `/teacher/*` أو `/platform/*` بالرابط | `web/src/app/*/layout.tsx` (لا فحص `isAuthenticated`/role) | "كل الصفحات تظهر لكل الأدوار" |
| T-RBAC-06 | **P0** | C-10 | عقد `/auth/me` و `/auth/login`: `roles` = `string[]` و `permissions` منفصلة و `profile` بلا IDs؛ الـ frontend يتوقع `roles[].permissions[]` و `student.id` | `api/app/Http/Controllers/Api/Auth/MeController.php:24-51`، `LoginController.php:100-101` مقابل `web/src/types/index.ts:29` | `PermissionGate` لا يعمل أبدًا؛ صفحات الطالب تتوقف (`student/grades/page.tsx:20`) |
| T-RBAC-07 | P1 | C-01 | `PermissionGate` غير مستخدم في أي صفحة؛ قوائم التنقل ثابتة في كل layout | `web/src/components/ui/permission-gate.tsx` (0 استخدام) | لا فلترة لأي عنصر |
| T-RBAC-08 | P1 | C-04 | فحص ولي الأمر في التحليلات يستخدم `$user->parent` (العلاقة اسمها `parentProfile`) ← دائمًا false | `api/app/Http/Controllers/Api/Analytics/DashboardController.php:28` | ولي الأمر ممنوع من تحليلات ابنه |
| T-RBAC-09 | P1 | C-04 | صفحات ولي الأمر تجلب `GET /students` (تحتاج `students.view`) ← فارغة دائمًا؛ لا endpoint "أبنائي" | `web/src/app/parent/dashboard/page.tsx:24`، `parent/children/page.tsx:41` | تجربة ولي الأمر فارغة بالكامل |
| T-RBAC-10 | P1 | C-12 | لا API لإدارة الأدوار والصلاحيات (عرض، إنشاء custom role، تعيين للمستخدم) | `api/routes/api.php` (لا يوجد) | مخالفة FR-AUTHZ-003/004؛ لا يمكن التحكم من الواجهة |
| T-RBAC-11 | P1 | C-02 | لا role للمساعد، ولا لمدير المركز، ولا لمدير الفرع، ولا لمسؤول المالية؛ `staff_type` لا يُستخدم في القرار | `DatabaseSeeder.php:101-104` | تجربة المساعد (F6) ومدير المركز (F8) مستحيلة |
| T-RBAC-12 | P1 | C-06 | الـ modules (`tenant_features`) لا تُفحص في أي route ولا في الـ frontend | `api/app/Models/Tenant.php:84` (غير مستدعاة) | مؤسسة أونلاين ترى الحضور والقاعات |
| T-RBAC-13 | P2 | C-01 | أسماء الصلاحيات تختلف عن التوثيق (`credentials.create` vs `credentials.issue`، لا `attendance.correct`، لا `students.create/update/delete`) | Master §24 مقابل الـ seeder | الكتالوج غير متوافق مع المواصفات |

---

## C. الميزات الناقصة أو المحاكاة (Functional)

### C.1 المحتوى والدروس

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-01 | P1 | لا تعديل/حذف/ترتيب للدروس (فقط `POST`)؛ `lessons.update` مُنشأة ولا يستخدمها أي route | `api/routes/api.php:100-104` |
| T-FEAT-02 | P1 | لا Modules/Sections، لا نوع درس، لا مواد مرفقة (ملفات)، لا free preview، لا prerequisites | `api/database/migrations/tenant/2026_09_29_000003_create_education_tables.php` |
| T-FEAT-03 | P1 | لا تقدم تعلم ولا Video Events (FR-ONLINE-006، BR-025)؛ الإكمال حالة React تضيع عند التحديث | `web/src/app/student/courses/page.tsx:23` |
| T-FEAT-04 | P1 | لا Course Builder في الواجهة: إنشاء كورس + إنشاء درس نصي فقط | `web/src/app/teacher/courses/page.tsx:40,59` |
| T-FEAT-05 | P1 | لا صفحة/مسار تسجيل طالب في كورس (`enroll` غير مستخدمة في الواجهة) | `web/src/lib/education-api.ts:84` (0 استخدام) |

### C.2 Google Drive / الفيديو

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-06 | P1 | لا رفع حقيقي ولا OAuth؛ "الرفع" = تسجيل رابط؛ بدون رابط يُولّد ID عشوائي ← مشغل مكسور | `api/app/Domain/Integrations/Media/GoogleDriveVideoProvider.php:26` |
| T-FEAT-07 | P1 | لا تحقق من صلاحيات المشاركة في Drive؛ رابط `/preview` قابل للنسخ والمشاركة خارج المنصة | نفس الملف `:20` | 
| T-FEAT-08 | P1 | الطالب يحتاج `media.view` (غير ممنوحة) لجلب الفيديو؛ `embedUrl` بلا فحص entitlement | `api/routes/api.php:229-232`، `MediaController.php:110` |
| T-FEAT-09 | P2 | `getMediaEmbed` في الـ frontend غير مستخدمة؛ المشغل يستخدم `embed_url` المخزن مباشرة | `web/src/lib/integration-api.ts:85` |

### C.3 Google Meet / الحصص المباشرة

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-10 | P1 | Meet يولّد كود عشوائي محليًا — **الاجتماع غير موجود عند Google**؛ لا Calendar/Meet API | `api/app/Domain/Integrations/Meetings/GoogleMeetProvider.php:22, 47-60` |
| T-FEAT-11 | P1 | صفحة الطالب "فصل افتراضي" محاكاة كاملة (كاميرا، رفع يد، شات محلي) | `web/src/app/student/meetings/page.tsx` |
| T-FEAT-12 | P2 | `cancelMeeting` يرجع `true` بدون أي عملية | `GoogleMeetProvider.php` |

### C.4 الحضور و QR

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-13 | P1 | لا QR يُعرض للطالب (لا صفحة "بطاقتي")، لا QR للجلسة، لا ماسح كاميرا — حقل نصي ينتظر قارئ باركود | `web/src/app/teacher/attendance/page.tsx:248-270` |
| T-FEAT-14 | P1 | "التوكن الدوّار كل 30 ثانية" المذكور في الحالة غير موجود في الكود | `current-state.md` M15-002 مقابل الكود |
| T-FEAT-15 | P1 | لا API للفروع والقاعات (FR-OFFLINE-001/002)؛ لا إنشاء فصل/جلسة/إضافة طالب لفصل من الواجهة | `api/routes/api.php` (لا branches/classrooms)؛ `createSession`/`createClass` غير موجودة في `web/src/lib` |
| T-FEAT-16 | P1 | لا تصحيح حضور مع سجل تدقيق (`attendance.correct`)، لا أوضاع Open/Scheduled (FR-OFFLINE-005) | — |

### C.5 التقييم

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-17 | **P0** | لا Exam Builder: الواجهة لا تنشئ امتحانات ولا أسئلة (`createExam`/`addQuestion` غير مستخدمة)؛ الامتحان يُنشأ `is_published = true` تلقائيًا حتى بدون أسئلة | `ExamController.php:51`؛ `web/src/lib/assessment-api.ts:86` (0 استخدام) |
| T-FEAT-18 | P1 | لا تعديل/حذف سؤال، لا نوافذ زمنية، لا خلط، لا مراجعة نتيجة للطالب، لا تسليم ملفات للواجبات | — |
| T-FEAT-19 | P1 | لا نشر درجات من الواجهة (`publishGrades` غير مستخدمة) | `web/src/lib/assessment-api.ts` |

### C.6 الدفع والاشتراكات

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-20 | **P0** | الطالب لا يملك أي صفحة لعرض الباقات أو إرسال طلب دفع؛ لا client function لذلك | `web/src/app/student/*` (لا payments)؛ `web/src/lib/billing-api.ts` (لا create) |
| T-FEAT-21 | P1 | إثبات الدفع = نص `proof_url`؛ لا رفع ملف | `PaymentRequestController.php` validation |
| T-FEAT-22 | P1 | لا إدارة باقات في الواجهة (`getPackages` غير مستخدمة)؛ لا تعديل/أرشفة باقة في الـ API | — |
| T-FEAT-23 | P2 | اعتماد الدفع لا يرسل إشعارًا ولا يصدر credential (Master §40) | `PaymentReviewService.php` |

### C.7 المنصة والمؤسسات

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-24 | P1 | `/register-school` لا يستدعي أي API (`setTimeout` ثم نجاح) | `web/src/app/register-school/page.tsx:34` |
| T-FEAT-25 | P1 | معالج إنشاء المؤسسة: خطوات محاكاة بـ `setTimeout`، وعند فشل الـ API يضيف مؤسسة وهمية محليًا | `web/src/app/platform/tenants/page.tsx:70-110` |
| T-FEAT-26 | P1 | تعليق/تفعيل المؤسسة يغير الحالة محليًا فقط | `platform/tenants/page.tsx:154` |
| T-FEAT-27 | P1 | لا مقاييس منصة حقيقية (FR-ADMIN-001: عدد الطلاب، المدرسين، التخزين، الاستخدام) | `web/src/app/platform/dashboard/page.tsx:41` يعتمد على قائمة المؤسسات فقط |
| T-FEAT-27b | **P0** | لوحة المنصة تعرض **"HEALTHY"** عند فشل فحص الصحة (fallback ثابت)، و URL الـ API مكتوب `http://localhost:8000` | `web/src/app/platform/dashboard/page.tsx:31-39, 93` |

### C.8 الإشعارات والتقارير والتحليلات

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-FEAT-28 | P1 | لا شيء ينشئ إشعارًا؛ `notificationApi` غير مستخدم في أي صفحة؛ لا بريد (FR-NOTIFY-002) | `grep notify(` = 0 |
| T-FEAT-29 | P1 | التحليلات ترجع **100%** وهمية عند عدم وجود snapshot | `api/app/Http/Controllers/Api/Analytics/DashboardController.php:40-45` |
| T-FEAT-30 | P1 | صفحة تحليلات المدرس تستخدم UUID طالب ثابت في الكود | `web/src/app/teacher/analytics/page.tsx:19,33` |
| T-FEAT-31 | P1 | لا واجهة تقارير ولا metrics ولا audit logs رغم وجود الـ API | `web/src/lib` (لا clients) |
| T-FEAT-32 | P2 | التقارير متزامنة داخل الـ request (لا queue) — Master §49 | `ReportController.php:store` |
| T-FEAT-33 | P2 | AI Tutor ردود ثابتة؛ يجب إزالته أو تعليمه "تجريبي" | `web/src/app/student/courses/page.tsx:134` |

### C.9 إدارة المستخدمين

| ID | P | المشكلة |
|---|---|---|
| T-FEAT-34 | **P0** | لا API ولا واجهة لإنشاء/تعديل/تعليق: طالب، مدرس، مساعد، ولي أمر؛ لا ربط ولي أمر بطالب؛ لا تعيين أدوار؛ لا استيراد CSV |

---

## D. الواجهة (Frontend Quality / UX)

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-UX-01 | **P0** | 35 استدعاء `.catch(() => [])` ← 403/500 تظهر كـ "لا توجد بيانات" | `grep -c "catch(() =>" web/src/app` |
| T-UX-02 | P1 | Landing page غير موجودة: `/` = redirect إلى `/login` رغم ادعاء M15-003 | `web/src/app/page.tsx` |
| T-UX-03 | P1 | الثيم مثبّت dark؛ 263 `text-white` ثابتة ← light mode مكسور | `web/src/app/layout.tsx:19` |
| T-UX-04 | P1 | قيم وهمية في الـ layouts (أسماء، مدرسة، صف) | `web/src/app/student/layout.tsx:39`، `teacher-nav-layout.tsx` |
| T-UX-05 | P1 | لوحة المدرس: عدد "واجبات بانتظار التصحيح" = 0 ثابت | `web/src/app/teacher/dashboard/page.tsx:112` |
| T-UX-06 | P1 | God Pages (>15KB): payments 33KB، tenants 32KB، credentials 30KB، student/courses 29KB، student/dashboard 23KB، assessments 21KB | مخالفة Master §63 و Quality Gate §35 |
| T-UX-07 | P2 | Layouts مكررة وميتة: `components/layout/*-nav-layout.tsx` غير مستخدمة وتعتمد على classes غير معرّفة (`.app`, `.sd`, `.me`, `.av`) | `web/src/components/layout/` |
| T-UX-08 | P2 | `/components` (معرض المكونات) route عام في الإنتاج | `web/src/app/components/page.tsx` |
| T-UX-09 | P2 | لا Detail Pages (طالب/كورس/جلسة/مؤسسة) — كل شيء modal | Quality Gate §13 |
| T-UX-10 | P2 | لا breadcrumbs، لا تبديل ثيم، لا بحث عام، لا مركز إشعارات | — |
| T-UX-11 | P2 | `offline.html` غير مضاف لكاش الـ service worker (يعتمد على fallback داخلي) | `web/public/sw.js:4-7` |

---

## E. الاختبارات والجودة (QA / Evidence)

| ID | P | المشكلة | الدليل |
|---|---|---|---|
| T-QA-01 | **P0** | الاختبارات تنشئ صلاحياتها بنفسها (`students.view`…) ← تنجح بينما الـ seed الحقيقي يفشل | `api/tests/Feature/EducationGateTest.php:91-95` |
| T-QA-02 | **P0** | لا اختبار واحد يتأكد أن endpoints المنصة تتطلب مصادقة | `api/tests/Feature/PlatformTenantApiTest.php`، `SupportAccessGateTest.php` |
| T-QA-03 | P1 | صفر اختبارات frontend (unit / component / E2E) — لا توجد أي test dependency | `apps/web/package.json` |
| T-QA-04 | P1 | لا contract tests بين `openapi.yaml` والـ backend والـ frontend | — |
| T-QA-05 | P1 | الـ release gate لا يتحقق من سلوك المنتج (لا smoke على الـ seed، لا role matrix، لا visual QA) | `scripts/release-gate.ps1` |
| T-QA-06 | P2 | قواعد بيانات اختبار متروكة في `database/tenants/` (13 ملفًا بجانب `tenant_almustaqbal`: `tenant_auth-*`, `tenant_alpha`, `tenant_tenant-a`…) | `api/database/tenants/` |
