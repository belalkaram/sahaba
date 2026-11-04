# 01 — المشاكل النظرية / المعمارية

> هذه ليست Bugs. هذه **أسباب جذرية** في طريقة تصميم وبناء النظام. كل مشكلة تقنية في `02-technical-findings.md` ترجع لواحدة أو أكثر من هذه.
> لكل مشكلة: ما هي — ماذا يقول التوثيق — ماذا حدث فعلًا — النتيجة — الاتجاه الصحيح.

---

## C-01 — لا يوجد "كتالوج قدرات" واحد (Single Capability Catalog)

**ما هي:** الصلاحيات معرّفة في 4 أماكن مستقلة لا تعرف بعضها: الـ seeder، والـ controllers (`hasPermissionTo('…')`)، والـ routes (`tenant.can:…`)، والاختبارات (كل اختبار ينشئ صلاحياته بنفسه). والـ frontend لا يعرف أي صلاحية.

**التوثيق يقول:** FR-AUTHZ-005 — *"The final action catalog shall be centrally defined."* و Master §25 — *"Authorization is not hardcoded as scattered role checks."*

**ما حدث:** 7 صلاحيات يفحصها الكود ولا تُنشأ أبدًا (`students.view`, `grades.view`, `payments.view`, `subscriptions.view`, `entitlements.view`, `credentials.view`, `reports.download`). الاختبارات تنجح لأنها تنشئ هذه الصلاحيات يدويًا؛ النظام الحقيقي يرفضها حتى للـ admin.

**النتيجة:** صفحات المدرس (الطلاب، المدفوعات، الأكواد) ترجع فارغة لكل المستخدمين بمن فيهم مدير الأكاديمية. هذا هو مصدر إحساس "الخصائص مش موجودة".

**الاتجاه الصحيح:** ملف كتالوج واحد (`config/permissions.php` أو enum) هو المصدر الوحيد؛ الـ seeder والـ middleware والاختبارات والـ frontend كلهم يقرؤون منه؛ اختبار يفشل إذا فُحصت صلاحية غير موجودة في الكتالوج.

---

## C-02 — خلط بين Role و Persona و Experience

**ما هي:** النظام يملك مفهومًا واحدًا هو "الدور"، ويستخدمه لثلاثة أشياء مختلفة:
- **Role** (حزمة صلاحيات قابلة للتخصيص — backend)
- **Persona** (من أنت: طالب/ولي أمر/موظف — `tenant_users.type` + profile)
- **Experience** (أي واجهة تراها: student/teacher/parent/platform)

**التوثيق يقول:** Master §27 — `Teacher ≠ Role`, `Role ≠ Permission`. Master §61 — ست تجارب منفصلة: Student, Parent, Teacher, Assistant, Platform, Support. Master §50 — *"Platform administration is separate from tenant administration."*

**ما حدث:** الـ frontend (`resolveRole`) يأخذ **أول** role بالاسم ويحوّله إلى 4 قيم فقط. أي role اسمه فيه `admin` يذهب إلى `/platform/dashboard` — أي أن **مدير الأكاديمية يُعامَل كسوبر أدمن المنصة**. أي `staff` (بما فيهم المساعد) = مدرس. لا يوجد Assistant ولا Center Admin ولا Support كتجارب.

**النتيجة:** لا يمكن لمستخدم واحد أن يكون "مدرس + مسؤول مدفوعات"، ولا يمكن لمساعد أن يرى واجهة مختلفة، ولا يمكن لمدير المركز أن يدير مركزه.

**الاتجاه الصحيح:** Experience تُحدد من الـ persona + الصلاحيات الفعلية، ليس من اسم الـ role. انظر `03-target-access-model.md`.

---

## C-03 — طبقة المنصة (Control Plane) بلا هوية

**ما هي:** لا يوجد كيان "Platform User" ولا تسجيل دخول للمنصة ولا صلاحيات منصة.

**التوثيق يقول:** Master §50–53 — Super Admin و Support أدوار منصة؛ Support session تتطلب *actor, tenant, reason, authorization, expiration, audit* وتكون *revocable*.

**ما حدث:** كل endpoints المنصة (`/tenants`, `/tenants/{id}/support-access`, `/platform/audit-logs`) خارج أي middleware مصادقة. الكود نفسه يعترف: `$request->user()?->id ?? 1` مع تعليق *"we might mock the user"*.

**النتيجة:** أي شخص على الإنترنت يستطيع إنشاء مؤسسات، تعليقها، تغيير هويتها، وقراءة سجل التدقيق العام، **والحصول على توكن دخول لأي مؤسسة**. هذا يلغي كل ضمانات العزل التي بُني عليها المشروع.

**الاتجاه الصحيح:** `platform_users` في Control DB + guard مستقل + صلاحيات منصة + Support Session ككيان له دورة حياة (requested → active → ended/expired/revoked).

---

## C-04 — Authorization بلا Scope

**ما هي:** الصلاحية تُجيب "هل يستطيع هذا النوع من المستخدمين فعل X؟" ولا تجيب "على أي موارد؟".

**التوثيق يقول:** FR-AUTHZ-007 — scopes: Tenant, Teacher, Class, Branch, Student, Assigned students, Assigned classes, Owned resources.

**ما حدث:** يوجد `AbacEngine` لكن بقاعدة واحدة فقط (`TeacherCourseRule` لتعديل الكورس). كل ما عدا ذلك إما مفتوح للجميع (classes, meetings, exams index) أو مغلق للجميع إلا صاحب صلاحية عامة. لا يوجد مفهوم "طلابي" أو "فصولي" أو "أبنائي".

**النتيجة:** خياران سيئان فقط: إما تعطي المدرس `students.view` فيرى **كل** طلاب المؤسسة، أو لا تعطيه فلا يرى أحدًا. ولي الأمر لا يستطيع رؤية أبنائه لأن الوصول الوحيد المتاح هو `students.view` العام.

**الاتجاه الصحيح:** كل صلاحية لها scope (`own`, `assigned`, `branch`, `tenant`) وكل query في الـ backend تمر بـ scope resolver، والـ frontend يستلم الصلاحيات مع scopes.

---

## C-05 — سلسلة الدفع تنتهي قبل الوصول

**ما هي:** `Package → Payment → Review → Subscription → Entitlement → Access`. الـ backend نفّذ حتى `Entitlement` فقط.

**التوثيق يقول:** Master §36 — السلسلة حتى `Access`، و *"Not Student.is_paid"*.

**ما حدث:** `Student::hasEntitlement()` موجودة ولا يستدعيها أي مكان في الكود. الكورس "المنشور" مفتوح لأي طالب بالكامل، والطالب يستطيع تسجيل نفسه في أي كورس (self-enroll) بدون أي تحقق.

**النتيجة:** نظام الدفع كله بلا أثر فعلي. لا فرق بين طالب دفع وطالب لم يدفع.

**الاتجاه الصحيح:** `AccessPolicy` واحد يجيب "هل يرى هذا الطالب هذا الدرس/الفيديو/الامتحان؟" بناءً على Entitlement + Enrollment + حالة المحتوى (free preview / draft)، ويُستدعى من كل endpoint محتوى.

---

## C-06 — "الأقسام" (Modules) غير ممثلة في التجربة

**ما هي:** المؤسسة قد تكون Online فقط، أو Offline فقط، أو الاثنين (FR-TEN-005). جدول `tenant_features` موجود.

**ما حدث:** `Tenant::hasFeature()` لا يستدعيها أحد في الـ backend، والـ frontend لا يقرأ `features` من `/tenant/current`. كل المؤسسات ترى كل الأقسام (حضور، قاعات، اجتماعات، فيديو، دفع…).

**النتيجة:** مؤسسة أونلاين فقط ترى صفحات حضور وQR لا معنى لها؛ لا يمكن للمنصة بيع باقات بأقسام مختلفة.

**الاتجاه الصحيح:** Module Registry: كل route/صفحة/عنصر تنقل/endpoint مربوط بـ module، والـ module يجب أن يكون مفعّلًا للمؤسسة **و** للمستخدم صلاحية فيه.

---

## C-07 — نموذج المحتوى أفقر من أن يكون LMS

**ما هي:** `Course → Lesson { title, content(text), sort_order, status }` فقط.

**التوثيق يقول:** FR-ONLINE-003 — الدروس تدعم Videos, Files, Assignments, Exams. FR-ONLINE-006 — Video Progress (start, %, position, completion, last watched, rewatch). Master §27 — `Video Event ≠ Learning Progress`.

**ما حدث:** لا يوجد Module/Section، لا نوع للدرس، لا مواد مرفقة، لا تعديل/حذف/ترتيب للدروس (فقط إنشاء)، لا تقدم، لا prerequisites، لا free preview. الربط بين الفيديو والدرس يتم من جهة `media_assets.lesson_id` فقط. "إكمال الدرس" في الـ frontend حالة React تضيع عند تحديث الصفحة.

**النتيجة:** لا يمكن بناء كورس حقيقي، ولا يمكن معرفة تقدم أي طالب، والـ Analytics عن التعلم مستحيلة.

---

## C-08 — التكاملات محاكاة ومعروضة كأنها حقيقية

**ما هي:** طبقة الـ Provider Abstraction صحيحة معماريًا، لكن الـ adapters "الحقيقية" لا تتصل بأي API خارجي.

| التكامل | ما يحدث فعلًا |
|---|---|
| Google Meet | يولّد كود `aaa-bbbb-ccc` عشوائي محليًا ← الرابط لاجتماع **غير موجود** عند Google |
| Google Drive | "الرفع" = حفظ رابط/ID يكتبه المدرس؛ إن لم يكتبه يُولّد ID عشوائي ← مشغل مكسور |
| QR Attendance | لا QR يُعرض للطالب؛ ما يُمسح هو `student_code` الثابت؛ "التوكن الدوّار" غير موجود |
| الفصل الافتراضي | صفحة محاكاة (كاميرا وهمية، رفع يد، شات محلي) |
| AI Tutor | ردود ثابتة عبر `setTimeout` |
| إنشاء مؤسسة (register-school) | `setTimeout` ثم "تم بنجاح" — لا يُنشأ شيء |

**التوثيق يقول:** Quality Gate §6 — *"ممنوع Fake dashboards… لو الـ API غير متاحة بيّن بوضوح أن الـ feature Pending Integration ولا تعتبرها Complete."* Master §99 — No Fake Evidence.

**النتيجة:** المنتج يبدو مكتملًا في العرض وينهار في أول استخدام حقيقي، والمطور نفسه لا يعرف ما الحقيقي وما المحاكى.

---

## C-09 — نموذج الحالة والأدلة مكسور

**ما هي:** حالة المشروع تُكتب يدويًا ويُعلن `PRODUCTION_READY` بناءً على gates لا تختبر المنتج.

**التوثيق يقول:** AGENTS.md §5 — `PRODUCTION_READY` = implementation + verification + security + documentation + observability + release. Quality Gate §5 و §37 — Page Exists ≠ Done.

**ما حدث:**
- الـ release gate = lint + types + build + PHPUnit + "الملفات موجودة". لا E2E، لا اختبار صلاحيات حقيقي على بيانات الـ seed، لا visual QA.
- `current-state.md` = PRODUCTION_READY، بينما `frontend-verification-report.md` = PARTIAL / BETA.
- الـ recovery plan يعلّم F4/F5/F7/F9 كـ COMPLETED، وF6/F8/F10 غير موجودة أصلًا في الجدول.
- `current-state.md` يدّعي Landing Page على `/` — بينما `/` يعمل redirect إلى `/login`.

**النتيجة:** لا يمكنك أن "ترى الخطوات والـ verifications"، لأنه لا يوجد سجل يربط المتطلب بالكود بالاختبار بالدليل. (هذا ما طلبته بالضبط.)

**الاتجاه الصحيح:** Traceability Matrix (المتطلب ← الكود ← الاختبار ← الدليل ← الحالة) كمصدر وحيد للحالة، والحالة تُشتق منه. انظر `04-capability-coverage-matrix.md` و R9 في الخطة.

---

## C-10 — لا يوجد عقد (Contract) بين الـ Frontend والـ Backend

**ما هي:** الـ types في `apps/web/src/types/index.ts` مكتوبة يدويًا ولا تُولَّد من `openapi.yaml` ولا تُختبر ضده.

**ما حدث:**
- `/auth/login` و `/auth/me` يرجعان `roles: string[]` و `permissions: string[]` و `profile` — الـ frontend يتوقع `roles: Role[]` بداخلها `permissions` و `student: { id }`.
- `/auth/me` لا يرجع `student.id` أصلًا ← صفحة درجات الطالب تتوقف فورًا (`if (!user?.student?.id)`)، ولوحة الطالب لا تحمّل التحليلات.
- 35 استدعاء `.catch(() => [])` يحوّل 401/403/500 إلى "قائمة فارغة" ← المستخدم يرى Empty State بدل "ليس لديك صلاحية".

**النتيجة:** أخطاء صامتة؛ لا أحد يعرف أن الصفحة مكسورة.

**الاتجاه الصحيح:** OpenAPI كاملة ← توليد types تلقائي ← contract tests في CI ← طبقة data-fetching موحدة تفرق بين empty / forbidden / error.

---

## C-11 — دورة حياة المؤسسة غير مكتملة

**ما حدث:** `TenantController@store` ينشئ قاعدة البيانات ويشغّل الـ migrations فقط. لا roles، لا permissions، لا مستخدم admin، لا إعدادات. صفحة التسجيل الذاتي (`/register-school`) لا تستدعي أي API.

**النتيجة:** أي مؤسسة جديدة غير قابلة للاستخدام: لا يمكن لأحد تسجيل الدخول إليها.

**الاتجاه الصحيح:** `TenantProvisioningService` (Create → Migrate → Seed system roles from catalog → Create owner → Enable modules → Audit) + onboarding wizard.

---

## C-12 — لا يوجد دومين "إدارة المستخدمين"

**ما حدث:** لا يوجد أي endpoint لإنشاء/تعديل/تعليق طالب أو مدرس أو مساعد أو ولي أمر، ولا لربط ولي أمر بطالب، ولا لتعيين role لمستخدم، ولا للفروع والقاعات. البيانات الموجودة كلها من الـ seeder.

**التوثيق يقول:** FR-ID-001..006، FR-AUTHZ-003/004، FR-OFFLINE-001/002.

**النتيجة:** المنصة لا يمكن تشغيلها فعليًا بدون الوصول المباشر لقاعدة البيانات.

---

## C-13 — الـ Workflows ليست حلقات مغلقة

**ما حدث:**
- جدول notifications موجود + API للقراءة — **لا شيء في النظام يُنشئ إشعارًا**، ولا توجد واجهة إشعارات.
- الـ Audit يُسجَّل في 4 أماكن فقط (إنشاء/تعديل مؤسسة، دعم، مدفوعات، أكواد) — ليس في الحضور، الدرجات، تعديل الصلاحيات…
- التقارير تُولَّد بشكل متزامن داخل الـ request (لا queue).
- اعتماد الدفع لا يرسل إشعارًا ولا ينشئ credential (Master §40).

**النتيجة:** النظام لا "يتكلم"؛ كل مستخدم يجب أن يبحث بنفسه عما تغير.

---

## C-14 — الـ UI/UX مبني على Pages وليس على Workflows

**ما حدث (من مراجعة الصفحات):**
- صفحات ضخمة (God Pages): `teacher/payments` 33KB، `platform/tenants` 32KB، `teacher/credentials` 30KB، `student/courses` 29KB — مخالفة Master §63.
- Layouts مكررة: `app/*/layout.tsx` و `components/layout/*-nav-layout.tsx` (الثانية غير مستخدمة وتعتمد على CSS classes غير معرّفة).
- الثيم مثبّت على dark (`data-theme="dark"`) ومئات `text-white` ثابتة ← الـ light mode مكسور رغم أنه مطلوب (Master §7).
- قيم وهمية كـ fallback: "سلطان الغامدي"، "معلم رياضيات — ثانوية اليرموك"، "ثالث ثانوي / 2 — جدة".
- لا Detail Pages: لا صفحة طالب، لا صفحة كورس، لا صفحة جلسة — كلها Modals/Drawers داخل قوائم.

**النتيجة:** هذا بالضبط ما يصفه ملف الـ Quality Gate: *"Functional UI"* وليس *"Product Experience"*.
