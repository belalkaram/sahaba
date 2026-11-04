# 06 — تصحيح الحالة والتوثيق

> AGENTS.md §5: *"Never claim a stronger status without evidence."* — هذه قائمة الادعاءات الموجودة حاليًا التي لا يدعمها الكود، والتصحيح المطلوب.

## 1. ادعاءات الحالة غير الصحيحة

| المصدر | الادعاء | الواقع | التصحيح |
|---|---|---|---|
| `docs/project-management/current-state.md` — Current Mode | `PRODUCTION_READY` | ثغرات P0 أمنية، الأدوار مكسورة، تكاملات محاكاة | `RECOVERY — NOT PRODUCTION READY` |
| `release-evidence.json` | 9/9 gates ⇒ PRODUCTION_READY | الـ gates = lint/types/build/tests/وجود ملفات؛ لا تختبر سلوك المنتج | يبقى كسجل تاريخي؛ الحالة تُشتق من مصفوفة `04-…` (R9-6) |
| current-state — M9 | *"Authentic space code generation"* لـ Google Meet | كود عشوائي محلي لا يُنشئ اجتماعًا | SIMULATED |
| current-state — M9 | Google Drive integration | تسجيل رابط فقط | SIMULATED |
| current-state — M11 | Light/dark, white-label | dark ثابت | PARTIAL |
| current-state — M15-002 | *"Live Dynamic QR … 30s rotating tokens"* | لا توجد توكنات دوّارة | SIMULATED |
| current-state — M15-002 | *"Super Admin Tenant Provisioning Wizard"* | خطوات `setTimeout` + mock عند الفشل | SIMULATED |
| current-state — M15-003 | *"High-Converting Public Landing Page (/)"* | `/` = redirect إلى `/login` | MISSING |
| current-state — M15-003 | *"Institution Onboarding Wizard … immediate activation"* | لا يستدعي API | SIMULATED |
| current-state — M15-003 | *"Interactive AI Tutor"* / *"Virtual Classroom"* | ردود ثابتة / محاكاة | SIMULATED |
| current-state — M16-003 | ABAC engine | محرك + قاعدة واحدة فقط | PARTIAL |
| current-state — M16-004 | Support temporary access | بلا مصادقة، بلا إنهاء | BROKEN (T-SEC-01/02) |
| current-state — M16-006 | PWA | يعمل جزئيًا (offline.html غير مخزن) | PARTIAL |
| `docs/frontend/frontend-recovery-plan.md` §4 | F4, F5, F7, F9 = COMPLETED؛ F11 = VERIFIED | صفحات فارغة بسبب الصلاحيات، بيانات وهمية | يُستبدل بجدول `05-recovery-plan.md` |
| نفس الملف | F6, F8, F10 | غير مذكورة في جدول الحالة إطلاقًا | NOT STARTED |
| `docs/frontend/frontend-gap-register.md` §3 | Exam grading = Closed ✅ | التصحيح على السيرفر صحيح، لكن الإجابات مكشوفة في `GET exams` | يُعاد فتحه (T-SEC-04) |

## 2. تعارضات داخل التوثيق

| التعارض | التفاصيل |
|---|---|
| حالة المشروع | `current-state.md` = PRODUCTION_READY مقابل `frontend-verification-report.md` = PARTIAL / BETA |
| نقطة البداية | `README.md` يقول *"Start with START-M0 and execute M0-001 only"* بينما المشروع في M16 |
| روابط مطلقة معطوبة | `frontend-recovery-plan.md` يربط بـ `file:///c:/Users/FAGR/Desktop/lms/lms_ai_project_ai_package_full/...` |
| ملفات مكررة بمحتوى متطابق | `phases/phase-k.md` = `master/MASTER-SPECIFICATION.md`؛ `requirements/BRD-FULL.md` = `phases/phase-b.md`؛ `requirements/PRODUCT-DEFINITION.md` = `phases/phase-a.md` (نفس SHA-256 في `MANIFEST.md`) — أي تعديل في واحد لن ينعكس على الآخر |
| أسماء الصلاحيات | Master §24 (`credentials.issue`, `attendance.correct`, `students.create…`) ≠ الكود (`credentials.create`، لا correct، لا students.*) |
| تجارب الواجهة | Master §61 = 6 تجارب (منها Assistant و Support)؛ الكود = 4 |

## 3. ما الذي ينقص لكي "ترى كل الخطوات والـ verifications"

المشكلة ليست نقص ملفات توثيق — هناك الكثير — بل غياب **سجل واحد مشتق من الأدلة**. المطلوب (R9):

1. **مصفوفة التغطية `04-…`** هي المصدر الوحيد للحالة. كل صف: المتطلب ← الكود ← الاختبار ← الدليل ← الحالة.
2. **`current-state.md`** يلخص المصفوفة فقط (عدد REAL/PARTIAL/…) ولا يكتب ادعاءات حرة.
3. **كل مهمة في الخطة** تُغلق بـ: رابط commit/PR + أمر الاختبار + ناتجه + لقطات إن كانت واجهة.
4. **Release gate** يقرأ المصفوفة ويفشل إن وجد BROKEN/SIMULATED داخل نطاق الإصدار.

## 4. التعديلات التي طُبقت مع هذه المراجعة

- إضافة إشعار في رأس `docs/project-management/current-state.md` يشير إلى هذه المراجعة ويغير الحالة الفعلية إلى `RECOVERY`.
- إضافة مدخل في `docs/project-management/changelog.md`.
- إضافة هذا المجلد إلى `docs/00-INDEX.md`.

لم يُحذف أي محتوى تاريخي؛ التصحيح التفصيلي لكل milestone يتم أثناء تنفيذ الخطة.
