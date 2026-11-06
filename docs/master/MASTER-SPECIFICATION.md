أيوه، دي **Phase K**، وهي آخر مرحلة في دورة **التخطيط والتوثيق المعماري** اللي بنبنيها دلوقتي.  
بعدها مايبقاش عندنا Phase L للتصميم النظري؛ ننتقل للتنفيذ الفعلي، والـK تبقى المرجع الرئيسي اللي أي AI Agent يرجع له.

:::writing{variant="document" id="67143" title="Phase K — Final Master Specification & AI Handoff"}
# PHASE K — FINAL MASTER SPECIFICATION & AI HANDOFF

**Project:** Multi-Tenant SaaS LMS & Education Management Platform  
**Document Type:** Final Master Specification  
**Status:** Draft — Pending Final Approval  
**Purpose:** Single Source of Truth for AI-Assisted Implementation  
**Architecture Baseline:** Phases A–J Approved  
**Current Phase:** K — Final Documentation Phase  
**Implementation Status:** Planning / Specification Complete — Implementation Not Yet Started

---

# 1. Document Purpose

This document is the master handoff specification for the entire platform.

Its purpose is to allow a new developer, technical lead, engineering team, or AI coding agent to enter the project and understand:

```text
What the system is
Why it exists
How it is structured
What has been approved
What has been decided
What remains open
How tenant isolation works
How identity works
How authentication works
How authorization works
How billing works
How credentials work
How education works
How attendance works
How assessment works
How analytics works
How integrations work
How the API works
How the frontend works
How testing works
How infrastructure works
How implementation must proceed
How AI agents must behave
How completion is verified
```

This document is intended to prevent architectural memory loss between AI sessions, developers, repositories, and implementation phases.

---

# 2. Master Principle

The project follows:

```text
Specification
      ↓
Architecture
      ↓
Domain
      ↓
Contracts
      ↓
Implementation
      ↓
Verification
      ↓
Documentation
      ↓
Release
```

No implementation should bypass these relationships.

---

# 3. Single Source of Truth

The project must have a single authoritative documentation root.

Recommended:

```text
docs/
```

The master reference is:

```text
docs/master/
└── MASTER-SPECIFICATION.md
```

This document represents the consolidated architectural baseline.

However, the master document does not replace specialized documents.

Instead:

```text
MASTER SPECIFICATION
        ↓
Specialized Specification
        ↓
Implementation
```

---

# 4. Documentation Hierarchy

Recommended final structure:

```text
docs/
├── master/
│   └── MASTER-SPECIFICATION.md
│
├── requirements/
│   ├── brd.md
│   ├── functional-requirements.md
│   └── non-functional-requirements.md
│
├── architecture/
│   ├── architecture.md
│   ├── system-context.md
│   ├── backend.md
│   ├── frontend.md
│   ├── tenancy.md
│   ├── identity.md
│   ├── authorization.md
│   ├── credentials.md
│   ├── billing.md
│   ├── integrations.md
│   ├── security.md
│   ├── scalability.md
│   └── observability.md
│
├── domains/
│   ├── identity/
│   ├── tenancy/
│   ├── education/
│   ├── classroom/
│   ├── attendance/
│   ├── assessment/
│   ├── billing/
│   ├── credentials/
│   ├── analytics/
│   ├── meetings/
│   ├── media/
│   ├── communication/
│   ├── reporting/
│   ├── platform/
│   └── support/
│
├── api/
├── frontend/
├── testing/
├── infrastructure/
├── decisions/
└── project-management/
```

---

# 5. Approved Phase Baseline

The authoritative project status is:

```text
Phase A — APPROVED
Phase B — APPROVED
Phase C — APPROVED
Phase D — APPROVED
Phase E — APPROVED
Phase F — APPROVED
Phase G — APPROVED
Phase H — APPROVED
Phase I — APPROVED
Phase J — APPROVED
Phase K — FINAL MASTER SPECIFICATION
```

No previous approved phase may be silently rewritten.

If implementation requires a change:

```text
Problem
   ↓
ADR
   ↓
Impact Analysis
   ↓
Approval
   ↓
Specification Update
   ↓
Implementation
```

---

# 6. Business/Product Summary

The platform is a multi-tenant SaaS LMS and education management system targeting the Gulf/Saudi market.

It supports both:

```text
Individual Teacher
Educational Center / Institution
```

and both:

```text
Online
Offline
Online + Offline
```

within the same tenant model.

---

# 7. Product Experience

The primary application is:

```text
Web Application
+
Responsive
+
Mobile-First
+
PWA-capable
```

Primary language:

```text
Arabic
```

Direction:

```text
RTL
```

Typography:

```text
IBM Sans
```

Themes:

```text
Light
Dark
```

Branding:

```text
White-Label per Tenant
```

No native mobile application is required as part of the current baseline.

---

# 8. Tenant Model

The platform is multi-tenant.

A tenant may represent:

```text
Teacher
or
Education Center / Institution
```

Each tenant has:

```text
teachers
assistants
students
parents
courses
lessons
classes
payments
subscriptions
entitlements
credentials
analytics
reports
```

Tenant boundaries are mandatory.

---

# 9. Control Plane / Tenant Data Plane

The platform uses:

```text
Control Plane
+
Tenant Data Plane
```

Conceptually:

```text
                    CONTROL PLANE
                         │
                         ▼
                  Control Database
                         │
          ┌──────────────┼───────────────┐
          ▼              ▼               ▼
      Tenant A       Tenant B        Tenant C
       Database       Database        Database
```

---

# 10. Control Database

The Control DB contains platform/global infrastructure information.

Examples:

```text
tenants
tenant registry
tenant type/status
tenant DB metadata
tenant domains
tenant branding metadata
tenant feature configuration
tenant authentication configuration

platform users
platform roles
platform permissions

global student identities
student identity mappings

support sessions
platform audit logs
global usage metrics
platform configuration
```

---

# 11. Tenant Database

Each tenant database contains tenant business data.

Examples:

```text
teachers
staff
assistants
students
parents
parent relationships

courses
lessons
assignments
submissions

branches
classrooms
classes
sessions
attendance

exams
questions
attempts
answers
grades

packages
payments
subscriptions
entitlements

credentials
device bindings

meetings
media references

analytics
reports
notifications

tenant audit
```

---

# 12. Tenant Isolation Rule

The system must preserve tenant isolation across:

```text
Application
Authentication
Authorization
Database
Cache
Queue
Storage
Logging
Reporting
Analytics
```

A tenant identifier supplied by a client is never trusted as the authority for tenant access.

Tenant context is resolved server-side.

---

# 13. Student Identity Architecture

There are two levels:

```text
Global Student Identity
```

and:

```text
Tenant Student Account
```

Conceptually:

```text
GlobalStudentIdentity
       │
       ├── Tenant A Student Account
       ├── Tenant B Student Account
       └── Tenant C Student Account
```

A student may therefore learn with multiple teachers/tenants.

---

# 14. Global Identity Rule

The following invariant is mandatory:

```text
Global Identity
      ≠
Cross-Tenant Authorization
```

A shared identity does not automatically grant access to another tenant.

---

# 15. Parent Architecture

Parent accounts are tenant-scoped.

A parent may have multiple children in the same tenant.

The system explicitly models:

```text
Parent
+
Student
+
Parent-Student Relationship
```

The relationship may support configurable roles such as:

```text
Father
Mother
Guardian
```

where needed.

---

# 16. Authentication Architecture

Supported tenant authentication modes:

```text
PASSWORD / CONTACT
CREDENTIAL ONLY
COMBINED
```

Authentication is separate from:

```text
Authorization
Subscription
Entitlement
Credential
```

---

# 17. Credential Architecture

The platform uses Access Credentials as a security/authentication mechanism.

Credential lifecycle:

```text
GENERATED
   ↓
ASSIGNED
   ↓
ISSUED
   ↓
PENDING ACTIVATION
   ↓
ACTIVATED
   ↓
DEVICE BOUND
   ↓
ACTIVE
   ↓
SUSPENDED / REVOKED / EXPIRED
```

Exact transitions are governed by the Credentials domain specification.

---

# 18. Credential Security

Raw credential secrets must never be:

```text
stored in plaintext
logged
returned through normal API responses
exposed unnecessarily to frontend code
```

Credential possession is not equivalent to an everlasting session.

---

# 19. Device Binding

Credential access may be bound to a device.

Device binding is treated as a security object.

The system must support:

```text
initial binding
additional/replacement policy
device revocation
credential revocation
```

Device fingerprinting alone is not considered perfect security.

---

# 20. QR Code Architecture

QR representations may be used for:

```text
student credential
attendance
identity/access workflows
```

QR values must use safe opaque representations.

Secrets must not be exposed simply because a QR is displayed.

---

# 21. Screenshot Prevention

The web platform cannot guarantee prevention of screenshots or external camera recording.

The security model therefore relies on:

```text
authentication
authorization
device controls
short-lived access where applicable
dynamic watermark
usage tracking
abuse detection
audit
```

---

# 22. Video Watermark

Video playback may display:

```text
Student Name
Student ID
Student Contact Number
```

as a dynamic watermark.

Purpose:

```text
deterrence
traceability
abuse reduction
```

It is not represented as absolute screenshot prevention.

---

# 23. Authorization Architecture

Authorization uses:

```text
RBAC
+
ABAC / Policy
+
Scope
+
Attributes
```

Conceptually:

```text
Actor
+
Role
+
Action
+
Resource
+
Tenant
+
Attributes
+
Scope
+
Context
+
Policy
```

produces:

```text
ALLOW
or
DENY
```

---

# 24. Permission Model

Permissions are granular.

Examples:

```text
students.view
students.create
students.update
students.delete

payments.view
payments.create
payments.approve
payments.reject

credentials.view
credentials.issue
credentials.activate
credentials.revoke

attendance.view
attendance.record
attendance.correct
```

---

# 25. Dynamic Authorization

The system supports:

```text
system roles
custom roles
permissions
rules
scopes
attributes
allow
deny
inheritance
```

Authorization is not hardcoded as scattered role checks.

---

# 26. Authorization Invariant

Frontend visibility is not security.

The backend must independently enforce:

```text
authentication
authorization
tenant scope
resource scope
business policy
```

---

# 27. Core Domain Separation

The system explicitly distinguishes:

```text
User ≠ Student
Student ≠ Credential
Credential ≠ Session
Payment ≠ Subscription
Subscription ≠ Entitlement
Entitlement ≠ Authentication
Authentication ≠ Authorization
Teacher ≠ Role
Role ≠ Permission
Parent ≠ Student
Course ≠ Subscription
Attendance ≠ Session
Video Event ≠ Learning Progress
```

These are architectural invariants.

---

# 28. Education Domain

Core education model:

```text
Tenant
  ↓
Teachers / Staff
  ↓
Students
  ↓
Courses
  ↓
Lessons
  ↓
Enrollments
```

Courses may contain:

```text
lessons
videos
files
assignments
exams
meetings
```

according to product rules.

---

# 29. Offline Education

Offline education supports physical learning environments:

```text
Branches
Classrooms
Classes
Sessions
Teachers
Assistants
Students
Attendance
Assessment
Performance
```

---

# 30. Attendance

Attendance is tied to:

```text
Student
+
Session
+
Recorded By
+
Timestamp
+
Status
```

A scanner may be an authorized assistant or teacher.

---

# 31. QR Attendance

Conceptual workflow:

```text
Student QR
     ↓
Assistant Scanner
     ↓
Attendance API
     ↓
Tenant Resolution
     ↓
Authorization
     ↓
Session Validation
     ↓
Student Resolution
     ↓
Attendance Record
     ↓
Audit/Event
```

---

# 32. Attendance Integrity

The system must prevent unintended duplicate attendance for the same:

```text
Session
+
Student
```

Repeated scans must produce deterministic behavior.

---

# 33. Assessment

Assessment includes:

```text
Assignments
Submissions
Exams
Questions
Attempts
Answers
Grades
Publication
```

Exam attempts are stateful objects.

---

# 34. Exam Attempt Lifecycle

Conceptually:

```text
CREATED
   ↓
STARTED
   ↓
IN PROGRESS
   ↓
SUBMITTED
   ↓
GRADED
   ↓
PUBLISHED
```

Illegal transitions must fail.

---

# 35. Exam Integrity

Exam submission must account for:

```text
timing
session validity
authorization
duplicate submission
concurrent submission
network failure
```

The server is authoritative.

---

# 36. Billing Architecture

The billing model is:

```text
Package
   ↓
Payment
   ↓
Review
   ↓
Subscription
   ↓
Entitlement
   ↓
Access
```

Not:

```text
Student.is_paid
```

---

# 37. Package Types

Current conceptual packages:

```text
ONLINE
OFFLINE
ONLINE_AND_OFFLINE
```

Packages are tenant-owned.

---

# 38. Manual Payment Workflow

Student submits:

```text
Name
Email
Phone / Sender Number
Payment Method
Payment Proof
```

Initial payment methods:

```text
InstaPay
Cash
```

Payment is initially manually reviewed.

---

# 39. Payment State

Conceptual:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
CANCELLED
```

Final state transitions are controlled by Billing specification.

---

# 40. Payment Approval

Payment approval may trigger:

```text
Payment State Change
+
Subscription
+
Entitlement
+
Credential action when configured
+
Notification
+
Audit
```

The exact synchronous/async split is defined by implementation contract.

---

# 41. Billing Invariants

Mandatory:

```text
Payment ≠ Subscription
Subscription ≠ Entitlement
Payment ≠ Authentication
Payment Approval ≠ Permanent Access by itself
```

Access is determined through the approved entitlement/access model.

---

# 42. Analytics Architecture

Analytics uses:

```text
Raw Events
+
Metric Definitions
+
Metric Versions
+
Measurements
+
Aggregations
+
Read Models
```

Dashboards should not process huge raw event sets synchronously.

---

# 43. Learning Analytics

Standard learning KPIs may include:

```text
video completion
video engagement
attendance %
assignment completion
assignment delay
exam performance
course progress
improvement
```

---

# 44. Custom Metrics

Teachers may define custom metrics.

Examples:

```text
Math:
accuracy
speed
homework
attendance
exam

Language:
speaking
writing
reading
listening
```

Custom metric definitions must support versioning.

---

# 45. Historical Analytics Integrity

A historical measurement associated with Metric Version 1 must remain interpretable even if Metric Version 2 is later introduced.

No silent recalculation that changes historical meaning.

---

# 46. Meetings

Meetings use provider abstraction.

Conceptual:

```text
Meeting
   ↓
MeetingProvider
   ↓
GoogleMeetAdapter
```

The core domain does not depend directly on Google-specific SDK structures.

---

# 47. Media

Video/content providers use the same abstraction principle:

```text
VideoProvider
   ↓
Provider Adapter
```

Potential providers:

```text
Google Drive
Vimeo
Future Providers
```

External provider replacement should not require rewriting core domain logic.

---

# 48. Communication

Communication separates:

```text
Notification
```

from:

```text
Delivery Channel
```

Potential channels:

```text
In-App
Email
WhatsApp
SMS
```

WhatsApp remains future scope unless explicitly promoted.

---

# 49. Reporting

Reports should be domain-neutral where practical.

Large reports should be asynchronous:

```text
Generate
   ↓
Queue
   ↓
Process
   ↓
Store
   ↓
Ready
   ↓
Download / Deliver
```

---

# 50. Platform Administration

Platform administration is separate from tenant administration.

Roles include:

```text
Super Admin
Support
```

Platform admin can have global aggregate visibility.

---

# 51. Platform Privacy

Platform visibility includes:

```text
usage
consumption
counts
aggregate metrics
infrastructure indicators
```

Private tenant data is not automatically exposed simply because a user is a platform administrator.

---

# 52. Support Access

Support users may temporarily enter a tenant only through an explicit support session.

Support session requires:

```text
actor
tenant
reason
authorization
expiration
audit
```

---

# 53. Support Invariant

When support session ends:

```text
tenant access ends
```

Support sessions are:

```text
temporary
auditable
revocable
tenant-scoped
```

---

# 54. API Architecture

The platform exposes:

```text
/api/v1
```

The API is a stable contract.

The API should use:

```text
authentication
tenant resolution
authorization
validation
DTOs
application use cases
domain
infrastructure
```

---

# 55. API Layering

Expected:

```text
HTTP
 ↓
Authentication
 ↓
Tenant Resolution
 ↓
Authorization
 ↓
Validation
 ↓
DTO
 ↓
Application Use Case
 ↓
Domain
 ↓
Repository / Provider
```

---

# 56. API Rules

The API must not:

```text
contain large business workflows inside controllers
trust client tenant IDs
serialize entire models automatically
call vendor SDKs directly from domain logic
allow unbounded collections
use frontend authorization as security
```

---

# 57. API Errors

Errors use stable machine-readable codes.

Example:

```json
{
  "error": {
    "code": "PAYMENT_NOT_APPROVABLE",
    "message": "The payment cannot be approved in its current state.",
    "details": {}
  }
}
```

---

# 58. API Idempotency

Critical operations use:

```text
Idempotency-Key
```

where applicable.

Examples:

```text
Payment approval
Credential activation
Device binding
Device replacement
Attendance scan
Exam submission
Meeting creation
```

---

# 59. API Contract Documentation

OpenAPI is the API contract reference.

Every important endpoint must document:

```text
authentication
authorization
tenant scope
request
response
validation
errors
idempotency
side effects
```

---

# 60. Frontend Architecture

Frontend uses:

```text
Next.js
React
TypeScript
```

and follows feature-oriented architecture.

---

# 61. Frontend Experience Boundaries

Separate experiences:

```text
Student
Parent
Teacher
Assistant
Platform
Support
```

They may share primitives, but not one giant dashboard implementation.

---

# 62. Frontend Structure

Conceptually:

```text
App
 ↓
Layout
 ↓
Feature
 ↓
Application Hook
 ↓
API Client
 ↓
API
```

Shared:

```text
Design System
Auth
Tenant
Permissions
Theme
RTL/i18n
Telemetry
Error Handling
```

---

# 63. Frontend Anti-God-File Rule

Avoid:

```text
Dashboard.tsx
Students.tsx
Teachers.tsx
api.ts
utils.ts
permissions.ts
```

containing unrelated functionality across the system.

Large features should be broken into purpose-driven modules.

---

# 64. Design System

Levels:

```text
Tokens
 ↓
UI Primitives
 ↓
Patterns
 ↓
Feature Components
 ↓
Pages
```

---

# 65. Design Tokens

Semantic tokens should include concepts such as:

```text
background
surface
foreground
muted
primary
success
warning
danger
border
spacing
radius
typography
```

---

# 66. RTL

Arabic is the first-class layout direction.

The system must support RTL across:

```text
forms
tables
navigation
dialogs
breadcrumbs
charts
pagination
mobile layouts
```

---

# 67. Responsive Architecture

Mobile-first.

Major flows must work across:

```text
mobile
tablet
desktop
large desktop
```

Mobile is not just a compressed desktop layout.

---

# 68. PWA

The application should be PWA-capable.

Expected:

```text
installable
Add to Home Screen
application shell
icons
manifest
service worker
```

Full offline LMS behavior is not automatically assumed.

---

# 69. PWA Security

Sensitive data must not be casually cached by service workers.

Especially:

```text
payment proofs
credentials
private reports
support session data
tenant-private API responses
```

---

# 70. Student Dashboard

The student dashboard is a major product surface.

It should clearly expose:

```text
current learning
upcoming sessions
assignments
exams
progress
attendance
grades
meetings
notifications
```

The final visual hierarchy is a UX design decision, not a domain rule.

---

# 71. Teacher Dashboard

Potential information:

```text
students
courses
today's sessions
pending payments
attendance
assignments
exams
analytics
reports
notifications
```

---

# 72. Assistant Dashboard

Potential:

```text
today's sessions
attendance scanner
assigned students
payment review
tasks
notifications
```

Actual visibility follows permissions.

---

# 73. Parent Dashboard

Potential:

```text
children
attendance
progress
grades
reports
upcoming activities
notifications
```

---

# 74. Platform Dashboard

Potential:

```text
tenant count
active students
platform usage
infrastructure health
queue health
integration health
storage consumption
support activity
```

---

# 75. Testing Architecture

The project uses layered verification:

```text
Static Analysis
 ↓
Unit
 ↓
Domain
 ↓
Application
 ↓
Integration
 ↓
API
 ↓
Contract
 ↓
Component
 ↓
Feature
 ↓
E2E
 ↓
Security
 ↓
Performance
 ↓
Resilience
 ↓
Release Verification
```

---

# 76. Highest-Priority Test Areas

The most critical test categories are:

```text
Tenant Isolation
Authorization
Authentication
Payment Integrity
Credential Security
Exam Integrity
Data Integrity
Idempotency
Concurrency
```

---

# 77. Tenant Isolation Tests

For every important resource:

```text
Tenant A actor
→ attempts Tenant B resource
→ DENIED
```

Test this at:

```text
API
Database access
cache
storage
queues
frontend data cache
E2E
```

where relevant.

---

# 78. Security Test Categories

Required coverage includes:

```text
authentication
authorization
IDOR/BOLA
cross-tenant access
credential abuse
session security
rate limits
file uploads
webhooks
SSRF
XSS
SQL injection
secret leakage
support access
```

---

# 79. Performance

Performance tests must consider:

```text
small tenant
medium tenant
large tenant
very large tenant
```

and realistic behaviors:

```text
login bursts
attendance bursts
exam submission bursts
dashboard traffic
video event ingestion
report generation
notifications
```

---

# 80. Resilience

The system must be tested against failure of:

```text
database
queue
cache
storage
email
Google Meet
video provider
network
```

Business state must remain safe according to each dependency's failure contract.

---

# 81. Infrastructure

The platform is designed for:

```text
containerized runtime
horizontal scaling
managed PostgreSQL
queue workers
cache
object storage
monitoring
CI/CD
```

The exact cloud provider/tooling remains implementation-specific until selected.

---

# 82. Deployment

Target flow:

```text
Git
 ↓
CI
 ↓
Static Verification
 ↓
Tests
 ↓
Security
 ↓
Build Artifact
 ↓
Staging
 ↓
Verification
 ↓
Production
 ↓
Smoke Tests
```

---

# 83. Infrastructure Scaling

The application tier should be horizontally scalable.

Tenant databases can evolve:

```text
shared
 ↓
dedicated DB
 ↓
dedicated DB infrastructure
 ↓
dedicated cluster/infrastructure
```

as tenant size requires.

---

# 84. Database Migration

Tenant migrations must be centrally orchestrated.

Status should distinguish:

```text
pending
running
success
failed
retryable
blocked
```

A failed tenant migration must not silently appear as successful.

---

# 85. Backups

Backup coverage includes:

```text
Control DB
Tenant DBs
Critical storage
Configuration
```

Restore testing is required.

---

# 86. Tenant-Level Recovery

The architecture should support individual tenant restoration where technically feasible.

This preserves one of the main benefits of the isolated-store-per-tenant model (a SQLite file, a PostgreSQL schema or a database depending on the driver — see ADR-002).

---

# 87. Observability

Observability includes:

```text
logs
metrics
traces
audit
health checks
alerts
```

---

# 88. Request Correlation

A request identifier should trace important operations across:

```text
HTTP
Application
Queue
Integration
Audit
```

where applicable.

---

# 89. AI Implementation Governance

This project is explicitly designed to be implemented with AI assistance.

AI is therefore treated as an engineering execution tool, not as the source of truth.

The source of truth remains:

```text
Approved Documentation
```

---

# 90. AI Onboarding Protocol

A new AI agent entering the repository must read:

```text
1. MASTER-SPECIFICATION.md
2. architecture.md
3. relevant domain specification
4. security requirements
5. API specification
6. frontend specification if relevant
7. testing specification
8. infrastructure specification if relevant
9. current project status
10. relevant ADRs
```

It should not start coding immediately.

---

# 91. AI Context Loading Order

Recommended:

```text
Master
 ↓
Architecture
 ↓
Domain
 ↓
Contract
 ↓
Current Implementation
 ↓
Tests
 ↓
Task
```

---

# 92. AI Task Definition

Every implementation task should have:

```text
Task ID
Objective
Context
Required Documents
Dependencies
Scope
Non-Scope
Acceptance Criteria
Security Requirements
Test Requirements
Documentation Requirements
```

---

# 93. AI Task Example

```text
TASK-ID:
BILL-APPROVE-001

OBJECTIVE:
Implement Payment Approval Use Case.

READ:
Master Specification
Billing Domain
Security
API Contract
Testing Contract

DEPENDENCIES:
Payment
Subscription
Entitlement
Authorization
Audit

MUST:
- validate state
- validate tenant
- authorize reviewer
- maintain idempotency
- grant correct entitlement
- audit operation
- emit required event

MUST NOT:
- grant access from payment submission
- bypass authorization
- create duplicate subscriptions
- access another tenant

TEST:
unit
integration
authorization
cross-tenant
idempotency
concurrency

DOCS:
billing
API
project status
changelog
```

---

# 94. AI Read Before Write Rule

Before modifying any file, the AI must determine:

```text
What owns this code?
What contract does it implement?
What dependencies exist?
What architecture rules apply?
What tests already exist?
What documentation must change?
```

---

# 95. AI Scope Control

AI tasks should explicitly define:

```text
Allowed Areas
Forbidden Areas
```

AI must not expand task scope silently.

---

# 96. AI Architecture Change Rule

If the AI discovers an architectural problem:

```text
Do not silently patch around it.
```

Instead:

```text
Document problem
+
Create ADR proposal
+
Explain impact
+
Pause affected design change
+
Update approved docs after decision
```

---

# 97. AI Verification Rule

The AI must distinguish:

```text
IMPLEMENTED
```

from:

```text
VERIFIED
```

and:

```text
PRODUCTION READY
```

---

# 98. Implementation Evidence

For each significant task:

```text
Task ID
Files Changed
Tests Added
Tests Executed
Tests Passed
Tests Failed
Security Review
API Impact
Database Impact
Documentation Updated
Known Limitations
Open Decisions
```

---

# 99. No Fake Evidence

AI must never claim:

```text
tests passed
deployment succeeded
provider works
migration completed
```

unless it actually has evidence.

---

# 100. Documentation Synchronization

Every meaningful implementation change must update relevant documentation.

Potential:

```text
architecture
domain
API
frontend
testing
infrastructure
project status
changelog
```

---

# 101. Status Synchronization

The AI must keep:

```text
PLANNED
READY
IN_PROGRESS
IMPLEMENTED
VERIFIED
BLOCKED
DEFERRED
PRODUCTION_READY
```

accurate.

---

# 102. Requirement Traceability

Every significant capability should trace:

```text
Requirement
 ↓
Use Case
 ↓
Domain
 ↓
API / UI
 ↓
Implementation
 ↓
Test
 ↓
Evidence
```

---

# 103. Security Invariants

The platform must preserve:

```text
SEC-INV-001
No unauthorized cross-tenant access.

SEC-INV-002
Frontend authorization never replaces backend authorization.

SEC-INV-003
Credential ≠ permanent session.

SEC-INV-004
Payment ≠ entitlement.

SEC-INV-005
Subscription ≠ authentication.

SEC-INV-006
Global identity ≠ automatic cross-tenant access.

SEC-INV-007
Support access is temporary and auditable.

SEC-INV-008
Secrets never appear in logs.

SEC-INV-009
Security failures default to deny.

SEC-INV-010
Tenant context is required before tenant data access.
```

---

# 104. Scalability Invariants

```text
SCALE-INV-001
Application tier can scale horizontally.

SCALE-INV-002
Business logic is independent of physical DB location.

SCALE-INV-003
Large tenants can move to dedicated infrastructure.

SCALE-INV-004
Async workloads scale independently.

SCALE-INV-005
Analytics does not block transactional workloads.

SCALE-INV-006
External provider failure cannot corrupt core state.
```

---

# 105. Frontend Security Invariants

```text
FE-SEC-INV-001
Frontend is never the final authorization boundary.

FE-SEC-INV-002
Tenant context comes from trusted auth/application context.

FE-SEC-INV-003
Sensitive secrets are not unnecessarily stored client-side.

FE-SEC-INV-004
Tenant-scoped caches are isolated.

FE-SEC-INV-005
Support context is visibly temporary.

FE-SEC-INV-006
Critical mutations do not rely on optimistic state as truth.

FE-SEC-INV-007
Credential secrets do not enter ordinary client state.

FE-SEC-INV-008
PWA caching does not leak private tenant data.

FE-SEC-INV-009
Screenshot prevention is not guaranteed.

FE-SEC-INV-010
Server state is authoritative.
```

---

# 106. Infrastructure Security Invariants

```text
INF-SEC-INV-001
Production secrets are never committed.

INF-SEC-INV-002
Tenant DBs are resolved through trusted context.

INF-SEC-INV-003
Tenant data cannot be crossed using resource IDs alone.

INF-SEC-INV-004
Private storage is not publicly readable.

INF-SEC-INV-005
Queue workers preserve tenant boundaries.

INF-SEC-INV-006
Cache namespaces preserve tenant isolation.

INF-SEC-INV-007
Production access is least-privilege and auditable.

INF-SEC-INV-008
Infrastructure logs do not contain secrets.

INF-SEC-INV-009
Backups are protected as production data.

INF-SEC-INV-010
External failures cannot corrupt core transactions.
```

---

# 107. Architectural Anti-Patterns

The following are prohibited or strongly discouraged:

```text
God Classes
God Components
God Controllers
God Services
giant API files
giant dashboard files
direct DB access from frontend
domain code calling vendor SDKs
hardcoded role checks everywhere
client-trusted tenant IDs
payment = is_paid shortcut
global identity = global access
unbounded API lists
non-idempotent critical operations
silent state changes
secrets in logs
production secrets in Git
business logic in UI components
```

---

# 108. Architecture Dependency Direction

Backend:

```text
Presentation
   ↓
Application
   ↓
Domain
   ↓
Infrastructure
```

Frontend:

```text
Page
   ↓
Feature
   ↓
Data Layer
   ↓
API Contract
```

External providers:

```text
Domain Contract
   ↓
Provider Interface
   ↓
Adapter
   ↓
External System
```

---

# 109. Implementation Order

The approved implementation sequence is:

```text
01 Repository / Tooling
02 Runtime Foundation
03 Tenancy
04 Identity
05 Authentication
06 Authorization
07 Education
08 Attendance
09 Assessment
10 Billing / Entitlements
11 Credentials / Devices
12 Meetings / Media
13 Communication
14 Analytics
15 Reporting
16 Platform Administration
17 Support
18 Frontend Integration
19 Full Verification
20 Production Hardening
21 Production Release
```

---

# 110. Foundation-First Domains

The following must precede broad business implementation:

```text
Tenant
Identity
Authentication
Authorization
Core Infrastructure
```

---

# 111. Vertical Slice Strategy

After foundational boundaries stabilize, business capabilities should be implemented vertically.

Example:

```text
Student Creation
```

may include:

```text
Domain
Application
Persistence
API
Authorization
Frontend
Tests
Documentation
```

before moving endlessly to unrelated work.

---

# 112. Freeze Points

Major architecture freeze points:

```text
Freeze 1 — Tenancy
Freeze 2 — Identity / Auth
Freeze 3 — Authorization
Freeze 4 — API v1
Freeze 5 — Database Core
Freeze 6 — Frontend Shell
Freeze 7 — Production Infrastructure
```

Breaking changes after a freeze require explicit review/ADR.

---

# 113. MVP Principle

MVP should be explicitly defined before implementation expands.

Candidate core:

```text
Tenancy
Students
Parents
Teachers
Assistants
Courses
Lessons
Attendance
Assignments
Exams
Grades
Manual Payments
Subscriptions
Entitlements
Credentials
Meetings
Basic Analytics
Notifications
Dashboards
```

The exact MVP boundary remains subject to the approved Business Requirements.

---

# 114. Post-MVP Principle

Possible later capabilities:

```text
automated payments
official WhatsApp integration
advanced analytics
advanced abuse detection
additional providers
custom domains
advanced reporting
advanced automation
advanced offline/PWA
```

They should not silently enter MVP.

---

# 115. Open Decision Registry

The following categories remain open until explicitly finalized:

```text
Identifier format
API response envelope
Pagination standard
Concurrency mechanism
Authentication transport
Webhook model

Server-state library
Client-state library
Form library
UI library
PWA offline matrix
Exact routes
Navigation hierarchy
Timezone policy

Cloud provider
Container orchestration
PostgreSQL infrastructure
Cache
Object storage
CDN
Infrastructure as Code
CI/CD
Secrets management
Observability tooling
Deployment strategy
Tenant-size scaling thresholds
RPO / RTO
Backup retention

MVP boundary
Release strategy
Pilot strategy
```

Open Decisions must never be silently converted into assumptions by AI agents.

---

# 116. ADR Governance

Architecture Decision Records are required for meaningful architectural changes.

Recommended:

```text
docs/decisions/
├── ADR-001-...
├── ADR-002-...
├── ADR-003-...
```

Each ADR should include:

```text
Context
Problem
Options
Decision
Consequences
Status
Date
```

---

# 117. Definition of Done

A feature is considered:

### IMPLEMENTED

when code exists.

### VERIFIED

when required tests and validation pass.

### PRODUCTION READY

when:

```text
implementation
+
verification
+
security
+
tenant isolation
+
documentation
+
observability
+
deployment readiness
```

are complete.

---

# 118. Release Gate

Production release requires at minimum:

```text
critical requirements verified
critical tests pass
critical security findings resolved
tenant isolation verified
API contract verified
frontend verified
migrations verified
backup/recovery posture verified
observability active
deployment verified
rollback/recovery plan known
documentation complete
```

---

# 119. Project Completion Definition

The planning/documentation project is complete when:

```text
Phases A–K Approved
Master Specification finalized
Open Decisions identified
Implementation roadmap defined
AI handoff protocol defined
Documentation hierarchy defined
Traceability model defined
Verification model defined
Architecture invariants defined
```

At that point:

```text
Planning
=
Complete
```

and:

```text
Implementation
=
Begins
```

---

# 120. What AI Should Do on First Repository Entry

The very first AI session should execute conceptually:

```text
1. Read MASTER-SPECIFICATION.md
2. Inspect repository structure
3. Inspect documentation
4. Inspect existing implementation status
5. Read relevant ADRs
6. Identify approved architecture
7. Identify current milestone
8. Identify current task
9. Identify dependencies
10. Identify forbidden scope
11. Plan task
12. Implement only approved scope
13. Run required verification
14. Update documentation
15. Update project status
16. Report evidence
```

---

# 121. What AI Should Never Do on First Entry

Never:

```text
start rewriting architecture
generate random folder structure
create generic enterprise abstractions without need
replace approved database model
invent authentication behavior
invent authorization rules
collapse payment/subscription/entitlement
build all dashboards first
replace the provider architecture
skip tests because "the code is simple"
declare completion without verification
```

---

# 122. Master Prompt Behavior

A future AI agent can be instructed conceptually:

```text
You are implementing an existing approved architecture.

Do not redesign the project unless an explicit architecture issue is identified.

Treat MASTER-SPECIFICATION.md and approved specialized specifications as authoritative.

Before coding:
- read relevant documentation
- identify domain ownership
- identify dependencies
- identify authorization rules
- identify tenant boundaries
- identify API contract
- identify test requirements

During coding:
- preserve architecture
- keep modules isolated
- keep controllers/pages thin
- avoid God Classes
- preserve security invariants
- do not invent requirements

After coding:
- run verification
- report exact evidence
- update documentation
- update implementation status
- record open decisions
- create ADR when architecture changes
```

---

# 123. Master AI Safety Rule

The AI is an implementation agent.

It is not authorized to independently redefine:

```text
business strategy
tenant architecture
security model
identity model
authorization model
core domain boundaries
payment architecture
credential architecture
API versioning
```

without the project's architecture-change process.

---

# 124. Master AI Context Rule

When an AI agent's context window is limited, it should load documentation in this order:

```text
Master Specification
        ↓
Relevant Architecture
        ↓
Relevant Domain
        ↓
Relevant API
        ↓
Relevant Frontend
        ↓
Relevant Testing
        ↓
Relevant Infrastructure
        ↓
Relevant ADRs
```

It does not need to read every file for every small task.

---

# 125. Master Documentation Rule

Documentation is not a report about the project.

It is part of the project itself.

Therefore:

```text
Code Change
    ↓
Documentation Impact
    ↓
Documentation Update
```

is mandatory.

---

# 126. Master Traceability Rule

Every important business capability should eventually have a trace chain:

```text
BR
 ↓
FR
 ↓
Use Case
 ↓
Domain
 ↓
API
 ↓
Frontend
 ↓
Test
 ↓
Evidence
```

This is the final mechanism for reducing ambiguity for future AI agents.

---

# 127. Master Architecture Diagram

```text
                         ┌───────────────────────┐
                         │      PLATFORM         │
                         │       CONTROL         │
                         └──────────┬────────────┘
                                    │
                            Tenant Registry
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
         Tenant A DB           Tenant B DB           Tenant C DB
              │                     │                     │
              └──────────────┬──────┴──────┬──────────────┘
                             ▼             ▼
                         DOMAIN / APP LAYERS
                             │
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                     ▼
   Identity/Auth        Education/Billing      Analytics
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             ▼
                        APPLICATION API
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
            Next.js Web              External Providers
                │                  ┌────────┼─────────┐
                ▼                  ▼        ▼         ▼
          Role Experiences      Meet     Video     Email
                │
       ┌────────┼─────────┬─────────┬────────┐
       ▼        ▼         ▼         ▼        ▼
    Student   Teacher   Assistant  Parent  Platform
```

---

# 128. Master Security Architecture

```text
Internet
   ↓
TLS / Gateway
   ↓
Authentication
   ↓
Tenant Resolution
   ↓
Authorization
   ↓
Application
   ↓
Domain
   ↓
Tenant Data
```

Cross-cutting:

```text
Rate Limiting
Audit
Logging
Tracing
Secret Management
Monitoring
Abuse Detection
```

---

# 129. Master Business Access Architecture

```text
Payment
   ↓
Review
   ↓
Subscription
   ↓
Entitlement
   ↓
Authorized Capability
   ↓
Application Feature
```

Authentication remains separate.

---

# 130. Master Learning Architecture

```text
Student
  ↓
Enrollment
  ↓
Course
  ↓
Lesson
  ├── Video
  ├── File
  ├── Assignment
  ├── Exam
  └── Meeting
        ↓
Learning Events
        ↓
Progress
        ↓
Analytics
        ↓
Reports
```

---

# 131. Master Offline Architecture

```text
Tenant
 ↓
Branch
 ↓
Classroom
 ↓
Class
 ↓
Session
 ↓
Attendance
 ↓
Assessment
 ↓
Performance
 ↓
Parent / Teacher Reports
```

---

# 132. Master Operational Architecture

```text
Developer
   ↓
Git
   ↓
CI
   ↓
Build
   ↓
Test
   ↓
Security
   ↓
Artifact
   ↓
Staging
   ↓
Verification
   ↓
Production
   ↓
Monitoring
   ↓
Incident / Feedback
   ↓
Regression / Improvement
```

---

# 133. Final Non-Negotiable Invariants

The following must remain true throughout implementation:

```text
1. Tenant isolation is mandatory.
2. Backend authorization is authoritative.
3. Global identity does not grant cross-tenant access.
4. Credential is not a permanent session.
5. Payment is not entitlement.
6. Subscription is not authentication.
7. External provider failure must not corrupt core state.
8. Secrets never enter logs.
9. Critical operations are idempotent where required.
10. Critical state transitions are explicit.
11. Analytics must not block core transactions.
12. Large tenants must be able to evolve infrastructure.
13. Support access is temporary and auditable.
14. Frontend is not the security boundary.
15. AI cannot silently change approved architecture.
16. Documentation must stay synchronized with implementation.
17. Implemented ≠ Verified.
18. Verified ≠ Production Ready.
```

---

# 134. Final Implementation Philosophy

The system should be:

```text
Modular
Secure
Tenant-Isolated
Observable
Testable
Scalable
Maintainable
Provider-Agnostic
AI-Friendly
Human-Understandable
```

without introducing complexity that has no architectural value.

The goal is not to maximize the number of patterns.

The goal is to make every important responsibility explicit.

---

# 135. Final Design Principle

The architecture should remain understandable to a new engineer.

A developer should be able to answer:

```text
Where does this data belong?
Who owns this behavior?
Who can access it?
Which tenant is involved?
Which API exposes it?
Which state transitions are legal?
What happens when the provider fails?
How is it tested?
Where is it documented?
```

without opening dozens of unrelated files.

---

# 136. Final AI Delivery Principle

The correct question for the AI is not:

> "Can I write this code?"

The correct sequence is:

```text
Is this requirement defined?
        ↓
Is ownership defined?
        ↓
Is the contract defined?
        ↓
Is security defined?
        ↓
Is tenant scope defined?
        ↓
Is the implementation boundary defined?
        ↓
Is verification defined?
        ↓
Then implement.
```

---

# 137. Final Project Lifecycle

The complete project lifecycle is now:

```text
A — Business/Product Foundation
        ↓
B — Business Requirements
        ↓
C — Architecture
        ↓
D — Domain / ERD / Database
        ↓
E — Security / Scalability / Resilience
        ↓
F — API & Application Contracts
        ↓
G — Frontend Architecture & UX
        ↓
H — Testing / Quality / Verification
        ↓
I — DevOps / Infrastructure / Deployment
        ↓
J — Implementation & Delivery Plan
        ↓
K — Final Master Specification / AI Handoff
        ↓
==============================
        IMPLEMENTATION
==============================
        ↓
Continuous Verification
        ↓
Release
        ↓
Operations
        ↓
Continuous Improvement
```

---

# 138. Final Status

```text
Phase A — APPROVED
Phase B — APPROVED
Phase C — APPROVED
Phase D — APPROVED
Phase E — APPROVED
Phase F — APPROVED
Phase G — APPROVED
Phase H — APPROVED
Phase I — APPROVED
Phase J — APPROVED
Phase K — FINAL MASTER SPECIFICATION
```

---

# 139. Planning Completion

The architecture/documentation cycle is now considered complete once Phase K is approved.

After that, the project enters:

# IMPLEMENTATION MODE

There is no need to invent another architecture phase merely to continue working.

Implementation proceeds through the Master Specification and the Phase J delivery plan.

---

# 140. Final Handoff Package

The intended final AI package is:

```text
MASTER-SPECIFICATION.md

+
architecture/
requirements/
domains/
api/
frontend/
testing/
infrastructure/
decisions/
project-management/
```

An AI agent receiving this package plus the repository should be able to understand the project without relying on undocumented conversational memory.

---

# 141. Final AI Instruction

```text
This repository contains an approved architecture for a
multi-tenant SaaS LMS and education management platform.

Treat the documentation as the source of truth.

Do not redesign approved architecture without an explicit
architecture-change process.

Before implementation:
- read the relevant documentation
- identify ownership
- identify dependencies
- identify tenant scope
- identify authorization
- identify API/UI contracts
- identify tests

During implementation:
- preserve domain boundaries
- preserve security invariants
- preserve tenant isolation
- preserve provider abstractions
- keep code modular
- avoid God Classes / Components / Controllers
- do not invent requirements

After implementation:
- run required verification
- document evidence
- update relevant documentation
- update status
- record limitations
- record open decisions
- create ADRs for architectural changes

Never claim verification without evidence.

Never claim production readiness without passing the required release gates.
```

---

# 142. FINAL DECLARATION

This Master Specification represents the consolidated architectural direction of the project across Phases A–J.

Phase K exists to ensure that the accumulated project knowledge survives:

```text
AI Context Changes
Developer Changes
Repository Changes
Implementation Sessions
Model Changes
Time
```

The project is intentionally designed so that implementation can proceed incrementally without losing the original architectural intent.

**Status: FINAL DOCUMENTATION BASELINE — PENDING APPROVAL**
:::

كده وصلنا لنهاية دورة الـ**Architecture & Documentation** فعلًا.

التسلسل النهائي عندنا أصبح:

**A ✅ → B ✅ → C ✅ → D ✅ → E ✅ → F ✅ → G ✅ → H ✅ → I ✅ → J ✅ → K ⏳**

وبمجرد اعتماد K، يبقى الخطوة التالية مش Phase L؛ **نبدأ التنفيذ الفعلي** طبقًا لـJ والـMaster Specification.