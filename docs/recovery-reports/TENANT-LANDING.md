# تقرير التحقق — Tenant Landing (TL-7)

**التاريخ:** 2026-11-13  
**المرحلة:** TL-7 — التحقق النهائي  
**ADR:** [ADR-007](../decisions/ADR-007-tenant-landing-templates-and-theme.md)

---

## ملخص النتائج

| الفحص | الحالة | التفاصيل |
|---|---|---|
| `tsc --noEmit` | ✅ نظيف | خروج صفر، لا أخطاء TypeScript |
| اختبارات Frontend (Node.js) | ✅ 37/37 نجاح | شامل WCAG AA، شكل الـ CSS، isValidPalette |
| اختبارات Backend (PHPUnit) | ✅ 15/15 نجاح | 56 assertion — TenantLandingSettingsTest |
| Attribution في HTML الخادم | ✅ موجودة ومحمية | PoweredByFooter خادم نقي خارج نطاق القالب |
| 5 قوالب (header) | ✅ مكتملة | oasis / beacon / breeze / atlas / horizon |
| المحرر `/admin/landing` | ✅ مبني | TemplatePicker + PaletteEditor + PublishBar + PreviewFrame |
| محرري المحتوى (TL-6) | ✅ مبنية | AboutEditor + FaqEditor + ContactEditor |
| Playwright E2E | ⏳ يتطلب بيئة تشغيل | انظر §5 |
| Lighthouse (LCP/CLS) | ⏳ يتطلب build إنتاج | انظر §5 |
| لقطات مرجعية بصرية | ⏳ يتطلب Playwright + server | انظر §5 |

---

## 1. TypeScript — `tsc --noEmit`

```
الأمر: cd apps/web && npx tsc --noEmit
النتيجة: exit 0 — لا أخطاء
```

---

## 2. اختبارات Frontend (Node.js native test runner)

```
الأمر: npm test  (node --experimental-strip-types --test tests/**/*.test.ts)
Node.js: v24.16.0

ℹ tests       37
ℹ suites       8
ℹ pass        37
ℹ fail         0
ℹ duration   848 ms
```

### تفاصيل `derive-tenant-theme.test.ts` (20 اختبار)

| المجموعة | الاختبارات | النتيجة |
|---|---|---|
| `isValidPalette` | 5 — hex صالح، رفض #RGB، رفض OKLCH، رفض null، رفض مفتاح مفقود | ✅ |
| output shape | 11 — CSS غير فارغ، الانتقاء الصحيح للـ selectors، وجود الـ tokens، hex صالح | ✅ |
| WCAG AA | 3 — `--primary-fg / --primary` ≥ 4.5، `--fg / --surface` فاتح ≥ 4.5، `--fg / --surface` داكن ≥ 4.5 | ✅ |
| custom palette | 2 — نتائج مختلفة، لا تحذيرات للألوان عالية التباين | ✅ |

---

## 3. اختبارات Backend (PHPUnit)

```
الأمر: cd apps/api && php artisan test --filter=TenantLandingSettings
النتيجة: {"tool":"phpunit","result":"passed","tests":15,"passed":15,"assertions":56,"duration_ms":21434}
```

### تغطية `TenantLandingSettingsTest`

- owner يحفظ مسودة وينشر؛ `version` يزيد؛ سجل تدقيق مكتوب
- `teacher` (بلا `tenant.branding`) → 403؛ طالب → 403؛ بلا توكن → 401
- cross-tenant: توكن أكاديمية A مع `X-Tenant-Slug` لأكاديمية B → 403
- قيم مرفوضة: لون غير hex، قالب غير معروف، 9 أسئلة، رابط `http://`، نص > 1200
- `GET /public/academy/profile` يُرجع المنشور فقط، لا مسودة، لا حقول تواصل غير مفعّلة، لا `preview_token_hash`
- رمز معاينة صالح يُرجع المسودة؛ منتهٍ أو خاطئ يُرجع المنشور بـ 200

---

## 4. Attribution «مدعوم بمنصة سحابة»

### البنية المُطبَّقة

**`apps/web/src/app/a/[slug]/layout.tsx`** (Server Component — لا client):
```tsx
{/* PoweredByFooter is server-rendered here — outside template, cannot be hidden */}
<PoweredByFooter academyName={profile.name} />
```

**`apps/web/src/features/tenant-landing/sections/powered-by-footer.tsx`**:
- لا `'use client'`، لا hooks، لا `dynamic import`
- يحتوي نص «مدعوم بمنصة» + Link إلى `/`
- يُرسَم خارج `<div data-tenant-theme>` → لا يمكن لأي قالب تجاوزه أو إخفاءه

### الثابت الأمني المحقق

```
✅ PoweredByFooter خادم نقي خارج نطاق القالب
✅ لا توجد prop أو إعداد يخفي المكون
✅ كل الـ 5 قوالب لا تلمس footer layout
```

---

## 5. الحدود والتحقق المؤجل

الاختبارات التالية تحتاج بيئة تشغيل (dev server + بيانات محضّرة + متصفح):

### 5.1 Playwright E2E (غير منفذ)

**ما يحتاجه:**
- dev server يعمل (`npm run dev` + API + بيانات الـ 5 قوالب محضّرة بـ seeder)
- Playwright مثبَّت (`npx playwright install`)

**ما يجب التحقق منه عند التنفيذ:**
```
لكل قالب في [oasis, beacon, breeze, atlas, horizon]:
  - فاتح + داكن × 390/1440px:
    ✓ axe: بلا critical/serious
    ✓ لا تمرير أفقي (scrollWidth ≤ viewportWidth)
    ✓ نص «مدعوم بمنصة سحابة» في page.content() (HTML الأولي قبل JS)
    ✓ رابط PoweredByFooter يشير إلى /
  - 768px: تحقق من عرض الـ tablet
تدفق المحرر:
  ✓ اختيار قالب → تغيير لون → طلب token معاينة → iframe يعكس التغيير
  ✓ نشر → الصفحة العامة تعكسه
لقطات مرجعية: 1440 فاتح لكل قالب
```

### 5.2 Lighthouse (غير منفذ)

**يتطلب:** `npm run build && npm run start` (production build)  
**المعايير المطلوبة:** LCP ≤ 2.0s، CLS ≤ 0.02

**ملاحظة:** البنية الحالية تُهيئ CSS الثيم من الخادم (بلا FOUC) مما يدعم CLS المنخفض؛ الـ ISR يقلل زمن الاستجابة.

### 5.3 Cross-browser (غير منفذ)

Safari 17+ وFirefox 128+ على 390/768/1440 — يتطلب بيئة macOS أو BrowserStack.

---

## 6. مصفوفة المكونات المبنية

| المكون | الملف | الحالة |
|---|---|---|
| Oasis Header | `templates/oasis/header.tsx` | ✅ |
| Beacon Header | `templates/beacon/header.tsx` | ✅ |
| Breeze Header | `templates/breeze/header.tsx` | ✅ |
| Atlas Header | `templates/atlas/header.tsx` | ✅ |
| Horizon Header | `templates/horizon/header.tsx` | ✅ |
| Template Registry | `registry.ts` | ✅ لا fallbacks |
| PoweredByFooter | `sections/powered-by-footer.tsx` | ✅ خادم نقي |
| deriveTenantTheme | `lib/theme/derive-tenant-theme.ts` | ✅ |
| layout (ISR + ثيم) | `app/a/[slug]/layout.tsx` | ✅ |
| LandingEditor | `editor/LandingEditor.tsx` | ✅ |
| TemplatePicker | `editor/TemplatePicker.tsx` | ✅ |
| PaletteEditor | `editor/PaletteEditor.tsx` | ✅ |
| PublishBar | `editor/PublishBar.tsx` | ✅ |
| PreviewFrame | `editor/PreviewFrame.tsx` | ✅ |
| AboutEditor | `editor/AboutEditor.tsx` | ✅ |
| FaqEditor | `editor/FaqEditor.tsx` | ✅ |
| ContactEditor | `editor/ContactEditor.tsx` | ✅ |
| Landing API client | `api.ts` | ✅ |
| Backend service + routes | `apps/api/...` | ✅ |
| Backend test suite | `TenantLandingSettingsTest` | ✅ 15/15 |

---

## 7. الثوابت الأمنية المحققة

| الثابت | التحقق |
|---|---|
| لا وصول cross-tenant | اختبار backend يغطيه (403 مع slug غريب) |
| Attribution لا تُخفى | PoweredByFooter خارج نطاق القالب في layout الخادم |
| المسودة فقط برمز صالح | 15-min hash + preview_token_hash لا يُرجعه GET public |
| حقول التواصل opt-in | افتراضي `published=false`؛ `resolvePublic` يُسقط غير المفعّل |
| REVALIDATE_SECRET خادم فقط | لا `NEXT_PUBLIC_*` في الكود |
| hex صارم فقط | التحقق في `deriveTenantTheme` + backend validation |

---

## 8. الخلاصة

| المعيار | النتيجة |
|---|---|
| TypeScript نظيف | ✅ |
| اختبارات وحدة (37 frontend + 15 backend) | ✅ |
| Attribution محمية في الخادم | ✅ |
| 5 قوالب مكتملة | ✅ |
| محرر admin كامل (TL-5 + TL-6) | ✅ |
| Playwright / Lighthouse / Cross-browser | ⏳ يتطلب بيئة تشغيل |

الميزة **جاهزة للتدمج والاختبار اليدوي** بعد تهيئة بيئة dev مع بيانات محضّرة للـ 5 قوالب.  
اختبارات Playwright المؤجلة تُنجز مع أول جلسة QA على بيئة staging.
