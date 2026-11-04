# 03 — نموذج الوصول المستهدف (Roles · Permissions · Scopes · Modules · Navigation)

> **الحالة:** PROPOSED — يحتاج موافقة وتسجيل كـ ADR (`docs/decisions/ADR-0xx-access-model.md`) قبل التنفيذ، حسب AGENTS.md §6.
> **يحل:** C-01, C-02, C-03, C-04, C-06 و T-RBAC-01..13.

---

## 1. المبدأ

قرار "هل يرى المستخدم هذا الشيء؟" يُجاب بأربعة أسئلة **بالترتيب**، في الـ backend أولًا ثم يُعكس في الـ frontend:

```text
1. Plane     : هل هو مستخدم منصة أم مستخدم مؤسسة؟         (Platform guard / Tenant guard)
2. Module    : هل القسم مفعّل لهذه المؤسسة؟                 (tenant_features)
3. Permission: هل لديه صلاحية الفعل؟                         (role → permissions)
4. Scope     : على أي موارد؟ own / assigned / branch / tenant (ABAC rules + query scopes)
```

الـ frontend **لا يقرر** — يستلم نتيجة هذه الأسئلة من `/auth/me` ويستخدمها لإخفاء/إظهار فقط. الحماية الحقيقية في الـ backend دائمًا (Master §26).

---

## 2. المستويات (Planes) والتجارب (Experiences)

| Plane | Experience | Route prefix | من يدخلها |
|---|---|---|---|
| Platform | Platform Console | `/platform/*` | `platform_users` فقط (Control DB) — guard منفصل |
| Platform | Support Session | `/t/{tenant}/…` مع شريط "جلسة دعم مؤقتة" | Support user داخل جلسة دعم نشطة |
| Tenant | Admin Console (مدير المؤسسة/المركز) | `/admin/*` | من لديه أي صلاحية `tenant.*` أو `users.*` أو `roles.*` |
| Tenant | Staff Workspace (مدرس / مساعد / مالية) | `/staff/*` | `persona = staff` — المحتوى يُبنى من الصلاحيات |
| Tenant | Student | `/student/*` | `persona = student` |
| Tenant | Parent | `/parent/*` | `persona = parent` |

**ملاحظة:** المدرس والمساعد ومسؤول المالية **نفس الـ Experience** (`/staff`) بتنقل مختلف حسب الصلاحيات. هذا يحقق `Teacher ≠ Role` ويسمح بمستخدم واحد له أكثر من دور.

---

## 3. الأدوار النظامية (System Roles) — تُنشأ تلقائيًا لكل مؤسسة

| Role | Persona | الوصف | Scope افتراضي |
|---|---|---|---|
| `owner` | staff | مالك المؤسسة / المدرس المستقل | tenant |
| `center_admin` | staff | مدير مركز | tenant |
| `branch_manager` | staff | مدير فرع | branch |
| `teacher` | staff | مدرس | own (كورساته وفصوله) |
| `assistant` | staff | مساعد | assigned (الفصول/الطلاب المعينين) |
| `finance` | staff | مراجعة المدفوعات والاشتراكات | tenant (billing فقط) |
| `student` | student | طالب | self |
| `parent` | parent | ولي أمر | linked children |

**أدوار المنصة:** `platform_super_admin`, `platform_support` (في Control DB).

**Custom Roles:** `roles.manage` يسمح بإنشاء أدوار جديدة من الكتالوج (FR-AUTHZ-004). الأدوار النظامية لا تُحذف.

---

## 4. كتالوج الصلاحيات (المصدر الوحيد)

يُعرّف في ملف واحد (مثال: `apps/api/config/authorization.php`) بالشكل:

```php
'students.view' => ['module' => 'core',       'scopes' => ['self','linked','assigned','branch','tenant']],
'attendance.record' => ['module' => 'offline', 'scopes' => ['assigned','branch','tenant']],
```

| Module | الصلاحيات |
|---|---|
| core | `tenant.settings`, `tenant.branding`, `users.view/create/update/suspend`, `roles.view/manage`, `audit.view`, `notifications.send`, `students.view/create/update/delete`, `parents.manage`, `staff.manage` |
| online | `courses.view/create/update/delete/publish`, `lessons.view/create/update/delete/reorder`, `materials.manage`, `media.view/upload/delete`, `progress.view`, `meetings.view/create/manage` |
| offline | `branches.manage`, `classrooms.manage`, `classes.view/create/update/manage_students`, `sessions.view/create/update`, `attendance.view/record/correct`, `attendance.scan` |
| assessment | `assignments.view/create/update/grade/publish`, `exams.view/create/update/grade/publish`, `grades.view` |
| billing | `packages.view/manage`, `payments.view/approve/reject`, `subscriptions.view/manage`, `entitlements.view/grant/revoke` |
| credentials | `credentials.view/issue/revoke`, `devices.replace` |
| analytics | `analytics.view/manage`, `reports.view/generate/download`, `metrics.manage` |

**قواعد:**
- اختبار CI يفشل إذا فحص أي controller/route صلاحية غير موجودة في الكتالوج (يغلق T-RBAC-01 نهائيًا).
- الـ seeder والـ provisioning والاختبارات تقرأ من الكتالوج — لا قوائم مكتوبة يدويًا.

---

## 5. مصفوفة الأدوار الافتراضية (مختصرة)

| Capability | owner | center_admin | branch_mgr | teacher | assistant | finance | student | parent |
|---|---|---|---|---|---|---|---|---|
| إدارة المستخدمين والأدوار | ✔ | ✔ | فرعه | — | — | — | — | — |
| الكورسات والدروس | ✔ | ✔ | — | own | view assigned | — | enrolled+entitled | — |
| رفع فيديو / Drive | ✔ | ✔ | — | own | — | — | — | — |
| الفصول والجلسات | ✔ | ✔ | branch | own | assigned | — | own | children |
| رصد حضور / QR scan | ✔ | ✔ | branch | own | assigned | — | — | — |
| تصحيح حضور | ✔ | ✔ | branch | own | — | — | — | — |
| امتحانات وواجبات (بناء/تصحيح) | ✔ | ✔ | — | own | grade assigned | — | take/submit | — |
| الدرجات | ✔ | ✔ | branch | own | assigned | — | self (published) | children (published) |
| مراجعة المدفوعات | ✔ | ✔ | — | اختياري | اختياري | ✔ | own requests | children |
| أكواد الدخول والأجهزة | ✔ | ✔ | branch | — | assigned | — | self | — |
| التحليلات والتقارير | ✔ | ✔ | branch | own | — | billing | self | children |
| سجل التدقيق | ✔ | ✔ | — | — | — | — | — | — |

---

## 6. الأقسام (Modules) على مستوى المؤسسة

| Module key | يتحكم في |
|---|---|
| `online` | الكورسات، الدروس، الفيديو، Drive، Meet، التقدم |
| `offline` | الفروع، القاعات، الفصول، الجلسات، الحضور، QR |
| `assessment` | الواجبات، الامتحانات، الدرجات |
| `billing` | الباقات، المدفوعات، الاشتراكات |
| `credentials` | أكواد الدخول وربط الأجهزة |
| `analytics` | التحليلات والتقارير |
| `parents` | حسابات أولياء الأمور |

- Backend: middleware `tenant.module:offline` على كل route تابع.
- Frontend: كل عنصر تنقل وكل route مربوط بـ module.
- المنصة تتحكم في تفعيل الأقسام (Platform Console ← المؤسسة ← الأقسام)، ومدير المؤسسة يرى ما هو مفعّل فقط.

---

## 7. عقد `/auth/me` المستهدف

```json
{
  "user":    { "id": "…", "name": "…", "email": "…", "phone": "…", "status": "active" },
  "persona": "staff",
  "profiles": {
    "student": null,
    "staff":   { "id": "…", "staff_type": "teacher", "branch_ids": ["…"] },
    "parent":  null
  },
  "roles": [ { "name": "teacher", "label": "معلم" }, { "name": "finance", "label": "مالية" } ],
  "permissions": { "courses.update": "own", "payments.approve": "tenant", "attendance.record": "own" },
  "tenant": { "id": "…", "slug": "…", "modules": ["online","assessment","billing"], "auth_mode": "hybrid", "branding": { } },
  "experience": "staff",
  "support_session": null
}
```

- `experience` يحسبه الـ backend (لا `resolveRole` في الـ frontend).
- `permissions` خريطة `permission → scope`.
- Types الـ frontend تُولّد من OpenAPI.

---

## 8. التنقل (Navigation Registry) في الـ Frontend

ملف واحد يعرّف كل عنصر:

```ts
{ id: 'staff.attendance', href: '/staff/attendance', label: 'الحضور',
  experience: 'staff', module: 'offline', anyOf: ['attendance.record', 'attendance.view'] }
```

- القائمة الجانبية = `registry.filter(item => experienceMatches && moduleEnabled && hasAnyPermission)`.
- **Route Guard** واحد (`middleware.ts` + guard في كل layout) يستخدم نفس الـ registry: إن لم يُسمح ← صفحة 403 واضحة (ليست فارغة).
- `PermissionGate` / `useCan('payments.approve')` للأزرار داخل الصفحات.
- حالات واضحة لكل استدعاء API: `loading | empty | forbidden | error | success` — إلغاء كل `.catch(() => [])`.

---

## 9. واجهة إدارة الأدوار (Admin → الأدوار والصلاحيات)

- قائمة الأدوار (نظامية + مخصصة) وعدد المستخدمين لكل دور.
- محرر دور: مجموعات حسب الـ module، لكل صلاحية: مفعّلة + scope.
- صفحة المستخدم: أدواره، صلاحياته الفعلية المحسوبة (Effective Permissions)، وسجل التغييرات.
- كل تعديل صلاحية ← Audit Log.

---

## 10. Support Session (Platform)

```text
platform_support يطلب جلسة (tenant + reason)
  → SupportSession{status: active, expires_at, actor}
  → توكن قصير بصلاحيات read-only افتراضيًا (أو scope محدد)
  → يُسلَّم عبر POST/one-time code (ليس في URL)
  → الواجهة تعرض شريطًا ثابتًا "جلسة دعم — تنتهي خلال 1:45 — إنهاء"
  → end / expire / revoke ⇒ إبطال التوكن فورًا + audit
```
