# تقرير نظافة التوثيق — 2026-11-05

> **النوع:** تقرير فحص فقط. لم يُحذف أو يُنقل أي ملف. كل بند يحتاج موافقة المالك قبل التنفيذ (مرشّح لمهمة `R9-7 Repository hygiene` و`R9-8 Documentation & status`).
> **طريقة الفحص:** مقارنة `md5sum` و`diff -rq` لكل ملفات `*.md` (159 ملفًا خارج `node_modules`)، ومراجعة المحتوى يدويًا.

---

## 1. ملفات مكررة (تطابق كامل أو شبه كامل)

| # | الملف الأصلي (يبقى) | النسخة المكررة | نوع التكرار | التوصية |
|---|---|---|---|---|
| D-1 | `docs/master/MASTER-SPECIFICATION.md` | `docs/phases/phase-k.md` | تطابق 100% (نفس md5) | يُحذف `phase-k.md` أو يُستبدل بسطر يحيل إلى الـMaster. |
| D-2 | `docs/requirements/PRODUCT-DEFINITION.md` | `docs/phases/phase-a.md` | تطابق 100% | يبقى ملف واحد (يُقترح `requirements/`) والآخر إحالة. |
| D-3 | `docs/requirements/BRD-FULL.md` | `docs/phases/phase-b.md` | تطابق 100% | نفس D-2. |
| D-4 | `docs/phases/phase-h.md` | `docs/phases/phase-h-rendered-document.md` | نفس المحتوى + غلاف `:::writing` | يُحذف الـrendered (`00-INDEX` يقول أصلًا: عدّل `phase-h.md` فقط). |
| D-5 | `prompts/recovery/**` + `docs/audit/2026-10-30-system-gap-analysis/**` + `CLAUDE.md` | `lms-recovery/**` (كل الشجرة: 27 ملفًا) | **نسخة قديمة**. الملفات المختلفة: `03-PROGRESS-TRACKER.md` (حالات قديمة، مثلًا R7E لسه TODO)، `01-DECISIONS.md` (ناقصة OD-16..OD-22)، `04-capability-coverage-matrix.md` | **أخطر تكرار**: وكيل AI ممكن يقرأ التراكر القديم ويبني عليه. يُحذف مجلد `lms-recovery/` كله. `docs/recovery-reports/R0.md:144` يشير إليه ويحتاج تصحيحًا. |
| D-6 | `apps/api/AGENTS.md` | `apps/api/CLAUDE.md` | تطابق 100% (47 سطرًا) | يصبح `CLAUDE.md` سطرًا واحدًا `@AGENTS.md` زي `apps/web/CLAUDE.md`. |
| D-7 | `docs/frontend/frontend-recovery-plan.md` + `docs/design/UI-UX-REDESIGN-PLAN.md` | `LMS_Frontend_Recovery_and_UIUX_Quality_Gate.md` (في الجذر، 1498 سطرًا) | تداخل في الموضوع (ثلاث خطط للواجهة) | يُنقل ملف الجذر إلى `docs/frontend/` ويُعلَّم «مرجع / Quality Gate» مع تحديث الإحالات (`05-recovery-plan.md`، `R7A`، `frontend-recovery-plan.md`). |
| D-8 | `docs/architecture/*.md` (7–23 سطرًا لكل ملف) | أقسام Master §10–§36 | ملفات الهيكلة ملخصات قصيرة جدًا ومكررة من الـMaster | إما تُملأ أو تُستبدل بإحالة لأقسام الـMaster. |

## 2. ملفات «مولّدة / مستخرجة» ليست توثيقًا فعليًا

| الملف | الحجم | الملاحظة | التوصية |
|---|---|---|---|
| `source/ALL-DISTINCT-STRINGS.md` | 53,709 سطرًا | مخرجات استخراج من محادثة (RSC payload) | تُنقل خارج الريبو أو إلى أرشيف مضغوط؛ تملأ نتائج البحث وتشوّش وكلاء الـAI. |
| `source/HIDDEN-CONVERSATION-LONG-CONTENTS.md` | 39,802 سطرًا | نفس الشيء | نفس الشيء. |
| `source/HIDDEN-RSC-DECODED.txt`، `ALL-SERIALIZED-STRINGS.jsonl` | — | بيانات خام | نفس الشيء. |
| `MANIFEST.md`، `PROJECT-FILE-LIST.txt` | — | يصفان حزمة البداية (83 ملفًا وكل `apps/*` فاضية) | **قديمان ومضلّلان**: يُحذفان أو يُنقلان إلى `docs/phase-zero/`. |
| `README.md` (الجذر) | 34 سطرًا | يصف «حزمة bootstrap» وليس المنتج «سحابة» | يُعاد كتابته: اسم المنتج، التشغيل، روابط التوثيق، حالة RECOVERY. |

## 3. توثيق ناقص (هياكل فاضية لم تُكتب)

| الملف | الحالة |
|---|---|
| `docs/api/README.md`، `docs/security/README.md`، `docs/testing/README.md`، `docs/requirements/README.md` | 3 أسطر فقط (عنوان + وصف). لا يوجد عقد API موثّق (OpenAPI) رغم وجود أكثر من 100 route. |
| `docs/domains/{authorization,classroom,communication,platform,support}/README.md` | قالب فاضي («This directory is reserved…»). مع أن الكود موجود: `RoleController`، `Classroom`/`Branch`، الإشعارات (R8-1)، `platform/*`، جلسات الدعم. |
| `docs/project-management/{pending,blocked,deferred,risks}.md` | «No entries recorded yet»، مع أن التراكر فيه BLOCKED (R4-3، R8-6) وDEFERRED (R5-3). |
| `docs/project-management/roadmap.md`، `milestones.md`، `current-state.md` | من خطة ما قبل Recovery. `00-INDEX` يعتبرها «تاريخية» لكن لا تحمل علامة تقول ذلك. |
| `docs/decisions/` | فيه ADR واحد فقط (ADR-001)، مع أن قرارات OD-3 (Drive per tenant) وOD-5 (Meet) وOD-9 (platform auth) وOD-22 (اسم المنتج) قرارات هيكلية. |

## 4. تناقضات بين التوثيق والكود (مرتبطة بالخطة الجديدة)

| # | التناقض | الدليل |
|---|---|---|
| X-1 | أنواع المستأجر: الـSpec والـdomain doc يقولان `individual_teacher` / `educational_center`، والتسجيل الذاتي يرسل `school\|center\|tutor\|academy\|university`، وفورم «إنشاء مؤسسة» في لوحة المنصة يرسل **النص العربي** `'مدرسة خاصة / دولية'` كقيمة `type`. | `docs/domains/tenancy/README.md` §3، `api/database/migrations/2026_09_29_000001_create_tenants_tables.php:16`، `SchoolRegistrationController` (`in:school,center,tutor,academy,university`)، `apps/web/src/app/platform/tenants/page.tsx:27`، `TenantController` (`'type' => 'required\|string'` بدون قائمة مسموحة). |
| X-2 | رسائل «تواصل معنا» من اللاندينج تظهر داخل صفحة **الإعدادات** في لوحة المنصة، وليس لها صفحة طلبات خاصة. | `apps/web/src/app/platform/settings/page.tsx:17`. |
| X-3 | التراكر يقول R5-6 «Mobile scanner» PARTIAL، والماسح يعتمد على `BarcodeDetector` فقط. في Safari على iPhone وفي Firefox لا يوجد بديل، فيظهر الإدخال اليدوي وحده. | `apps/web/src/app/teacher/attendance/scan/[sessionId]/page.tsx:217`. |
| X-4 | `docs/recovery-reports/R0.md:144` يشير إلى `lms-recovery/prompts/recovery/03-PROGRESS-TRACKER.md` (النسخة القديمة). | — |

## 5. ترتيب التنظيف المقترح (بعد موافقة المالك)

1. حذف `lms-recovery/` (D-5) وتصحيح X-4. **أولوية عالية** لأنه يضلّل الوكلاء.
2. حذف أو تحويل `phase-k`، `phase-a`، `phase-b`، `phase-h-rendered-document` إلى إحالات (D-1..D-4)، وتحديث `docs/00-INDEX.md`.
3. توحيد `apps/api/CLAUDE.md` (D-6).
4. أرشفة `source/` و`MANIFEST.md` و`PROJECT-FILE-LIST.txt`، وإعادة كتابة `README.md`.
5. نقل ملف الـQuality Gate من الجذر إلى `docs/frontend/` (D-7).
6. ملء الـdomain docs الفاضية تدريجيًا مع كل مهمة تلمس الدومين، بدل كتابتها كلها دفعة واحدة.
7. ملء `pending`/`blocked`/`deferred`/`risks` من التراكر.
