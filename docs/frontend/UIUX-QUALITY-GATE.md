# FRONTEND RECOVERY & UI/UX QUALITY GATE
## LMS Platform — Strong Frontend Rebuild / Upgrade Prompt

أنت الآن مسؤول عن **إنقاذ وإعادة بناء ورفع جودة الـFrontend والـUI/UX** في المشروع.

## السياق

الـBackend في المشروع تم تنفيذه بشكل قوي ومتكامل، والـDomain Architecture والـAPIs والـBusiness Rules والـSecurity والـMulti-Tenancy والـAuthorization موجودة كأساس للمشروع.

لكن الـFrontend الحالي لا يعكس قوة الـBackend.

المشكلة الحالية ليست فقط أن الألوان أو الـCSS ضعيفة.
المشكلة أن الـFrontend:

- بسيط زيادة عن اللازم.
- Generic جدًا.
- يشبه تصاميم AI الجاهزة.
- لا يعكس منتج SaaS احترافي.
- الصفحات فيها بيانات قليلة جدًا.
- الـDashboards سطحية.
- بعض الصفحات تعرض مجرد Lists / Cards / Tables بدون تجربة حقيقية.
- الـFrontend لا يستفيد من كل Capabilities الموجودة في الـBackend.
- أحيانًا Task تعتبر "Completed" بمجرد وجود الصفحة أو الـComponent، رغم أن التجربة نفسها ناقصة.
- التصميم لا يعطي إحساس أن هذه منصة تعليمية كبيرة ومتخصصة.

من هذه اللحظة، **لا نريد مجرد Frontend يعمل**.
نريد Frontend يشبه منتج SaaS حقيقي Production-Grade.

---

# 1. الهدف الأساسي

حوّل الـFrontend من:

**Functional UI**

إلى:

**Production-Grade Product Experience**

بمعنى:

> المستخدم يدخل المنصة ويشعر أنها منصة تعليم وإدارة مؤسسات حقيقية، وليست مجموعة صفحات CRUD مولدة تلقائيًا.

الـFrontend لازم يعكس:

- قوة الـBackend
- تعقيد الـDomain
- أدوار المستخدمين
- كثافة البيانات
- Business Workflows
- Security
- Permissions
- Analytics
- Learning Experience
- Administrative Operations

---

# 2. أهم تغيير في طريقة التفكير

ممنوع تنفيذ الـFrontend على أساس:

"إيه الـPage المطلوبة؟"

فقط.

لازم تعمل:

**Capability → Workflow → Information Architecture → Screen → Components → States → Interactions → Data → Verification**

مثال:

لا تقل:

"مطلوب Student Dashboard"

ثم تعمل:

- Welcome message
- 4 cards
- جدول صغير
- زر Logout

ده غير مقبول.

لازم تستخرج من الـDomain والـBackend:

- إيه كل المعلومات اللي الطالب محتاج يشوفها؟
- إيه كل الـActions اللي الطالب مسموح له يعملها؟
- إيه الاشتراكات؟
- إيه الـEntitlements؟
- إيه الكورسات؟
- إيه الـProgress؟
- إيه الـUpcoming Sessions؟
- إيه الـAssignments؟
- إيه الـExams؟
- إيه الـAttendance؟
- إيه الـGrades؟
- إيه الـNotifications؟
- إيه الـPayment State؟
- إيه الـLearning KPIs؟
- إيه الـAlerts؟
- إيه الـQuick Actions؟

وبعدين تحول كل ده إلى تجربة واضحة ومريحة.

---

# 3. FIRST — AUDIT THE EXISTING FRONTEND

قبل أي تعديل كبير على الـFrontend، افحص فعليًا:

- كل routes
- كل pages
- كل layouts
- كل components
- كل shared UI
- كل API integrations
- كل hooks
- كل state management
- كل forms
- كل tables
- كل modals
- كل loading states
- كل error states
- كل empty states
- كل responsive behavior
- كل accessibility issues
- كل duplicated UI
- كل hardcoded mock data
- كل fake statistics
- كل placeholder content
- كل TODO
- كل temporary component
- كل page لا تستخدم قدرات الـBackend الموجودة

ثم أنشئ:

`docs/frontend/frontend-audit.md`

ويحتوي على:

- Route Inventory
- Role Inventory
- Feature Coverage
- Backend Capability Coverage
- UI Quality Problems
- UX Problems
- Missing Screens
- Missing States
- Missing Actions
- Missing Integrations
- Duplicate Components
- Generic AI Patterns
- Fake / Placeholder Data
- Responsive Problems
- Accessibility Problems
- Design System Problems

**لا تبدأ redesign عشوائيًا قبل فهم الحالة الحالية.**

---

# 4. Backend → Frontend Coverage

اعمل Matrix حقيقية تربط:

`Backend Capability → API → Permission → Role → Route → Screen → UI Action → UI State → Test`

مثال:

Payment Review

→ API Endpoint
→ Permission
→ Assistant / Teacher
→ Payment Review Screen
→ Payment Details
→ Proof Preview
→ Approve / Reject
→ Confirmation
→ Loading
→ Success
→ Error
→ Audit confirmation
→ E2E test

أي Capability موجودة في الـBackend ولا يوجد لها Frontend experience مناسبة، تعتبر:

**Frontend Gap**

وليس:

**Task Completed**

---

# 5. Page Exists = Task Done (ممنوع)

وجود:

- Route
- Page
- Component
- Table
- Form

لا يعني أن الـTask اكتملت.

الـTask لا تعتبر Done إلا عندما تكون:

1. UI complete
2. UX complete
3. Connected to real data
4. Permissions integrated
5. All important actions implemented
6. Loading state implemented
7. Error state implemented
8. Empty state implemented
9. Success state implemented
10. Responsive
11. Accessible
12. Visually polished
13. Consistent with Design System
14. Reviewed against the Domain / Backend capability
15. Tested

---

# 6. لا تستخدم Fake Data لإخفاء نقص الـFrontend

ممنوع:

- Fake dashboards
- Random numbers
- Fake charts
- Fake student progress
- Fake activities
- Fake notifications
- Hardcoded counts
- Placeholder payments presented as real data

لو الـBackend capability موجودة:

**اربطها بالـReal API.**

لو الـAPI غير متاحة:

بيّن بوضوح أن الـfeature Pending Integration ولا تعتبرها Complete.

---

# 7. Design Direction

لا أريد:

- Generic AI dashboard
- Purple/blue gradient everywhere
- نفس Card Grid في كل الصفحات
- Huge centered hero فقط
- Rounded cards بلا سبب
- Random glassmorphism
- Decorative gradients بدون وظيفة
- Stock-like AI visual patterns
- صفحات كلها Cards
- Pages كلها Tables
- نفس layout لكل Role

أريد Design System له شخصية واضحة.

الهوية:

**Premium Gulf / Saudi Education SaaS**

مع مراعاة:

- Arabic RTL first-class
- IBM Sans
- Professional
- Calm
- Premium
- Trustworthy
- Modern
- Educational
- Data-rich
- Enterprise-capable
- Mobile-first
- Responsive

التصميم لا يجب أن يكون صاخبًا.

يجب أن يكون:

**Elegant + Functional + Information-rich**

---

# 8. اعمل Design System حقيقي

لا تبدأ بتصميم كل Page منفردة.

أصلح أو ابنِ:

## Foundations

- Typography
- Color tokens
- Spacing
- Radius
- Shadows
- Borders
- Elevation
- Icon system
- Motion
- RTL rules
- Responsive breakpoints

## Primitives

- Button
- Input
- Select
- Checkbox
- Radio
- Switch
- Badge
- Avatar
- Tooltip
- Dropdown
- Tabs
- Divider

## Data Components

- Data Table
- Filter Bar
- Search
- Pagination
- KPI
- Stat
- Chart
- Progress
- Timeline
- Activity Feed
- Calendar
- Schedule
- Status Indicator
- Empty State
- Error State
- Loading Skeleton

## Complex Patterns

- Detail Page
- Management Console
- Review Panel
- Split View
- Multi-Step Form
- Course Builder
- Student Profile
- Analytics Workspace
- Payment Review
- Exam Builder
- Attendance Scanner
- Media Player
- Notification Center

---

# 9. Design by Role

لا تجعل كل المستخدمين يروا نفس Dashboard بتغيير الاسم فقط.

## Student Experience

الطالب يحتاج تجربة Learning-first.

الـDashboard لازم تعكس، حسب الـBackend الحقيقي:

- Current Courses
- Continue Learning
- Progress
- Upcoming Sessions
- Assignments Due
- Exams
- Attendance
- Grades
- Learning KPIs
- Notifications
- Subscription / Access status
- Quick actions

والـCourse Experience لازم تكون قوية وتشمل:

- Course Overview
- Modules
- Lessons
- Lesson Progress
- Video
- Materials
- Assignments
- Quizzes
- Exams
- Related sessions
- Completion
- Navigation

## Teacher Experience

المدرس ليس مجرد CRUD Admin.

Teacher Dashboard لازم تكون **Teaching Operations Workspace**.

تشمل حسب البيانات والصلاحيات الفعلية:

- Today's teaching schedule
- Upcoming sessions
- Students needing attention
- Attendance status
- Pending submissions
- Pending grading
- Upcoming exams
- Payment reviews
- Learning performance
- At-risk / delayed students
- Recent activities
- Quick Actions
- Analytics
- Reports

## Assistant Experience

الـAssistant لازم تكون له تجربة مخصصة حسب الـPermissions، مثل:

- Today
- Assigned Sessions
- QR Attendance
- Student lookup
- Attendance corrections
- Payment review
- Tasks
- Notifications

## Parent Experience

الـParent Dashboard يجب أن تكون **Child Monitoring Experience** وتشمل حسب الصلاحيات:

- Children overview
- Child status summary
- Attendance
- Progress
- Grades
- Upcoming exams
- Assignments
- Reports
- Alerts
- Notifications

## Center / School Admin Experience

ده Enterprise-style Admin Workspace.

يجب أن يعكس:

- Students
- Teachers
- Assistants / Staff
- Parents
- Branches
- Classrooms
- Classes
- Sessions
- Timetable
- Attendance
- Courses
- Exams
- Reports
- Analytics
- Billing
- Subscriptions
- Settings
- Operational Alerts

ويحتاج حسب الـDomain:

- Filters
- Search
- Bulk actions where appropriate
- Tables
- Detail panels
- Activity history
- Status management
- Operational KPIs
- Contextual actions

## Platform Admin / Support Experience

اعكس:

- Total tenants
- Active tenants
- Usage
- Student volume
- System health
- Queue health
- Integration health
- Storage
- Support activity
- Audit activity
- System alerts
- Platform analytics

ولا تحولها إلى مجرد 6 KPI cards.

---

# 10. Public Website / Landing Page

الـLanding Page لازم تكون Premium Product Marketing Page.

ممنوع:

Hero → 3 cards → testimonials → footer

وخلاص.

ابنِ قصة واضحة، حسب الـFeatures الفعلية:

1. Value Proposition
2. Who the platform is for
3. Problems solved
4. Online Learning
5. Offline Education
6. Unified Student / Parent Experience
7. Center Management
8. Teacher Management
9. Analytics
10. Billing / subscriptions
11. Security / tenant isolation
12. Integrations
13. Benefits
14. Pricing
15. CTA
16. Trust / credibility
17. FAQ
18. Footer

مع احترام الـBranding والـSaudi/Gulf context.

---

# 11. Public Profile / Public Tenant Page

أي Public Profile للمدرس أو المركز يجب أن تكون:

- Professional
- Trust-building
- Information rich
- Conversion oriented

وتشمل حسب المتاح:

- Logo / Brand
- Cover / Hero
- About
- Subjects / Specialties
- Courses
- Teachers
- Branches
- Schedule / Available Sessions عند الحاجة
- Testimonials إذا كانت feature فعلية
- Contact
- Registration CTA
- Pricing / Plans إذا متاحة
- Social links إذا مدعومة
- FAQ

---

# 12. Data Density

هذه منصة Education Management.

لا تجعل كل صفحة فارغة.

استخدم **Progressive Disclosure** بدل تقليل البيانات بشكل مبالغ فيه.

مثال Student Profile ممكن يجمع:

- Identity
- Enrollment
- Courses
- Progress
- Attendance
- Grades
- Assignments
- Exams
- Subscription
- Payments
- Credentials
- Devices
- Activity
- Reports

لكن اعرضها بطريقة منظمة:

Tabs / Sections / Side panels / Summary + Details

وليس Dump لكل البيانات في نفس الشاشة.

---

# 13. Detail Pages أهم من Lists

كل List Page مهمة يجب أن يكون لها Detail Experience مناسب.

مثال:

Students List → Student Details
Course List → Course Details
Payment List → Payment Details
Exam List → Exam Details
Session List → Session Details
Tenant List → Tenant Details

ولا تكتفي بـTable فقط.

---

# 14. UI States

كل Feature يجب أن يدعم:

### Loading
Skeletons مناسبة للسياق.

### Empty
رسالة واضحة + سبب + CTA مناسب.

### Error
رسالة مفهومة + Retry إذا مناسب.

### Success
Feedback واضح.

### Partial Data
تعامل محترم مع نقص البيانات.

### Permission Denied
عرض مناسب بدون كشف بيانات حساسة.

### Offline / Network Failure
UX محترمة عند الحاجة.

### Long-running Operations
Progress / Pending status.

---

# 15. Forms

أي Form مهم يجب أن يكون:

- واضح
- مرتب
- RTL-friendly
- Validation
- Field-level errors
- Submit state
- Duplicate submission protection
- Success feedback
- Error recovery
- Confirmation للعمليات الخطرة

لا تعتمد على browser validation وحدها.

---

# 16. Tables

الجداول الإدارية لازم تكون Professional.

ادعم حيثما يحتاج الـDomain:

- Search
- Filters
- Sort
- Pagination
- Column control
- Status
- Row actions
- Bulk actions
- Detail navigation
- Loading
- Empty
- Error

ولا تضع 15 column صغير في Mobile.

---

# 17. Charts & Analytics

استخدم charts فقط عندما تخدم السؤال.

لا تضف charts decorative.

مثال:

"هل مستوى الحضور يتحسن؟"

"أين الطلاب المتأخرون؟"

"كيف تطور أداء الطالب؟"

كل Chart يجب أن يكون له:

- Title واضح
- Metric definition
- Time range
- Tooltip
- Empty state
- Loading state
- Error state
- Accessible alternative عندما يكون مناسبًا

---

# 18. Responsive Design

اختبر:

- Mobile
- Tablet
- Desktop
- Large screens

خصوصًا:

- Student
- Parent
- Attendance
- QR
- Payment Review
- Tables
- Forms
- Course Learning
- Video
- Analytics

الـMobile مش "Desktop صغير".
لازم يكون **Responsive Experience مصمم فعليًا للموبايل**.

---

# 19. Accessibility

راجع:

- Keyboard navigation
- Focus states
- Labels
- Contrast
- Semantic HTML
- ARIA where needed
- Screen-reader friendliness
- Reduced motion where appropriate
- Error announcements
- Form accessibility

---

# 20. Performance

الـFrontend يجب أن يكون:

- Fast
- Lazy-loaded حيث مناسب
- Code-split
- Images optimized
- Avoid unnecessary rerenders
- Avoid huge client bundles
- Pagination for large datasets
- Virtualization where justified
- Proper caching strategy
- No giant page payloads

---

# 21. RTL / Arabic

Arabic RTL ليست مجرد `dir="rtl"`.

راجع:

- Layout
- Icons
- Directional icons
- Tables
- Charts
- Forms
- Dates
- Numbers
- Navigation
- Sidebars
- Modals
- Tooltips

والـUI لازم تبدو طبيعية باللغة العربية.

اللغة الأساسية Arabic، لكن بنية الـi18n يجب أن تكون سليمة للتوسع.

---

# 22. Security في الـFrontend

الـFrontend ليس Security Boundary، لكن لازم يدعم الـSecurity بشكل صحيح:

- Permission-aware UI
- Protected routes
- Secure auth handling
- Safe rendering
- No sensitive data in localStorage بشكل عشوائي
- No secrets in client bundle
- Safe file upload UX
- Session expiry handling
- Unauthorized response handling
- Tenant context handling without trusting client input

الـBackend يظل صاحب القرار النهائي.

---

# 23. Multi-Tenant UI

الـFrontend لازم يتعامل مع Tenant-aware experience.

يشمل حسب الـTenant:

- Branding
- Logo
- Name
- Theme
- Domain / Subdomain context
- Feature availability
- Authentication mode
- Permissions

ولا تسمح للـClient بتحديد Tenant access من نفسه.

---

# 24. Access / Entitlement UX

الـFrontend لازم يفهم الفرق بين:

- Authentication
- Authorization
- Subscription
- Entitlement

المستخدم Logged In لا يعني أن عنده Access للـCourse.

ووجود Subscription لا يعني بالضرورة أن كل Features متاحة له.

اعرض Access state الحقيقي بوضوح، مثل:

- Active
- Pending
- Expired
- Restricted
- Upgrade required
- Payment pending

---

# 25. Payment UX

Payment screens لازم تكون احترافية وواضحة.

مثلاً:

- Package details
- Amount
- Payment method
- Instructions
- Transfer destination
- Proof upload
- Review status
- Timeline
- Rejection reason عند وجودها
- Next action

لا تجعل الدفع مجرد Form صغير.

---

# 26. Attendance UX

Attendance ليست Table فقط.

ممكن تحتاج:

- Session context
- Date
- Branch
- Classroom
- Teacher
- Student roster
- Present / Absent / Late
- QR scanning
- Time validation
- Confirmation
- Correction flow
- Audit visibility

حسب الـBackend الفعلي.

---

# 27. Course Builder UX

Course Builder من أهم الـWorkspaces.

يجب أن يدعم حسب الـBackend:

- Modules
- Lessons
- Videos
- Materials
- Assignments
- Quizzes
- Exams
- Ordering
- Publish / Draft
- Visibility
- Progress context

والـUX يجب أن تجعل بناء Course واضح وسهل.

---

# 28. Exam Builder UX

يجب أن يدعم حسب الـBackend:

- Question Bank
- Question creation
- Question types الفعلية
- Ordering
- Scoring
- Rules
- Preview
- Publish
- Draft
- Attempt state
- Results

---

# 29. Student Learning UX

هذه ليست Admin UI.

ركز على:

- Continue learning
- Lesson navigation
- Video
- Progress
- Next action
- Completion
- Assignments
- Exams
- Feedback
- Upcoming sessions

التجربة لازم تحسسك أنك داخل Learning Product حقيقي.

---

# 30. Avoid AI-generated visual sameness

تجنب تمامًا الشكل المعتاد الذي تنتجه أنظمة AI بسرعة.

لا تبني:

- نفس Sidebar
- نفس 4 KPI cards
- نفس chart
- نفس table
- نفس white cards
- نفس gradient
- نفس avatar rows

في كل Role.

اعمل **Visual Hierarchy مختلفة حسب الـuse case**.

الطالب:
Learning-first.

المدرس:
Teaching Operations.

المساعد:
Task / Execution-first.

ولي الأمر:
Monitoring-first.

الإدارة:
Operations / Analytics-first.

Platform Admin:
System / Governance-first.

---

# 31. Micro-interactions

استخدم Motion بشكل خفيف واحترافي عند الحاجة:

- Page transitions
- Modal entrance
- Toasts
- Status changes
- Progress
- Loading
- Success

بدون مبالغة.

---

# 32. Real Content

لا تستخدم:

"Lorem ipsum"
"Sample Student"
"John Doe"
"Lorem text"

في المنتج النهائي.

استخدم Content منطقي يناسب منصة تعليمية عربية.

لكن لا تزعم أن Mock Data هي بيانات حقيقية من الـBackend.

---

# 33. Design Tokens

كل شيء مهم يجب أن يعتمد على Tokens / Shared styles.

ممنوع أن تكون كل صفحة:

- Padding مختلف
- Radius مختلف
- Font sizes عشوائية
- Shadows مختلفة
- Colors مختلفة

---

# 34. Component Reuse

لا تعيد كتابة نفس المكون عدة مرات.

لكن أيضًا لا تنشئ Mega Component فيه مئات الـprops.

استخدم:

- Shared primitives
- Feature-level components
- Domain-level patterns

بحدود واضحة.

---

# 35. No Giant Pages

ممنوع ملفات مثل:

- StudentDashboard.tsx بآلاف الأسطر
- TeacherDashboard.tsx بآلاف الأسطر
- AllStudents.tsx يحتوي كل شيء
- AllPayments.tsx يحتوي كل شيء

قسمها حسب الوظيفة.

---

# 36. Frontend Task Definition

من الآن فصاعدًا، أي Frontend Task يجب أن تبدأ بـ:

## Task
ما المطلوب؟

## Business Goal
ليه بنعمله؟

## User
مين هيستخدمه؟

## Backend Capabilities
إيه الـAPIs والـDomain capabilities الموجودة؟

## Screen Inventory
إيه الشاشات المطلوبة؟

## User Flows
إيه الـflows؟

## Components
إيه الـcomponents؟

## States
Loading / Empty / Error / Success / Restricted / etc.

## Permissions
مين يقدر يشوف أو يعمل إيه؟

## Responsive
إيه المطلوب على Mobile / Tablet / Desktop؟

## Accessibility
إيه المطلوب؟

## Acceptance Criteria
إيه الشروط اللي لازم تتحقق؟

## Evidence
إزاي تثبت إن الـTask اكتملت؟

---

# 37. Frontend Completion Gate

قبل أن تقول:

**DONE**

يجب أن تنفذ:

### Functional Check
- All flows work
- Real API connected
- Permissions correct
- Validation correct

### Visual Check
- Professional
- Consistent
- No generic AI look
- Proper spacing
- Proper typography
- Proper hierarchy
- Good content density

### UX Check
- Easy to understand
- Clear next action
- Good feedback
- No dead ends
- No unnecessary clicks

### Responsive Check
- Mobile
- Tablet
- Desktop

### Accessibility Check
- Keyboard
- Labels
- Contrast
- Focus

### Technical Check
- TypeScript
- Lint
- Tests
- Build
- No obvious console errors

### Evidence Check
يجب أن تقدم:

- Route
- Screenshots
- Commands
- Test results
- Files changed
- Known limitations

بدون ذلك:

**لا تقول Done.**

---

# 38. Visual QA is mandatory

لكل مجموعة صفحات رئيسية:

اعمل Visual Review.

راجع:

- Alignment
- Typography
- Density
- Hierarchy
- Empty space
- Consistency
- Responsive behavior
- Error states
- Loading states
- Arabic RTL quality

ولو فيه Browser / Screenshot automation متاح، استخدمه.

---

# 39. No Self-Certification Without Evidence

ممنوع تقول:

"الصفحة أصبحت Premium."

بدل ذلك اكتب:

- What changed
- Why
- Before / After evidence
- Route
- Screenshots
- Test result

---

# 40. Create a Frontend Recovery Plan

بعد الـAudit، أنشئ:

`docs/frontend/frontend-recovery-plan.md`

ويحتوي على:

1. Current problems
2. Priority
3. Design system work
4. Missing routes
5. Missing workflows
6. Missing backend integrations
7. Weak screens
8. Responsive issues
9. Accessibility issues
10. Visual quality issues
11. Testing gaps
12. Recovery milestones

قسّم الإصلاح إلى:

### F0 — Audit
فهم الوضع الحالي.

### F1 — Design System
إصلاح الـFoundations والـComponents.

### F2 — Core App Shell
Navigation / Layout / Role shells / responsive behavior.

### F3 — Public Experience
Landing / Public Profiles / Auth screens.

### F4 — Student Experience
Student dashboard + learning.

### F5 — Teacher Experience
Teaching operations.

### F6 — Assistant Experience
Operational workflows.

### F7 — Parent Experience
Monitoring experience.

### F8 — Center / School Admin
Operations console.

### F9 — Platform / Support
Governance workspace.

### F10 — Cross-Cutting
Notifications / Payments / Search / Settings / Reports.

### F11 — Visual QA
Full UI audit.

### F12 — Frontend Verification
Functional + visual + responsive + accessibility + performance.

---

# 41. لا تهدم الـFrontend كله بدون سبب

لا تهدم الـFrontend كله لمجرد إنه ضعيف.

اعمل:

**Audit → Preserve valuable parts → Refactor where useful → Replace weak parts → Reuse working integrations**

الحاجات الجيدة الموجودة بالفعل يجب الحفاظ عليها.

---

# 42. Backend is the source of capability truth

لا تخترع Frontend Features من عندك.

استخرج الـcapabilities من:

- Backend
- API Contracts
- Domain Models
- Permissions
- Business Requirements
- Master Specification

لكن إذا كان الـBackend يوفر Capability مهمة والـFrontend لا يعرضها، سجلها كـFrontend Gap.

---

# 43. Functional Gap vs Experience Gap

هناك نوعان من النقص:

### Functional Gap
Feature غير موجودة أو غير مربوطة.

### Experience Gap
Feature موجودة لكنها سطحية أو سيئة أو غير احترافية.

يجب اكتشاف النوعين.

---

# 44. Security / Product quality details التي لا يجب إخفاؤها عن الواجهة

راجع الـUI بحيث يتعامل مع الحالات الحقيقية للـDomain:

- Authentication vs Authorization
- Subscription vs Entitlement
- Payment pending / approved / rejected
- Credential active / suspended / revoked / expired
- Device bound / replacement / approval
- Permission denied
- Session expired
- Tenant boundary
- Provider unavailable
- Validation errors
- Retryable failures

لا تخفي تعقيد الـDomain بطريقة تجعل الـUI مضللة.

---

# 45. Final Mission

مهمتك الأساسية:

**اجعل الـFrontend يعكس قيمة وقوة الـBackend.**

لا أريد Frontend:

- Simple
- Generic
- AI-looking
- Empty
- CRUD-only

أريد:

**A premium, modern, information-rich, role-aware, Arabic-first, Gulf/Saudi-oriented education SaaS experience.**

---

# 46. المطلوب منك الآن

ابدأ بالترتيب التالي:

## STEP 1
اقرأ:

- `AGENTS.md`
- `docs/master/MASTER-SPECIFICATION.md`
- `docs/phases/phase-g.md`
- `docs/phases/phase-h.md`
- `docs/master/MASTER-SPECIFICATION.md` (Phase K)
- `docs/frontend/`
- Backend/API documentation
- Relevant domain documentation
- Current frontend source code

## STEP 2
Audit the existing frontend.

## STEP 3
أنشئ:

`docs/frontend/frontend-audit.md`

## STEP 4
أنشئ:

`docs/frontend/frontend-recovery-plan.md`

## STEP 5
أنشئ complete screen / route / capability matrix.

## STEP 6
Fix the Design System.

## STEP 7
Fix the App Shell.

## STEP 8
Rebuild the highest-value screens.

ابدأ بالصفحات الأكثر تأثيرًا على perception + daily usage، وليس صفحات CRUD الصغيرة أولًا.

## STEP 9
Connect every recovered feature to real backend capability.

## STEP 10
Run functional + visual + responsive + accessibility checks.

---

# 47. Final Reporting Format

في نهاية كل Frontend Task، أريد:

## Status
- Complete
- Partial
- Blocked

## What Changed

## Screens / Routes

## Backend Capabilities Used

## Permissions

## UI/UX Improvements

## Responsive Improvements

## Accessibility Improvements

## Tests Run

## Visual QA Performed

## Evidence

## Remaining Gaps

## Known Limitations

---

# 48. Final Rule

من هذه اللحظة:

**"The route exists" ليس Definition of Done.**

**"The component renders" ليس Definition of Done.**

**"The API is connected" ليس Definition of Done.**

**"The page works" ليس Definition of Done.**

Definition of Done للـFrontend هي:

**Capability + Workflow + Data + Permissions + UI + UX + States + Responsive + Accessibility + Integration + Testing + Visual QA + Evidence**

كلهم معًا.

# END OF FRONTEND RECOVERY & UI/UX QUALITY GATE
