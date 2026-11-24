طبّق نظام التصميم الجديد "Emerald Glass" الموجود في المجلد `docs/design/emerald-glass/` على تطبيق الويب كله.

1. اقرأ `DESIGN.md` أولًا، وافتح `reference/light.html` و`reference/dark.html` وراجع الصور في `screenshots/`. الوضع الفاتح هو المرجع، والداكن بنفس الأشكال بالظبط وتختلف الألوان بس.
2. استبدل الطبقة الدلالية (2a و2b) في `apps/web/src/styles/tokens.css` بمحتوى `tokens.css`. سيب الـ primitives والـ chrome والـ legacy aliases والـ tone zones زي ما هي، وما تغيرش أسماء التوكنز.
3. أضف `glass.css` في `globals.css`، وحط طبقة `.ambient` (3 عناصر `<i>`) مرة واحدة في الـ app shell والـ public chrome.
4. حدّث مكوّنات `components/ui` (button, input, select, switch, checkbox, badge, tabs, card, kpi-card, stat-card, progress-bar, toast, empty-state, avatar, modal, drawer, dropdown-menu) حسب جدول الأشكال والوصف في DESIGN.md، وبعدها بانرات الـ hero في student-dashboard و teacher-dashboard.
5. ممنوع أي تفرّع حسب الثيم داخل المكوّنات، كل حاجة تيجي من التوكنز.
6. اشتغل على مراحل: التوكنز والزجاج الأول، بعدها المكوّنات، بعدها الصفحات. بعد كل مرحلة شغّل `/components` وقارن الوضعين بالصور المرجعية، وصلّح أي اختلاف قبل ما تكمّل.
7. في الآخر ابعتلي قائمة بالملفات اللي اتغيرت وأي مكان ماقدرتش تطبّق فيه التصميم.
