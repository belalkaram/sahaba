# System Gap Analysis & Recovery Program — 2026-10-30

> **الحالة:** AUDIT — مصدر الحقيقة الحالي للفجوات والخطة.
> **النطاق:** Backend (`apps/api`) + Frontend (`apps/web`) + التوثيق والحالة (`docs/`) مقارنة بـ `MASTER-SPECIFICATION.md` و `BRD-FULL.md` و `docs/frontend/UIUX-QUALITY-GATE.md`.
> **طريقة العمل:** قراءة مباشرة للكود (routes, controllers, models, migrations, seeders, tests, كل صفحات الـ frontend). كل ملاحظة تقنية لها دليل `file:line`.
> **ما لم يتم:** لم يُعَد تشغيل الاختبارات أو الـ build في هذه المراجعة. آخر تشغيل مسجل هو `release-evidence.json` (2026-10-30T18:13Z — 9/9 gates). نجاح هذه الـ gates **لا يتعارض** مع النتائج هنا، لأنها لا تختبر المسارات المكسورة (انظر T-QA-01).

## الملفات

| # | الملف | المحتوى |
|---|---|---|
| 1 | [`01-conceptual-problems.md`](01-conceptual-problems.md) | المشاكل النظرية / المعمارية (لماذا يحدث ما يحدث) |
| 2 | [`02-technical-findings.md`](02-technical-findings.md) | المشاكل التقنية بالأدلة، مصنفة بالخطورة |
| 3 | [`03-target-access-model.md`](03-target-access-model.md) | التصميم المستهدف للأدوار والصلاحيات والأقسام (Modules) والتنقل |
| 4 | [`04-capability-coverage-matrix.md`](04-capability-coverage-matrix.md) | كل متطلب في التوثيق ← Backend ← API ← Frontend ← الحالة الحقيقية |
| 5 | [`05-recovery-plan.md`](05-recovery-plan.md) | الخطة الكاملة بالترتيب، مع Definition of Done وطريقة التحقق لكل مرحلة |
| 6 | [`06-status-and-docs-corrections.md`](06-status-and-docs-corrections.md) | تصحيح ادعاءات الحالة والتوثيق المتعارض |

## الخلاصة التنفيذية

**الحكم:** المشروع **ليس PRODUCTION_READY**. الحالة الحقيقية:

| الطبقة | الحالة الحقيقية | السبب الرئيسي |
|---|---|---|
| Tenancy / DB isolation | IMPLEMENTED + VERIFIED جزئيًا | يعمل ومختبر |
| Control Plane (Platform/Support) | **BROKEN — ثغرة أمنية حرجة** | كل endpoints المنصة بدون أي authentication (T-SEC-01) |
| Authorization (RBAC/ABAC) | IMPLEMENTED شكليًا، **غير متسق تشغيليًا** | 7 صلاحيات تُفحص في الكود ولا تُنشأ أبدًا؛ الطالب وولي الأمر بلا صلاحيات؛ لا scopes؛ لا API لإدارة الأدوار |
| Billing → Entitlement → Access | النصف الأول فقط | الـ Entitlements تُنشأ ولا يستهلكها أي شيء — المحتوى مفتوح بدون اشتراك |
| Education / Content | Skeleton | Course → Lesson (نص) فقط؛ لا تعديل/حذف/ترتيب دروس؛ لا modules؛ لا مواد؛ لا تقدم مشاهدة |
| Integrations (Drive / Meet) | **SIMULATED** | Meet يولّد أكواد عشوائية غير موجودة عند Google؛ Drive "رفع" = تسجيل رابط |
| QR Attendance | **SIMULATED / غير آمن** | QR = كود الطالب الثابت؛ لا QR يُعرض؛ لا كاميرا؛ "التوكن الدوّار 30 ثانية" غير موجود |
| Frontend | **PARTIAL / DEMO** | لا حماية مسارات؛ الدور يُستنتج من أول role؛ عقد `/auth/me` لا يطابق الـ types؛ 35 خطأ مبتلع يحوّل 403 إلى "لا توجد بيانات" |
| الحالة والتوثيق | **غير موثوق** | ادعاءات متعارضة؛ Gates لا تختبر سلوك المنتج |

**بالأرقام:** 14 مشكلة نظرية (C-01..C-14)، و81 مشكلة تقنية موثقة بالأدلة: **19 P0** و47 P1 و15 P2. ومن 64 متطلبًا في مصفوفة التغطية: 6 فقط REAL، و21 PARTIAL، و18 BROKEN، و5 SIMULATED، و14 MISSING.

**لماذا "كل الصفحات بتظهر لكل الأدوار" و"مش لاقي الصلاحيات":** لأنه لا يوجد في الـ frontend أي حماية مسارات ولا فلترة تنقل بالصلاحيات، والـ `PermissionGate` الوحيد غير مستخدم ومكتوب على شكل بيانات لا يرسله الـ backend أصلًا، والـ backend نفسه لا يملك API لعرض أو إدارة الأدوار والصلاحيات. التفاصيل في C-01..C-04 و T-RBAC-*.

**لماذا "خصائص QR والدروس والدرايف مش موجودة بالكامل":** لأنها في الـ backend إما غير موجودة (تعديل الدروس، المواد، التقدم) أو محاكاة (Drive/Meet/QR)، وفي الـ frontend تُعرض كمحاكاة مقنعة بصريًا. التفاصيل في C-07, C-08 و T-FEAT-*.

## من أين نبدأ (الإجابة المختصرة)

1. **R0 — احتواء أمني فوري (يوم–يومين):** قفل endpoints المنصة، إخفاء إجابات الامتحان، إغلاق IDOR في المدفوعات والـ audit logs. لا شيء آخر قبل هذا.
2. **R1 — نموذج الوصول (Access Model):** كتالوج صلاحيات واحد، أدوار النظام الثمانية، scopes، API لإدارة الأدوار، `/auth/me` غني، و**Route Guards + تنقل مبني على الصلاحيات والأقسام** في الـ frontend. هذا يحل الشكوى الأساسية.
3. **R2 — إغلاق سلسلة الدفع ← الوصول (Entitlement enforcement).**
4. **R3 — المحتوى التعليمي الحقيقي (Course Builder + Lesson types + Drive حقيقي + Progress).**
5. **R4 — الحضور الحقيقي (QR آمن + ماسح كاميرا + فروع وقاعات).**
6. بعدها تجارب الأدوار (R5..R8) ثم التحقق والإطلاق (R9).

التفاصيل الكاملة والترتيب في [`05-recovery-plan.md`](05-recovery-plan.md).
