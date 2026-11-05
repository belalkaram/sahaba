# تنظيف التوثيق — 2026-11-05

> **الحالة:** تم التنفيذ بموافقة المالك («امسحها بس بعد الفحص الجيد»).
> **الفحص:** مقارنة `md5sum` و`diff -rq` لكل ملفات `*.md` (159 ملفًا)، ومراجعة الفروقات سطرًا بسطر للملفات اللي فيها اختلاف، والبحث عن أي إحالة للملفات في الكود والسكربتات والـCI قبل الحذف.
> **الاسترجاع:** كل ملف محذوف موجود في تاريخ git (`git show <commit>^:<path>`).

## 1. ما تم حذفه

| الملف / المجلد | سبب الحذف | الفحص قبل الحذف |
|---|---|---|
| `lms-recovery/` (27 ملفًا) | نسخة **قديمة** من `prompts/recovery/` و`docs/audit/2026-10-30-*` و`CLAUDE.md`. خطر لأن وكلاء الـAI ممكن يقرأوا التراكر القديم. | `diff -rq`: 24 ملفًا متطابقة. الـ3 المختلفة (`03-PROGRESS-TRACKER`، `01-DECISIONS`، `04-capability-coverage-matrix`) كلها **أقدم** من النسخة الحالية: الحالية فيها OD-16..OD-22 والحالات المحدّثة. لا يوجد محتوى فريد. |
| `docs/phases/phase-k.md` | مطابق 100% لـ`docs/master/MASTER-SPECIFICATION.md` | نفس md5 |
| `docs/phases/phase-a.md` | مطابق 100% لـ`docs/requirements/PRODUCT-DEFINITION.md` | نفس md5 |
| `docs/phases/phase-b.md` | مطابق 100% لـ`docs/requirements/BRD-FULL.md` | نفس md5 |
| `docs/phases/phase-h-rendered-document.md` | نفس `phase-h.md` + سطر غلاف `:::writing` | `diff`: الفرق سطر الافتتاح والإغلاق فقط |
| `source/` (6 ملفات، حوالي 5.5MB، حوالي 93 ألف سطر) | أرشيف خام لمحادثة ChatGPT الأصلية. كل محتواه المقروء اتنقل لـ`docs/phases` و`docs/requirements` (حسب `source/FINAL-EXTRACTION-AUDIT.md` نفسه) | لا يوجد كود أو سكربت يقرأ منه. الإحالة الوحيدة كانت في `README.md`، واتصلحت. |
| `MANIFEST.md`، `PROJECT-FILE-LIST.txt` | بيوصفوا حزمة البداية (83 ملفًا، و`apps/*` فاضية). غلط تمامًا الآن | لا إحالات خارج نفسهم |
| `prompts/START-M0.md`، `docs/phase-zero/PHASE-0-M0-REPOSITORY-BOOTSTRAP.md` | أوامر بدء M0 (Status: READY TO IMPLEMENT)، وM0 خلص من زمان. مضلّلة لأي وكيل جديد | لا إحالات (التاريخ في `implementation-ledger.md`) |
| `docs/project-management/roadmap.md`، `milestones.md` | خطة M0–M14 قبل Recovery. اتلغت بالـaudit، والمحتوى موجود في `current-state.md` و`implementation-ledger.md` | لا إحالات خارج `00-INDEX` |

## 2. ما تم نقله أو تعديله

| من | إلى | ملاحظة |
|---|---|---|
| `LMS_Frontend_Recovery_and_UIUX_Quality_Gate.md` (الجذر) | `docs/frontend/UIUX-QUALITY-GATE.md` | اتحدّثت كل الإحالات: `05-recovery-plan.md`، `audit README`، `R7A`، `frontend-recovery-plan.md`. |
| `apps/api/CLAUDE.md` (نسخة من `AGENTS.md`) | سطر واحد `@AGENTS.md` | زي `apps/web/CLAUDE.md`. |
| `README.md` | اسم المنتج والحالة ورابط الفهرس | اتشال كلام «حزمة الاستخراج». |
| `docs/00-INDEX.md` | إعادة كتابة | ملف واحد معتمد لكل محتوى، وخريطة Phase A/B/K لملفاتها. |
| `docs/recovery-reports/R0.md:144` | يشير للتراكر الحالي | كان بيشير لـ`lms-recovery/`. |
| `project-management/{pending,blocked,deferred,risks}.md` | اتملت من التراكر والفحص الجديد | كانت «No entries recorded yet». |

## 3. ما اتساب عن قصد (وليه)

| الملف | السبب |
|---|---|
| `docs/domains/{authorization,classroom,communication,platform,support}/README.md` (قوالب فاضية) | مكانها صح. تتملى مع المراحل P1 وP3 وP5 وP7 في الخطة بدل محتوى مخترع. |
| `docs/api`، `docs/security`، `docs/testing` (stubs) | نفس السبب. عقد الـAPI مهمة R9-2. |
| `docs/architecture/*` (ملاحظات قصيرة) | قصيرة لكن مش غلط. |
| `current-state.md`، `implementation-ledger.md` | تاريخ. معلَّمين في رأس الملف ومذكورين في الفهرس كتاريخ. |
| `docs/frontend/*` (7 ملفات تقارير قديمة) + `docs/design/UI-UX-REDESIGN-PLAN.md` | مراجَع بيها في التقارير، والـdesign plan مصدر OD-16. ممكن تتدمج في R9-8. |
| `prompts/GENERIC-TASK-TEMPLATE.md` | قالب مهمة عام، ومختلف عن `templates/TASK-REPORT.md`. |

## 4. لسه مطلوب (R9-8)
- كتابة عقد الـAPI (OpenAPI) في `docs/api/`.
- الدومينات الخمسة الفاضية.
- ADRs للقرارات الهيكلية القديمة (OD-3، OD-5، OD-9)، والجديدة ADR-002 إلى ADR-004 من الخطة.
