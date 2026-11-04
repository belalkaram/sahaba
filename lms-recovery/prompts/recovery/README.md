# Recovery Program — Prompts for Claude Code

هذا الفولدر هو حزمة التنفيذ الكاملة لخطة الاستعادة. تعطيه لـ Claude Code مرحلة مرحلة.

## محتويات الفولدر

| الملف | لمن | الغرض |
|---|---|---|
| `00-IMPROVEMENTS-A-TO-Z.md` | لك | شرح كل ما سيتم في المشروع بالترتيب |
| `01-DECISIONS.md` | لك + Claude Code | القرارات المفتوحة والقيم الافتراضية المعتمدة — **راجعها قبل البدء** |
| `02-OPERATING-RULES.md` | Claude Code | قواعد العمل الإلزامية في كل جلسة |
| `03-PROGRESS-TRACKER.md` | الاثنين | قائمة كل المهام وحالتها — Claude Code يحدّثها بعد كل مهمة |
| `phases/R0…R9-*.md` | Claude Code | برومت كامل لكل مرحلة |
| `templates/` | Claude Code | قالب تقرير المهمة وقالب ADR |
| `START-HERE.md` | Claude Code | البرومت الذي تلصقه في أول جلسة |

والتحليل الكامل (الأدلة لكل مشكلة) في `docs/audit/2026-10-30-system-gap-analysis/`.

## طريقة الاستخدام

1. راجع `01-DECISIONS.md`. إن لم تغيّر شيئًا، تُعتمد القيم الافتراضية.
2. افتح Claude Code في جذر المشروع (`E:\lms`).
3. الصق محتوى `START-HERE.md`. سيقرأ القواعد، ثم ينفذ R0.
4. بعد كل مرحلة: راجع التقرير الذي يكتبه في `docs/recovery-reports/`، وراجع الـ diff، ثم اكتب:

   ```text
   Continue with the next phase in prompts/recovery/03-PROGRESS-TRACKER.md.
   Follow prompts/recovery/02-OPERATING-RULES.md.
   ```

5. **جلسة جديدة لكل مرحلة** (أو لكل جزء من مرحلة كبيرة). المراحل الكبيرة مقسمة بالفعل: R1 → R1A + R1B، و R7 → R7A..R7F.

## الترتيب الإلزامي

```text
R0 → R1A → R1B → R2 → R3 → R4 → R5 → R6 → R7A → R7B..R7F → R8 → R9
```

R3 و R4 و R5 و R6 يمكن تبديل ترتيبها فيما بينها، لكن **لا شيء منها قبل R2**، و **لا R7 قبل R1B**.

## قواعد مهمة لك

- لا تقبل "DONE" بدون تقرير فيه الأوامر التي شُغّلت ونتائجها.
- إن توقف Claude Code بسبب قرار — هذا متوقع. أجب، ثم أكمل.
- اعمل commit بعد كل مرحلة ناجحة (أو اطلب منه ذلك) حتى تستطيع الرجوع.
