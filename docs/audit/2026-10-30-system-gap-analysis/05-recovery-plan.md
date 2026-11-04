# 05 — خطة الاستعادة الكاملة (Recovery Program R0 → R9)

> **تحل محل:** جدول الحالة في `docs/frontend/frontend-recovery-plan.md` (F0–F12). خطة F تبقى مرجعًا للتصميم البصري، لكن الترتيب والحالة هنا.
> **المبدأ:** الأساس قبل الشكل. لا يُعاد تصميم أي شاشة قبل أن تكون الصلاحيات والعقد والبيانات تحتها حقيقية — وإلا نكرر نفس المشكلة: واجهة جميلة فوق بيانات فارغة.
> **قاعدة الإنجاز:** لا مهمة "DONE" بدون: كود + اختبار يثبت السلوك على بيانات الـ seed الحقيقية + تحديث المصفوفة `04-…` + دليل (أمر وناتجه أو لقطة).

## نظرة عامة على الترتيب

```text
R0  احتواء أمني فوري                         ← يجب أولًا (P0 أمني)
R1  نموذج الوصول: أدوار، صلاحيات، أقسام، تنقل ← يحل الشكوى الأساسية
R2  إدارة المستخدمين + تجهيز المؤسسة          ← بدونه لا يمكن تشغيل المنصة
R3  الدفع ← الوصول (Entitlement enforcement)
R4  المحتوى التعليمي: Course Builder + Drive + Progress
R5  الحضور الحقيقي: QR آمن + ماسح + فروع
R6  التقييم: Exam Builder + توقيت سيرفر
R7  تجارب الأدوار (Student / Staff / Parent / Admin / Platform) — إعادة تصميم UI/UX
R8  الإشعارات، التقارير، التحليلات الحقيقية، Meet الحقيقي
R9  التحقق والإطلاق: E2E، مصفوفة الأدوار، Visual QA، Release Gate حقيقي
```

الاعتماديات: `R0 → R1 → R2 → (R3, R4, R5, R6 بالتوازي جزئيًا) → R7 → R8 → R9`. R7 يبدأ لكل تجربة بمجرد اكتمال الدومين تحتها.

---

## R0 — احتواء أمني فوري

**الهدف:** إغلاق كل ثغرة P0 بدون إعادة تصميم.

| # | المهمة | يغلق |
|---|---|---|
| R0-1 | وضع كل `/tenants*` و `/platform/*` خلف middleware مؤقت (`platform.auth` بتوكن منصة من `.env` أو مستخدم منصة مبدئي) — رفض افتراضي | T-SEC-01 |
| R0-2 | `Question::$hidden = ['correct_answer']` + جعل `exams.index` لا يحمّل الأسئلة للطالب + صلاحية `exams.view` | T-SEC-04 |
| R0-3 | فحص ملكية/صلاحية في `PaymentRequestController@show` | T-SEC-05 |
| R0-4 | `tenant.can:audit.view` على `/audit-logs` | T-SEC-06 |
| R0-5 | إيقاف تمرير توكن الدعم في URL (one-time code أو POST) | T-SEC-03 |
| R0-6 | إصلاح استبدال الجهاز: لا fingerprint عشوائي — الاستبدال يُلغي الربط والطالب يربط جهازه الجديد عند أول دخول | T-SEC-12 |
| R0-7 | لوحة المنصة: إزالة fallback "HEALTHY" وإظهار حالة الفشل الحقيقية؛ URL من env | T-FEAT-27b |
| R0-8 | CI: إزالة `|| true` من audits (أو تحويلها لـ warning موثق كقرار) | T-SEC-14 |

**التحقق (DoD):**
- اختبارات Feature جديدة: كل route منصة بدون توكن ← 401؛ طالب يطلب exams ← لا يوجد `correct_answer` في الـ JSON؛ طالب يطلب payment لطالب آخر ← 403؛ طالب يطلب audit-logs ← 403.
- PHPUnit كامل أخضر.

---

## R1 — نموذج الوصول (الأولوية القصوى بعد الأمان)

**الهدف:** المستخدم يرى بالضبط ما يحق له، ويمكن التحكم في ذلك من الواجهة. التصميم في `03-target-access-model.md`.

### R1-A — Backend

| # | المهمة | يغلق |
|---|---|---|
| R1-A1 | ADR: نموذج الوصول (Planes، Experiences، System Roles، Scopes، Modules) | C-01..C-06 |
| R1-A2 | كتالوج الصلاحيات (ملف واحد) + اختبار CI يفشل عند فحص صلاحية خارج الكتالوج | T-RBAC-01, 13, T-QA-01 |
| R1-A3 | System roles الثمانية + ربطها بالصلاحيات من الكتالوج (seeder + provisioning يقرآن نفس المصدر) | T-RBAC-02, 03, 11 |
| R1-A4 | Scope resolver + قواعد ABAC: own course/class، assigned students/classes، branch، linked children، self | T-SEC-08, 09, T-RBAC-08 |
| R1-A5 | Middleware `tenant.module:{key}` + تطبيقه على كل مجموعات الـ routes | T-RBAC-12 |
| R1-A6 | `/auth/me` بالعقد الجديد (persona، profiles بـ IDs، permissions→scope، modules، experience) | T-RBAC-06 |
| R1-A7 | API إدارة الأدوار: `GET /roles`, `POST /roles`, `PUT /roles/{id}`, `GET /permissions` (الكتالوج)، `PUT /users/{id}/roles`، `GET /users/{id}/effective-permissions` + Audit | T-RBAC-10 |
| R1-A8 | Endpoints "خاصتي": `/me/children`, `/me/courses`, `/me/classes`, `/me/students` بدل جلب كل شيء ثم الفلترة | T-RBAC-09 |
| R1-A9 | Platform identity: `platform_users` + guard + أدوار منصة؛ استبدال حل R0-1 المؤقت | C-03 |

### R1-B — Frontend

| # | المهمة | يغلق |
|---|---|---|
| R1-B1 | توليد types من OpenAPI (أو تحديثها يدويًا مؤقتًا لتطابق العقد الجديد) | C-10 |
| R1-B2 | `AuthContext` جديد: يعتمد `experience` و `permissions` من الـ backend؛ حذف `resolveRole` و `switchRole` | T-RBAC-04, T-SEC-15 |
| R1-B3 | Navigation Registry واحد (experience + module + permissions) | T-RBAC-07 |
| R1-B4 | Route Guards: `middleware.ts` + guard في كل layout + صفحة 403 حقيقية | T-RBAC-05 |
| R1-B5 | `useCan()` + `<Can>` للأزرار والأفعال | T-RBAC-07 |
| R1-B6 | طبقة data-fetching موحدة بحالات `loading/empty/forbidden/error`؛ حذف كل `.catch(() => [])` (35) | T-UX-01 |
| R1-B7 | معالجة 401 عالميًا (خروج + رسالة) | T-SEC-13 |
| R1-B8 | Admin → "الأدوار والصلاحيات" + "المستخدمين ← الأدوار" + Effective Permissions | FR-AUTHZ-004 |

**التحقق (DoD):**
- **Role Matrix Test (backend):** لكل دور نظامي × كل endpoint ← النتيجة المتوقعة (200 / 403 / scoped) — مصفوفة مولّدة من الكتالوج، على بيانات الـ seed الحقيقية.
- **Role Matrix Test (E2E):** لكل دور: تسجيل دخول ← التنقل يحتوي العناصر المتوقعة فقط ← فتح route غير مسموح بالرابط ← 403.
- مؤسسة online-only لا ترى أي عنصر offline.

---

## R2 — إدارة المستخدمين وتجهيز المؤسسة

| # | المهمة | يغلق |
|---|---|---|
| R2-1 | API: CRUD للطلاب، المدرسين/الموظفين، أولياء الأمور، ربط ولي أمر↔طالب، تعليق/تفعيل، إعادة تعيين كلمة مرور | T-FEAT-34 |
| R2-2 | استيراد CSV للطلاب (مع تقرير أخطاء) | — |
| R2-3 | API الفروع والقاعات | T-FEAT-15 |
| R2-4 | `TenantProvisioningService`: إنشاء ← migrate ← seed أدوار من الكتالوج ← مالك ← تفعيل أقسام ← audit (في transaction قابلة للتراجع) | T-RBAC-03, C-11 |
| R2-5 | تسجيل المؤسسة الذاتي الحقيقي (`/register-school` ← API عام مع rate limit وتحقق بريد) | T-FEAT-24 |
| R2-6 | Platform Console: تعليق/تفعيل حقيقي، تعديل الأقسام، Support Session كاملة (طلب/إنهاء/انتهاء/سجل) | T-FEAT-25, 26, T-SEC-02 |
| R2-7 | Frontend: Admin → المستخدمون (قائمة، بحث، فلترة، صفحة تفاصيل، إنشاء، أدوار)، الفروع، الإعدادات، الأقسام | — |

**التحقق:** إنشاء مؤسسة جديدة من الواجهة ← تسجيل دخول المالك ← إنشاء مدرس ومساعد وطالب وولي أمر ← كل واحد يدخل ويرى تجربته الصحيحة. (E2E)

---

## R3 — الدفع ← الوصول

| # | المهمة | يغلق |
|---|---|---|
| R3-1 | `ContentAccessPolicy`: Entitlement + Enrollment + حالة المحتوى (draft/published/free preview) — يُستدعى من كل endpoint محتوى (courses, lessons, media embed, exams, meetings) | T-SEC-07, C-05 |
| R3-2 | إلغاء self-enroll المفتوح: التسجيل يتم عبر Entitlement أو بواسطة موظف بصلاحية | T-SEC-07 |
| R3-3 | رفع ملف إثبات الدفع (storage خاص + رابط موقّع مؤقت) | T-FEAT-21 |
| R3-4 | API: تعديل/أرشفة الباقات، منح/سحب Entitlement يدويًا مع سبب | T-FEAT-22 |
| R3-5 | Frontend الطالب: الباقات ← طلب دفع ← حالة الطلب ← اشتراكاتي ووصولي | T-FEAT-20 |
| R3-6 | Frontend الإدارة: إدارة الباقات؛ قائمة مراجعة المدفوعات تعمل (بعد R1) | — |
| R3-7 | اعتماد الدفع ← إشعار (بعد R8) + إصدار credential اختياري حسب الإعداد | T-FEAT-23 |

**التحقق:** طالب بدون اشتراك ← لا يرى محتوى الكورس (403 + شاشة "اشترك") ← يرسل طلب دفع ← المالية تعتمد ← الطالب يرى المحتوى فورًا. (E2E)

---

## R4 — المحتوى التعليمي الحقيقي

| # | المهمة | يغلق |
|---|---|---|
| R4-1 | نموذج: `course_modules` (أقسام الكورس) → `lessons` بنوع (video / document / text / assignment / exam / live) + `lesson_materials` + `is_free_preview` + `sort_order` | T-FEAT-02 |
| R4-2 | API كامل للدروس: update / delete / reorder / publish، ونفسه للـ modules | T-FEAT-01 |
| R4-3 | Google Drive حقيقي (قرار ADR مطلوب): OAuth للمؤسسة أو Service Account، رفع resumable، فحص صلاحيات المشاركة، تخزين `file_id` فقط، توليد embed عند الطلب بعد فحص الوصول | T-FEAT-06, 07, 08 |
| R4-4 | Video Events + Learning Progress (منفصلان — Master §27): `video_events` (start, heartbeat, seek, end) ← تجميع إلى `lesson_progress` (%, position, completed_at) | T-FEAT-03 |
| R4-5 | Frontend — Course Builder للمدرس: شجرة modules/lessons بالسحب، محرر درس حسب النوع، رفع/ربط فيديو، مواد، معاينة كطالب | T-FEAT-04 |
| R4-6 | Frontend — Course Player للطالب: تنقل الدروس، استكمال من آخر موضع، المواد، التقدم الحقيقي، علامة مائية | — |
| R4-7 | إزالة AI Tutor المحاكى أو تعليمه بوضوح "قريبًا" | T-FEAT-33 |

**التحقق:** مدرس يبني كورس بقسمين و4 دروس (فيديو Drive حقيقي + PDF) ← طالب مشترك يشاهد نصف الفيديو ← يغلق ويفتح من جهاز آخر ← يستكمل من نفس الموضع ← التقدم يظهر للمدرس.

---

## R5 — الحضور الحقيقي و QR

| # | المهمة | يغلق |
|---|---|---|
| R5-1 | QR الطالب = توكن opaque موقّع وقصير العمر (أو مرتبط بالـ credential) — ليس `student_code` | T-SEC-10 |
| R5-2 | Scan API: تحقق (المؤسسة، الطالب، الجلسة مفتوحة، الطالب في الفصل، صلاحية الماسح بالـ scope) + نتيجة حتمية للتكرار + audit | FR-OFFLINE-008 |
| R5-3 | وضع "QR الجلسة" (الطالب يمسح كود الجلسة الدوّار من هاتفه) — إن تم اعتماده في ADR | T-FEAT-14 |
| R5-4 | تصحيح الحضور بسبب + سجل، وأوضاع Open/Scheduled | T-FEAT-16 |
| R5-5 | Frontend — صفحة "بطاقتي" للطالب (QR + تحديث تلقائي) | T-FEAT-13 |
| R5-6 | Frontend — ماسح كاميرا للموبايل (Mobile-first، اهتزاز/صوت، وضع بدون إنترنت مؤقت مع مزامنة) | FR-OFFLINE-007 |
| R5-7 | Frontend — إدارة الفروع/القاعات/الفصول/الجلسات (إنشاء، جدولة، إضافة طلاب) | T-FEAT-15 |

**التحقق:** مساعد بهاتف يمسح QR طالب في جلسة مفتوحة ← تسجيل؛ مسح نفس الطالب مرة ثانية ← رسالة "مسجل مسبقًا"؛ طالب من فصل آخر ← رفض؛ لقطة شاشة لـ QR منتهي ← رفض.

---

## R6 — التقييم

| # | المهمة | يغلق |
|---|---|---|
| R6-1 | Exam lifecycle: draft ← published (يتطلب أسئلة) ← نافذة زمنية؛ إلغاء `is_published = true` التلقائي | T-FEAT-17 |
| R6-2 | توقيت السيرفر: `expires_at` للمحاولة، رفض الإجابات بعدها، تسليم تلقائي | T-SEC-11 |
| R6-3 | API أسئلة: تعديل/حذف/ترتيب/بنك أسئلة | T-FEAT-18 |
| R6-4 | تسليم ملفات للواجبات | T-FEAT-18 |
| R6-5 | Frontend — Exam Builder + Assignment Builder + صندوق التصحيح + نشر الدرجات | T-FEAT-17, 19 |
| R6-6 | Frontend — مراجعة النتيجة للطالب بعد النشر | — |

---

## R7 — تجارب الأدوار (UI/UX Recovery الفعلي)

> هنا يُطبق `LMS_Frontend_Recovery_and_UIUX_Quality_Gate.md` بالكامل — **فوق** دومين حقيقي.

| # | المهمة | يغلق |
|---|---|---|
| R7-0 | Design System: tokens حقيقية لـ light/dark (إزالة 263 `text-white`)، تبديل ثيم، primitives الناقصة (DataTable, FilterBar, Pagination, Timeline, Calendar, Toast, ConfirmDialog, FileUpload, Breadcrumbs) | T-UX-03, 10 |
| R7-1 | App Shell واحد لكل التجارب (حذف الـ layouts المكررة والميتة)، Navbar بإشعارات وبحث ومحوّل مؤسسة | T-UX-07 |
| R7-2 | تفكيك God Pages إلى features (`features/payments/…`) — لا صفحة > 300 سطر | T-UX-06 |
| R7-3 | Detail Pages: الطالب، الكورس، الجلسة، المؤسسة، طلب الدفع | T-UX-09 |
| R7-4 | Student Experience (Master §70) | — |
| R7-5 | Staff Experience — مدرس + مساعد + مالية (Master §71-72) | F5, F6 |
| R7-6 | Parent Experience (Master §73) | F7 |
| R7-7 | Admin (مدير المؤسسة/المركز) Experience | F8 |
| R7-8 | Platform Console + Support (Master §74) | F9 |
| R7-9 | Landing page حقيقية على `/` + الصفحات العامة | T-UX-02 |
| R7-10 | إزالة كل القيم الوهمية والـ fallbacks الثابتة و `/components` من الإنتاج | T-UX-04, 05, 08, T-FEAT-30 |

**DoD لكل شاشة:** القائمة الـ 15 في Quality Gate §5 + لقطات desktop/mobile × light/dark + حالة forbidden.

---

## R8 — الإشعارات، التقارير، التحليلات، Meet

| # | المهمة | يغلق |
|---|---|---|
| R8-1 | Domain events (PaymentApproved, GradePublished, SessionScheduled, …) ← Notification service ← قنوات (in-app، email) | T-FEAT-28 |
| R8-2 | مركز إشعارات في الواجهة | T-FEAT-28 |
| R8-3 | Queue حقيقي (database/redis) + jobs للتقارير ولحساب الـ snapshots | T-FEAT-32 |
| R8-4 | إزالة الـ 100% الوهمية: "لا توجد بيانات بعد" بدل أرقام | T-FEAT-29 |
| R8-5 | واجهات التقارير والـ metrics وسجل التدقيق | T-FEAT-31 |
| R8-6 | Google Meet حقيقي (Calendar API conferenceData أو Meet REST API) — ADR مطلوب؛ إزالة الفصل الافتراضي المحاكى | T-FEAT-10, 11 |
| R8-7 | Platform metrics API (عدد الطلاب/المدرسين/التخزين/النشاط لكل مؤسسة — مجمعة دون خرق الخصوصية) | T-FEAT-27 |

---

## R9 — التحقق والإطلاق

| # | المهمة | يغلق |
|---|---|---|
| R9-1 | Playwright E2E: سيناريو لكل دور + الـ flows الحرجة (R2, R3, R4, R5 أعلاه) | T-QA-03 |
| R9-2 | Contract tests: OpenAPI ↔ Laravel responses ↔ TS types | T-QA-04 |
| R9-3 | Role Matrix suite (من R1) جزء من CI | T-QA-01, 02 |
| R9-4 | Visual QA: لقطات تلقائية لكل route × دور × (mobile/desktop) × (light/dark) | Quality Gate §38 |
| R9-5 | Accessibility (axe) على كل route | Quality Gate §19 |
| R9-6 | Release gate جديد = كل ما سبق + المصفوفة `04-…` بدون BROKEN/SIMULATED في نطاق الإصدار | T-QA-05 |
| R9-7 | تنظيف `database/tenants/` من قواعد الاختبار وإضافتها لـ `.gitignore` | T-QA-06 |

---

## نقطة البداية الآن (الأسبوع الأول)

1. **اليوم 1–2:** R0 كاملًا (8 مهام صغيرة، كلها محلية في الكود الحالي).
2. **اليوم 2:** كتابة ADR نموذج الوصول (R1-A1) ومراجعته — **قرار مطلوب منك** على: قائمة الأدوار النظامية، وهل المدرس/المساعد تجربة واحدة `/staff`، وأسماء الأقسام.
3. **اليوم 3–5:** R1-A2 → R1-A3 → R1-A6 (الكتالوج، الأدوار، `/auth/me`)، ثم R1-B2 → R1-B4 (AuthContext، Registry، Guards).

بعد هذا الأسبوع: كل مستخدم يرى فقط ما يخصه، والصفحات التي كانت تظهر فارغة ستعرض بياناتها أو رسالة "لا صلاحية" واضحة.

## القرارات المفتوحة (تحتاج قرارك قبل التنفيذ)

| # | القرار | يؤثر على |
|---|---|---|
| OD-1 | قائمة الأدوار النظامية النهائية (المقترح: 8 في `03-…` §3) | R1 |
| OD-2 | تجربة واحدة للموظفين `/staff` أم تجارب منفصلة للمدرس والمساعد | R1, R7 |
| OD-3 | Google Drive: OAuth لكل مؤسسة أم Service Account للمنصة | R4 |
| OD-4 | QR: الماسح عند المساعد (QR الطالب) أم عند الطالب (QR الجلسة) أم الاثنين | R5 |
| OD-5 | Google Meet: Calendar API أم Meet REST API، وحساب المؤسسة أم المنصة | R8 |
| OD-6 | AI Tutor: إزالة أم تأجيل بعلامة "قريبًا" أم تنفيذ حقيقي | R4 |
| OD-7 | هل المدرس يرى المدفوعات افتراضيًا أم فقط دور `finance` | R1 |
