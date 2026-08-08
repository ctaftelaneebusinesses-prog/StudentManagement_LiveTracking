# Detailed Project Report

## Smart School Management System

**Version:** 1.0.0
**Report Date:** August 7, 2026
**Document Type:** Detailed Project Report (Technical & Functional)
**Prepared For:** Project Review / Client & Management Presentation / Academic Documentation

**Technology Stack (at a glance):** React 19 + TypeScript (Vite) frontend · Node.js + Express + TypeScript backend · Supabase (PostgreSQL + Auth + Storage + Row Level Security) · Tailwind CSS · TanStack Query · Zustand · Docker · Vercel

---

## Table of Contents

1. Cover Page
2. Executive Summary
3. Project Objectives
4. Problem Statement
5. Proposed Solution
6. Target Users
7. System Architecture
8. Technology Stack
9. Role-Based Access Control
10. Super Admin Module
11. School Admin Module
12. Principal Module
13. Teacher Module
14. Student / Parent Module
15. Accountant Module
16. Transport Module
17. Extracurricular Activities
18. Notification System
19. Leave Management
20. Examination & Marks
21. Homework & Assignment System
22. Registration & Login
23. Syllabus Management
24. Academic Management
25. Location Management
26. Student Management
27. Teacher Management
28. Gamified Website Learning / Certification
29. Student Learning Activities
30. UI/UX Design
31. Security
32. Database Design
33. API Documentation Overview
34. Testing
35. Deployment
36. Future Enhancements
37. Conclusion

---

## 1. Cover Page

| Field | Detail |
|---|---|
| **Project Name** | Smart School Management System |
| **Project Description** | A multi-tenant school management platform — a single deployment serves many schools, with dedicated, role-gated portals for Super Admins, School Admins, Principals, Teachers, Students/Parents, Accountants, Drivers, and Extracurricular Staff. |
| **Version** | 1.0.0 |
| **Report Date** | August 7, 2026 |
| **Frontend Technology** | Vite + React 19 + TypeScript |
| **Backend Technology** | Node.js + Express + TypeScript |
| **Database / Auth / Storage** | Supabase (PostgreSQL + Row Level Security + Auth + Storage) |

---

## 2. Executive Summary

The **Smart School Management System** is a web-based, multi-tenant platform that digitizes the day-to-day academic and administrative operations of one or more schools from a single codebase and deployment. "Multi-tenant" means the same running application serves many independent schools, each with its own data, users, and settings, isolated from one another at the database level.

**What it is.** A role-based web application with nine active user roles, each landing on a purpose-built dashboard: platform-level Super Admin, School Admin, Principal, Teacher, the combined Student/Parent portal, Accountant, Driver, Extracurricular Staff, and a minimal Support Staff account. It covers student and teacher records, attendance, timetables, homework, examinations and marks, fee collection, transport with live GPS tracking, extracurricular activity management, syllabus distribution, announcements, and a unified notification system spanning in-app, email, and browser push channels.

**What problem it solves.** Schools that rely on paper registers, spreadsheets, and disconnected messaging (SMS/WhatsApp groups) face slow attendance reconciliation, fee-collection tracking that lives in someone's notebook, no live visibility into where a school bus is, and homework/exam communication that depends on a student remembering to relay a message home. The platform replaces these fragmented, manual processes with one system of record per school, with every role seeing only the data relevant to their responsibilities.

**Who uses it.** School ownership groups running multiple campuses (via the Super Admin platform tier), individual school administrative staff, principals, teaching staff, students and their parents (sharing one combined account), accountants managing fee collection, transport drivers, and extracurricular activity instructors.

**Why it is useful / main benefits.**
- **Single source of truth per school** — attendance, marks, fees, and homework are recorded once and are immediately visible to every role authorized to see them.
- **Real-time transport visibility** — parents/students can see their school van's live position, ETA, and pickup/drop status instead of waiting at a stop with no information.
- **Structured approval workflows** — homework, student/staff leave, profile changes, and new-account registrations all move through an explicit review-and-approve chain rather than an informal phone call or note.
- **Centralized, multi-channel notifications** — in-app, email, and browser push are wired to the same event pipeline, so a fee due date, an approved leave, or a published exam result reaches the right person without manual follow-up.
- **Scales to a school group** — the Super Admin tier lets one organization operate several schools from a single platform, with per-school activation/deactivation and centralized oversight.

---

## 3. Project Objectives

1. Provide a single, centrally managed digital system that replaces manual/paper-based school administration for student records, attendance, academics, and finance.
2. Support multiple schools from one platform deployment, with strict data isolation between schools (multi-tenancy) and a platform-level administrative tier for organizations that run more than one school.
3. Give every stakeholder — administrator, principal, teacher, student, parent, accountant, driver, and extracurricular instructor — a role-specific interface that shows only what they need and can act on.
4. Enforce accountability through explicit approval workflows (homework review, leave approval, registration approval, profile-change approval) rather than direct, unchecked writes to sensitive records.
5. Provide live, GPS-based transport tracking so parents and school staff have real-time visibility into student pickup/drop status, instead of relying on phone calls.
6. Centralize communication (announcements, homework, exam results, fee dues, leave decisions, transport alerts, emergency alerts) through one consistent, multi-channel notification system.
7. Maintain a secure, auditable system: role-based access control enforced on the backend, row-level data isolation, and audit trails for platform- and school-level administrative actions.
8. Keep the system maintainable and extensible: a conventional, layered backend architecture and a component-based frontend so new modules can be added without re-architecting the platform.

---

## 4. Problem Statement

Schools that manage operations manually or through disconnected tools face recurring, compounding problems:

| Traditional / Manual Approach | Resulting Problem |
|---|---|
| Paper attendance registers | Slow to reconcile, easy to lose, no historical analytics, no automatic parent notification of absence |
| Fee collection tracked in registers/spreadsheets | No real-time view of who has paid, who is overdue, or class-wise/school-wide collection totals; error-prone manual receipt generation |
| Homework and exam results conveyed verbally or via a physical notebook | Information loss between school and home; no record of when something was actually communicated |
| School transport coordinated by phone calls to the driver | Parents have no visibility into where the bus is or when it will arrive; no record of which students actually boarded or were dropped |
| Staff/student leave requested informally (phone call, verbal request) | No audit trail, inconsistent approval standards, no visibility into who approved what and when |
| New student/staff onboarding done entirely on paper | Slow, error-prone data entry with no verification step before an account can act on real records |
| Multiple schools under one management group each running independent, disconnected systems (or none at all) | No consolidated oversight, inconsistent processes across campuses, duplicated administrative effort |
| Announcements distributed via SMS groups, printed notices, or informal messaging apps | No targeting by class/role, no delivery confirmation, no persistent record a parent/student can refer back to |

These problems share a common root cause: **no single, authoritative digital system of record** that every stakeholder in the school interacts with, each seeing only what is relevant to their role.

---

## 5. Proposed Solution

The Smart School Management System addresses the above by providing:

- **One system of record per school**, built on a relational database (PostgreSQL via Supabase) with row-level security ensuring one school's data is never visible to another school's users.
- **A single platform, many schools** — the Super Admin tier allows a school group to onboard, activate, deactivate, and oversee multiple independent school tenants without deploying separate systems.
- **Role-specific web portals** built on a shared component library and shared authentication, so every user role gets a tailored dashboard without the cost of building and maintaining separate applications.
- **Structured digital workflows** replacing informal processes: homework goes through class-teacher review before it reaches students; leave requests move through a defined approval chain with date-cutoff rules; new self-registered accounts sit in a `pending` state until an appropriate reviewer approves them; profile edits proposed by a student are reviewed by their class teacher before they take effect.
- **Live GPS transport tracking** built on the driver's mobile browser sending periodic location updates, with distance/ETA calculated server-side and automatic proximity notifications ("bus is 10 minutes away," "5 minutes away," "arrived") sent to the relevant students.
- **A unified notification pipeline** with three channels (in-app, email via SMTP, browser push via Web Push/VAPID) driven from a single set of backend events, so every workflow above (homework, leave, marks, fees, transport, announcements, emergency alerts) reaches the right person automatically.
- **Financial tracking for accountants** — class-wide and per-student fee structures, per-student overrides, payment recording, and collection reporting (daily/weekly/monthly/yearly) replacing manual ledgers.
- **Cloud-hosted, horizontally deployable architecture** — a stateless Express API (containerized via Docker) in front of a managed Postgres/Auth/Storage backend (Supabase), and a static, CDN-deployable frontend (Vercel), so the platform can scale by adding schools without infrastructure redesign.

---

## 6. Target Users

| Role | Summary of Responsibilities & Access |
|---|---|
| **Super Admin** | Platform-tier operator. Manages every school on the platform: creates schools, activates/deactivates them (with cascading suspension of that school's staff/data access), manages School Admin accounts across one or more schools, reviews requests from School Admins to create new schools, and views a platform-wide audit log and usage statistics. Holds every permission in the system. |
| **School Admin** | Full administrative control of one school (or, if explicitly assigned by a Super Admin, more than one). Manages classes, sections, subjects, teachers, students, timetable, fees, exams, transport, announcements, users & roles, reports, syllabus, and school settings. Can request that the Super Admin provision an additional school. |
| **Principal** | Functionally a near-complete clone of School Admin, reusing the identical administrative console — the only meaningful difference is the Principal cannot manage cross-school/platform administration (no `platform.manage_schools` permission), which locks them to their own school. Principals additionally review registration requests from Teachers, Accountants, Drivers, and Extracurricular Staff, and apply for their own leave (approved by School Admin/Super Admin). |
| **Teacher** | Manages their assigned classes and subjects: marks attendance, assigns and reviews homework, enters and publishes marks, manages question papers, publishes syllabus content for their classes, views/edits their timetable, reviews student self-registrations and student leave requests for their own class, and applies for their own leave (approved by the Principal). |
| **Student / Parent** *(combined role)* | One shared account and portal — there is no separate parent login. Covers attendance history and calendar, homework, exams, marks/report cards, evaluated (graded) papers, fee dues and payment history, timetable, syllabus, extracurricular activities and achievements, live transport tracking, notifications, and self-service leave requests. |
| **Accountant** | Finance-focused role: fee structure creation/editing, recording payments, generating receipts, and collection reporting (daily/monthly/yearly, class-wise/student-wise). No access to academic modules. |
| **Driver** | Operates the transport module's live-tracking flow: starts/ends a trip, shares GPS location while a trip is active, and marks each student on the route as picked up, absent, dropped, or not dropped. |
| **Extracurricular Staff** | Manages assigned activities (dance, yoga, karate, music, etc.): student batches/enrollment, weekly schedules, attendance for their sessions, practice-work assignments, events, and achievement/certificate uploads for their students. |
| **Support Staff** | A seeded role in the RBAC system for non-teaching staff (e.g. office/maintenance personnel) with only a self-service profile permission. It has **no dedicated portal or navigation menu today** — accounts land on the generic profile page only. *(See Section 36, Future Enhancements.)* |

---

## 7. System Architecture

### 7.1 Frontend

| Aspect | Detail |
|---|---|
| Framework | **Vite + React 19 + TypeScript** — a single-page application (SPA) |
| UI Library | **Hand-rolled UI kit** in `frontend/src/components/ui/` — no third-party component library (no MUI/Chakra/Ant) |
| Styling | **Tailwind CSS** utility classes, with a custom `brand`/`accent` token palette |
| State Management | **Zustand** for client/UI state (auth session, active school context, portal-selected student); **TanStack Query (React Query)** for all server-fetched state — the two are kept deliberately separate |
| Routing | **React Router v6**, all routes declared in one file (`AppRoutes.tsx`) with role-gated access (`ProtectedRoute`, `allowedRoles`); pages are lazy-loaded via `React.lazy` so a given role only downloads the JS for the portals it can reach |
| Forms | **React Hook Form + Zod resolvers** for validation |
| API Communication | **Axios**, one shared instance pre-wired with the Bearer token and base URL, with one `services/<domain>.service.ts` file per backend resource |
| Maps / GPS | **Leaflet** (`leaflet` + `@types/leaflet`) for live vehicle tracking maps |
| Charts | **Recharts** for dashboards/reports (fee trends, attendance summaries, etc.) |
| PDF / Excel Export | **jsPDF + jspdf-autotable** (client-side PDF generation for receipts and report cards) and **xlsx** (spreadsheet export) |
| Rich Text | **Tiptap** (used for announcement composition/rich text fields) |
| Animation | **Framer Motion** and **lottie-react** |
| Drag & Drop | **@dnd-kit** |
| Location Data | **country-state-city** package (for cascading country/state/city dropdowns) |

### 7.2 Backend

| Aspect | Detail |
|---|---|
| Framework | **Node.js + Express + TypeScript** — no ORM. All database access goes directly through `@supabase/supabase-js` (PostgREST under the hood) |
| API Architecture | REST, versioned under a single `/api/v1` prefix. Layered convention: `routes/*.routes.ts` (wires middleware + Zod validator + controller) → `controllers/*.controller.ts` (thin, parses the request and calls a service) → `services/*.service.ts` (all business logic and Supabase queries) |
| Authentication | **Supabase Auth** — the frontend authenticates directly against Supabase and attaches the resulting JWT as a Bearer token on every API call; the backend's `requireAuth` middleware verifies that JWT |
| Authorization | Database-backed **RBAC**: `requireAuth` loads a user's roles/permissions on every request; `requireRole(...)` and `requirePermission(...)` middleware gate routes; row-level guard helpers (`assertTeacherOwnsClass`, `assertStudentAccess`, tenant-scoping helpers) enforce "is this actually your data" checks beyond role membership |
| Business Logic | Encapsulated per-resource in `services/*.service.ts` (57 service files as of this report), each responsible for one module's Supabase queries, validation, and notification side-effects |
| Validation | **Zod** schemas per resource in `validators/`, applied via a shared validation middleware |
| Logging | **Pino** (structured JSON logs) + `pino-http` for request logging |
| Security Middleware | **Helmet** (HTTP security headers), **CORS** (explicit allow-listed origins), **express-rate-limit** (auth endpoints throttled), **compression** |
| Email | **Nodemailer** over SMTP (optional in development — silently skipped with a logged warning if unset) |
| Web Push | **web-push** library using VAPID keys (optional in development) |

### 7.3 Database

| Aspect | Detail |
|---|---|
| Engine | **PostgreSQL**, hosted and managed by **Supabase** |
| Schema Management | No ORM/migration-runner — plain, additive SQL files: `database/schema.sql` (base schema) + `database/rls_policies.sql` (base Row Level Security policies) + 75 numbered, additive migration files under `database/migrations/` |
| Multi-tenancy | Every school-owned table carries a `school_id` foreign key to the `schools` table; **Row Level Security (RLS)** policies are enabled on essentially every table as a defense-in-depth tenant boundary, though the backend's primary authorization layer is Express middleware (the backend connects with a service-role key that bypasses RLS for its own queries) |
| Main Entities | `schools`, `users` (1:1 extension of Supabase `auth.users`), `roles`/`permissions`/`role_permissions`/`user_roles`, `students`, `teachers`, `drivers`, `extracurricular_staff`, `classes`/`subjects`/`class_subjects`, `attendance`, `exams`/`exam_marks`, `homework`, `fee_structures`/`fee_payments`, `vehicles`/`routes`/`trips`, `notifications`, `syllabus`, `announcements`. See Section 32 for the full catalog. |

### 7.4 Storage

File/image/document storage uses **Supabase Storage** (11 buckets), with the frontend uploading directly to Storage (not proxied through the Express API) and the backend recording only file metadata. See Section 32.4 for the full bucket list.

### 7.5 External Services

| Category | Service actually used |
|---|---|
| Maps / GPS | **Leaflet** (open-source map rendering); GPS coordinates are captured via the browser's `navigator.geolocation` API — there is no third-party mapping/routing API (e.g. Google Maps) integrated |
| Notifications | In-app (Supabase Postgres, custom notifications table), **Nodemailer/SMTP** for email, **web-push (VAPID)** for browser push |
| AI Services | A **rule-based, deterministic "AI Homework Assistant"** (`backend/src/services/ai.service.ts`) that reformats a teacher's homework note into a structured, student-friendly brief with study tips. **This is not an LLM integration** — no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` or external AI API is configured or called anywhere in the codebase. It is explicitly designed to be swapped for a real model call later without changing its contract. |
| Email | Nodemailer over standard SMTP (provider-agnostic; configured via environment variables) |
| Real-time updates | **Supabase Realtime** (`postgres_changes` subscriptions) — used for live notification delivery and live GPS position updates on the transport map. **Note:** `socket.io`/`socket.io-client` are listed as dependencies on both frontend and backend but are **not wired up anywhere** — no Socket.IO server is instantiated (`server.ts` explicitly documents this). Do not treat Socket.IO as an active feature. |

### 7.6 Deployment

| Aspect | Detail |
|---|---|
| Frontend Hosting | **Vercel** (static SPA build via `npm run build`, output `dist/`), configured via a checked-in `frontend/vercel.json` for SPA routing fallback, security headers, and static asset caching |
| Backend Hosting | Containerized via a production **`backend/Dockerfile`** (multi-stage Node 20-alpine build, non-root runtime user, container health check against `/api/v1/health`). Not tied to one provider — the project's `DEPLOYMENT.md` documents deployment to any container host (Render, Railway, Fly.io, AWS ECS/App Runner, Google Cloud Run, Azure Container Apps, or a plain VPS), with worked examples for Render and Railway specifically. **No `docker-compose.yml` and no frontend Dockerfile exist.** |
| Database Hosting | **Supabase-managed PostgreSQL** — schema/RLS/migrations are applied by hand, in order, via the Supabase SQL Editor (no automated migration runner) |
| Domain / HTTPS | Vercel auto-provisions and renews SSL for the frontend domain; most recommended backend hosts do the same; `DEPLOYMENT.md` recommends Caddy or Nginx+Certbot if self-hosting the backend on a bare VPS |
| CI/CD | **No CI/CD pipeline exists.** There is no `.github/workflows/` directory or any CI configuration anywhere in the repository. Tests and builds currently run only when a developer runs them locally (`DEPLOYMENT.md`'s manual pre-deploy checklist calls for `npm ci && npm run build && npm test` by hand). |

---

## 8. Technology Stack

| Technology | Purpose | Usage in Project |
|---|---|---|
| **React 19** | Frontend UI library | All portal UIs, component-based SPA |
| **TypeScript** | Static typing (both tiers) | Entire frontend and backend codebase |
| **Vite** | Frontend build tool / dev server | `npm run dev`, `npm run build` for the frontend |
| **Tailwind CSS** | Utility-first CSS framework | All styling; no separate CSS-in-JS or component library |
| **Zustand** | Client/UI state management | Auth session, active school context, portal-selected student |
| **TanStack Query (React Query)** | Server-state management/caching | All API-fetched data across every portal |
| **React Router v6** | Client-side routing | Full role-gated route tree (`AppRoutes.tsx`) |
| **React Hook Form + Zod** | Form state & validation | All create/edit forms |
| **Axios** | HTTP client | All frontend → backend API calls |
| **Leaflet** | Interactive maps | Live vehicle/driver GPS tracking views |
| **Recharts** | Charting | Dashboard stat charts (fee trends, attendance, etc.) |
| **jsPDF / jspdf-autotable** | Client-side PDF generation | Fee receipts, student report cards |
| **xlsx** | Spreadsheet export | Bulk data export features |
| **Tiptap** | Rich text editing | Announcement composition |
| **Node.js** | Backend runtime | Express API server (Node ≥ 20 required) |
| **Express** | Backend web framework | REST API (`/api/v1/*`) |
| **Zod** (backend) | Request validation | Per-resource validator schemas |
| **Pino / pino-http** | Structured logging | Request/response and application logs |
| **Helmet** | HTTP security headers | Applied globally in `app.ts` |
| **express-rate-limit** | Rate limiting | Auth endpoints (login, register, password reset) |
| **Nodemailer** | Transactional email (SMTP) | Notification emails (optional in dev) |
| **web-push** | Browser push notifications | VAPID-based push (optional in dev) |
| **Supabase (PostgreSQL)** | Database | Primary relational data store, multi-tenant via `school_id` |
| **Supabase Auth** | Authentication | User sign-in/session/token issuance |
| **Supabase Storage** | File/document storage | 11 buckets (avatars, documents, homework files, receipts, etc.) |
| **Supabase Realtime** | Live data push | Live GPS position updates, live notification delivery |
| **@supabase/supabase-js** | Database/Auth/Storage client (no ORM) | Used directly by the backend (service-role key) and frontend (anon key) |
| **Docker** | Backend containerization | `backend/Dockerfile`, multi-stage Node 20-alpine build |
| **Vercel** | Frontend hosting | Static SPA deployment |
| **Git** | Version control | Repository source control |
| **Vitest** | Unit testing (both tiers) | Backend service tests, frontend component/service tests |
| **@testing-library/react + jsdom** | Component testing | Frontend page/component tests |
| **ESLint** | Linting | Both frontend and backend |
| **python-docx / Markdown** *(documentation only)* | Report generation tooling | Used to produce this report, not part of the running application |

---

## 9. Role-Based Access Control

Authorization is enforced through a **database-backed RBAC model**, not a hardcoded frontend list: `permissions` (43 distinct capability codes), `role_permissions` (which roles hold which codes), and `user_roles` (a many-to-many mapping that lets one person hold more than one role/school). The backend's `requireAuth` middleware flattens a caller's `user_roles → role_permissions → permissions.code` into `req.user.permissions` on every request; `requirePermission(code)` and `requireRole(...)` middleware then gate each route. The frontend's `usePermissions`/`PermissionGate` are UX conveniences only — every check is re-verified on the backend.

### 9.1 Feature Permission Matrix

Legend: **V**=View · **C**=Create · **E**=Edit · **D**=Delete · **A**=Approve · **M**=Full Manage

| Feature | Super Admin | School Admin | Principal | Teacher | Student/Parent | Accountant | Driver | Extracurricular Staff |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Platform (schools, cross-school admin) | M | request only | — | — | — | — | — | — |
| School settings, branches, academic years | M | M | M | — | — | — | — | — |
| Users & role assignment | M | M | M (own school; admin-tier accounts hidden) | — | — | — | — | — |
| Classes, sections, subjects | M | M | M | V | — | — | — | — |
| Students (records) | M | M | M | V/E (own class) | V (self) | — | — | — |
| Teachers (records) | M | M | M | — | — | — | — | — |
| Attendance | M | M | M | M (own class) | V (self) | — | — | M (own sessions) |
| Timetable | M | M | M | V (own) | V (self) | — | — | M (own schedule) |
| Homework | M | M | M | M (create/submit-review) | V/submit (self) | — | — | — |
| Exams & marks | M | M | M | M (own subjects) | V (self) | — | — | — |
| Syllabus | M | M | M | M (own class/subject) | V (published, own class) | — | — | — |
| Fees | M | M | M | — | V (self, dues/history) | M | — | — |
| Transport & fleet | M | M | M | V (monitoring only) | V (own transport/live map) | — | Operate own trip | — |
| Extracurricular activities/staff | M | M | M | — | V/participate (self) | — | — | M (own activities) |
| Announcements | M | M | M | V | V | V | V | V |
| Leave requests | Approve (as admin) | Approve | Apply (own) + approve (staff) | Apply (own) + approve (student) | Apply (own) | — | — | — |
| Registration approvals | Reviews Principal signups | Reviews Principal signups | Reviews Teacher/Accountant/Driver/EC-Staff signups | Reviews Student signups (own class) | Self-registers | — | — | — |
| Reports | M | M | M | V (own class) | — | V | — | — |
| Notifications | V/send emergency | V/send emergency | V/send emergency | V | V | V | V | V |
| Audit log | M | — | — | — | — | — | — | — |

*Approve* in the Leave row reflects the actual hierarchy documented in Section 19: teacher/principal leave is reviewed by the opposite tier (a principal never reviews another principal's leave), and student leave is reviewed only by that student's own class teacher.

---

## 10. Super Admin Module

The Super Admin operates a **platform-tier console**, entirely separate from any individual school's Admin Console, gated to the `super_admin` role only.

**Implemented:**
- **Multiple school management** — list, create, view detailed overview, update, and deactivate/delete any school on the platform (`SuperAdminSchoolsPage`, `SuperAdminSchoolOverviewPage`).
- **School Admin management** — list, create, update, and reset the password of School Admin accounts across the platform (`SuperAdminSchoolAdminsPage`).
- **Multi-school assignment** — a single School Admin account can be assigned to manage **more than one school** (`school_admin_schools` join table); Super Admin can assign/remove school assignments and preview the impact of a change before applying it.
- **School activation/deactivation with cascading suspension** — deactivating a school or a School Admin account can cascade-suspend the affected accounts' access (`cascade_suspended` flag on both `schools` and `users`), with an "impact preview" step before the action is applied.
- **School creation requests** — School Admins can request that a new school be provisioned; Super Admin reviews, approves (which actually creates the school), or rejects these requests (`SuperAdminSchoolRequestsPage`).
- **Platform audit log** — a dedicated, paginated audit trail (`platform_audit_logs` table) of every platform-tier administrative action, viewable via `SuperAdminAuditLogPage`.
- **Platform-wide statistics dashboard** — cross-school counts and usage metrics (`SuperAdminDashboardPage`).
- **Every RBAC permission in the system** is granted to `super_admin`, including all module-level permissions School Admin holds.

**Planned / Future Enhancement:** none identified specific to this module beyond what is listed in Section 36 (e.g. a dedicated support-staff experience, which is platform-adjacent but tracked separately).

---

## 11. School Admin Module

The School Admin (and Principal, which reuses the identical console — see Section 12) operates the full **Admin Console** for one school (or the schools they have been explicitly assigned to manage).

| Sub-module | Implemented Functionality |
|---|---|
| **Dashboard** | Stats/overview shell summarizing school activity |
| **School Management** | Own school profile, multi-branch management (`branches`), academic year management (create, edit, set current) |
| **Students** | Full CRUD, bulk create/assign-class/delete, activation/deactivation, profile with documents/siblings/fees/attendance/marks |
| **Teachers** | Full CRUD, class/subject assignment, homeroom assignment, staff attendance tracking, document management |
| **Classes** | Class & section CRUD, capacity, student roster, subject assignment per class |
| **Sections** | Managed as part of the class entity (`classes.section`) |
| **Subjects** | School-wide subject catalog CRUD |
| **Timetable** | Weekly period builder per class, with room numbers and academic/extracurricular period types |
| **Fees** | Fee structure CRUD (class-wide or per-student), bulk fee assignment/update/removal, payment history, receipts |
| **Announcements** | Rich-text announcement composition, targeted by audience (all/teachers/students/specific classes/specific teachers/principal/accountants/extracurricular staff), scheduled publishing, file attachments |
| **Exams** | Exam creation (single class, all classes, or selected classes), exam timetable, question-paper compose/upload/publish, marks entry, results publishing, performance analytics |
| **Transport** | Vehicle/driver/route fleet management, pickup-point/stop management, student-to-route assignment, vehicle maintenance records, trip history, live monitoring |
| **Users and Roles** | User account CRUD, bulk activate/deactivate/create/delete, role assignment per user |
| **Accountant (oversight)** | Fee module is fully accessible to admin roles in addition to the dedicated Accountant role |
| **Extracurricular activities** | Activity catalog management, extracurricular staff roster and profiles |
| **Reports** | Attendance, transport, teacher, and student report tabs (Reports Hub) |
| **Syllabus** | Publish/manage syllabus documents by class/subject/academic year |
| **Profile** | Own admin profile |
| **Notifications** | Full notification history with mark-as-read and click-through navigation, plus **Emergency Alerts** (school-wide critical broadcast) |
| **Settings** | School profile, calendar/holidays, academic structure, departments, notification settings |
| **Registration Approvals** | Reviews Principal-account registration requests |
| **Leave Requests (review)** | Approves/rejects staff (teacher/principal) leave requests |
| **School Requests** | Can request the Super Admin provision an additional school for this admin group |

---

## 12. Principal Module

The Principal **does not have a separate portal** — this is a deliberate, confirmed architectural decision. The Principal role is routed into the exact same Admin Console pages as School Admin and Super Admin (`AppRoutes.tsx` gates the console with `allowedRoles={["school_admin","super_admin","principal"]}` throughout).

**Restrictions compared with School Admin:**
- **No `platform.manage_schools` permission** — the single functional carve-out. This is enforced both by the permission grant (migration `029_grant_principal_admin_parity.sql` grants Principal everything School Admin has *except* this one permission) and by a hard tenant lock in `resolveSchoolId()`, which pins a Principal to their own `users.school_id`. In practice this means a Principal cannot see or manage other schools, cannot access the multi-school list, and is redirected straight to their own school's profile page instead.
- **Admin-tier account management is hidden** in the Users & Roles screen for Principals (they cannot create/manage other admin/principal/super_admin accounts, enforced at the application layer since the underlying `users.manage` permission is all-or-nothing).

**Additions unique to Principal:**
- A dedicated **`MyLeavePage`** for applying for their own leave (approved by School Admin/Super Admin, never by another Principal).
- **Registration approval authority** over Teacher, Accountant, Driver, and Extracurricular Staff self-registration requests (School Admin/Super Admin instead review Principal registration requests).

---

## 13. Teacher Module

| Feature | Implementation |
|---|---|
| **Dashboard** | Teacher home dashboard (`TeacherDashboardPage`) — assignment overview, today's schedule, quick stats |
| **Profile** | Self-service profile view/edit (`TeacherProfilePage`) |
| **Students** | Roster of students in the teacher's assigned class(es); individual student profile view (including fee receipt access) |
| **Class Teacher (homeroom) functionality** | Attendance marking for the whole class, review/approval authority over homework created by subject teachers for that class, review of student self-registration requests, review of student leave requests, review of student profile-change requests, view of per-subject marks-entry completion status with a "send reminder" action |
| **Subject Teacher functionality** | Creates homework, enters marks, manages question papers for the specific class/subject(s) they are assigned to teach (`class_subjects`) |
| **Attendance** | Mark daily class attendance (`TeacherAttendancePage` / `MarkAttendance` component) |
| **Homework** | Create/manage/assign homework; auto-approved and published immediately if the creator is the class's homeroom teacher, otherwise routed to the class teacher for approval before students see it |
| **Assignments** | Same entity as homework — the codebase does not distinguish a separate "assignment" type |
| **Marks / Assessments** | Marks entry per exam/subject, letter-grade auto-calculation, own quick "assessment" creation (`TeacherAssessmentsPage`) |
| **Timetable** | View own weekly timetable; can propose timetable change requests for admin review |
| **Leave requests** | Apply for own leave (`TeacherLeavePage`, reviewed by Principal); review student leave requests for own class |
| **Student details** | Full student profile access for their own class's students |
| **Syllabus** | Publish/manage syllabus for classes/subjects they are assigned to teach |
| **Question Papers** | Upload or browser-compose question papers, publish them (making them visible to students) independently of results/marks publishing |
| **Transport** | Read-only live monitoring view of the school's transport fleet (`TransportMonitoringPage`, reused from the admin console) |
| **Reports** | Class-performance reports scoped to their own class |
| **Notifications** | Standard notification inbox |
| **AI-assisted homework** | "AI Homework Assistant" — reformats a plain-text homework note into a structured, student-friendly brief with study tips (rule-based, see Section 7.5) |

---

## 14. Student / Parent Module

Student and Parent are, in this application, **one combined account and role** (`student`) — there is no separate parent login or parent-specific page anywhere in the codebase; a historical `parent` role and its supporting tables were removed via migration `064_remove_parent_role.sql`. The combined portal (`frontend/src/pages/portal/`) is a dedicated shell (`PortalShell.tsx`), separate in layout from the generic admin/teacher dashboard shell.

| Feature | Status |
|---|---|
| Attendance (records) | **Implemented** — history and daily records |
| Attendance calendar / summary | **Implemented** — daily/monthly/yearly summary views |
| Attendance percentage | **Implemented** — computed as part of the summary views |
| Fees | **Implemented** — dues, payment history, receipts |
| Exams | **Implemented** — schedule and results |
| Reports (report card) | **Implemented** — combined attendance + marks report card, rendered to PDF client-side (jsPDF) |
| Profile | **Implemented** — self-service profile view |
| Profile edit (teacher-approval workflow) | **Implemented** — a student submits a proposed change, their class teacher approves or rejects it before it takes effect |
| Timetable | **Implemented** — full weekly class timetable |
| Homework | **Implemented** — list, detail, notifications |
| Assignments | Same as Homework — no separate entity |
| Notice Board / Announcements | **Implemented** — via the shared notifications/announcements pipeline |
| Transport tracking (live GPS) | **Implemented** — one of the most fully built subsystems: live van position on a Leaflet map (via Supabase Realtime), trip status badge (waiting → approaching → picked up → reached school → return trip → returning home → dropped at home, or absent), ETA in minutes and distance in km, driver contact card, transport history |
| Pickup point | **Implemented** — assigned stop shown as part of the transport page |
| Driver information | **Implemented** — driver contact card on the transport page |
| GPS tracking | **Implemented** — see above; the student/parent's own browser location can also be shared to personalize ETA |
| Notifications | **Implemented** — full multi-channel pipeline (in-app/email/push) |
| Leave requests | **Implemented** — self-service application, reviewed by the class teacher, with a hard same-day-after-6PM cutoff rule |
| Evaluated papers | **Implemented** — scanned/graded answer sheets uploaded by teachers, distinct from question papers, viewed per exam/subject |
| Published marks | **Implemented** — visible only once a teacher publishes them |
| Parent meetings (PTM) | **Not implemented** — no PTM/meeting-scheduling feature exists anywhere in the codebase. *(Planned / Future Enhancement)* |
| Image gallery | **Partially implemented** — an image grid exists only as a section within the Extracurricular activities page (activity photos); there is **no standalone gallery module**. *(Planned / Future Enhancement for a general school gallery)* |
| Communication / chat | **Not implemented** — no chat/messaging feature, table, or service exists anywhere in the codebase. *(Planned / Future Enhancement)* |
| Learning activities / games | **Not implemented in a usable form** — see Section 29. Database tables exist (migration 073) but there is no backend service, API, or frontend. *(Planned / Future Enhancement)* |
| Syllabus | **Implemented** — published syllabus documents for the student's own class, with signed-URL preview/download |
| Extracurricular participation | **Implemented** — overview of enrolled activities, schedule, achievements, and an activity photo gallery section |

---

## 15. Accountant Module

| Feature | Implementation |
|---|---|
| **Dashboard** | Stat cards, fee-collection bar chart, collection trend line chart, fee-status pie chart, recent activity feed |
| **Daily collection** | Included in the collection report, bucketed by day |
| **Monthly collection** | Included in the collection report, bucketed by month |
| **Yearly collection** | Included in the collection report, bucketed by year |
| **Total collection** | Dashboard totals for today/week/month/year |
| **Due amount** | Per-student and school-wide due tracking, factoring in discounts, scholarships, and transport fees |
| **Student fee details** | Per-student fee profile page — record payment, add ad hoc fee, view fee structure, view/print receipt |
| **Fee creation** | Fee structures can be created class-wide or for an individual student |
| **Fee editing** | Full edit support, including per-student overrides of a class-wide fee line without affecting other students |
| **Fee updates** | Bulk update across a school/class/student scope |
| **Fee removal** | Deletion blocked if any payment has already been recorded against that fee structure (must be reassigned/cleared first) |
| **Class-wise fee management** | Class-scoped fee structures and class-wise collection reporting |
| **Student-wise fee management** | Per-student fee structures, overrides, and payment history |
| **Receipts** | Generated on demand; rendered to PDF client-side (jsPDF) from backend-supplied flattened payment data |
| **Reports** | Collection report (date-range bucketed), pending vs. paid, class-wise and student-wise collection, exportable |

---

## 16. Transport Module

One of the most fully implemented subsystems in the platform.

**Data model (as of migration `053_transport_route_ownership.sql`):** a **route** owns its assigned vehicle (one vehicle per route, enforced uniquely) and up to two drivers (primary/secondary) — the earlier model, where a vehicle directly owned a driver and a route, was inverted. Stops (`pickup_points`) belong to a route as a single, unified ordered list; the "evening" leg of a route is always the "morning" stop list reversed, computed on the fly rather than stored separately.

| Feature | Implementation |
|---|---|
| Vehicle management | Full CRUD, registration/insurance/fuel-type tracking, maintenance record log |
| Driver management | Full CRUD, license tracking, deactivation |
| Routes | Full CRUD, route code, vehicle + up to two drivers assigned per route |
| Stops | Ordered stop list per route (single list, shared by both directions) |
| Morning/evening route logic | The evening leg is the morning stop list in reverse order, computed client-side — not a separately stored route |
| Student assignment | Each student has one standing pickup-point assignment plus a `transport_direction` preference (morning/evening/both) |
| Pickup points | Managed per route, ordered |
| Driver GPS | The driver's browser sends GPS via `navigator.geolocation.watchPosition` roughly every 10 seconds (or immediately on high-accuracy readings), with an offline retry queue (capped at 100 points) that flushes when connectivity returns |
| Start Trip | Full flow — start/end trip buttons, screen-wake-lock while a trip is active (so the device doesn't sleep and silently stop tracking), a `beforeunload` warning against closing the tab mid-trip, and automatic recovery of an in-progress trip on page reload |
| Share GPS | Continuous location sharing while a trip is active, visible live to students/parents and to staff monitoring the fleet |
| Student pickup status | Driver marks each student **picked up** or **absent** per trip |
| Student drop status | Driver marks each student **dropped** or **not dropped** on the return leg |
| Parent/student notifications | Automatic notifications on trip start, proximity thresholds, and pickup/drop events |
| **5-minute / 10-minute proximity notifications** | **Confirmed implemented** — the backend computes distance via the haversine formula and an estimated average speed (from the last 5 GPS pings, falling back to 25 km/h), firing distinct, de-duplicated notifications at **"10 minutes away," "5 minutes away,"** and **"arrived"** (≤0.2 km) |
| Route-based student tracking | Staff/teacher live monitoring view shows every active route with a live pulse indicator, per-route picked-up/absent/remaining counts, and last-GPS timestamp |

**Note on ETA methodology:** distance/ETA is computed locally using the haversine great-circle formula and a rolling average speed derived from recent GPS pings — there is no third-party routing/traffic API involved, and there is no geofencing (school/home coordinates are not modeled as zones); "reached school" / "dropped at home" status is derived from trip completion plus the driver's own per-student marking, which the backend's own code comments describe as an approximation.

---

## 17. Extracurricular Activities

| Feature | Implementation |
|---|---|
| Activity catalog | 16 seeded, platform-wide preset activities available to every school out of the box: **Dance, Yoga, PT, Karate, Music, Singing, Violin, Keyboard, Guitar, Drawing, Painting, Chess, Skating, Drama, Spoken English, Martial Arts** — each with a category (Performing Arts / Fitness / Sports / Martial Arts / Music / Visual Arts / Mind Sports / Language). Schools can also define their own custom activities in addition to the presets. |
| Staff assignment | Extracurricular Staff accounts (a dedicated role, structurally parallel to Teachers) are assigned to one or more activities |
| Student participation | Managed via "batches" — a staff member + activity + class + academic year combination, scoped either to the entire class or a hand-picked subset of students |
| Class-based selection | Full support for whole-class or selected-student enrollment per batch |
| Scheduling | Weekly recurring session slots per batch, with day/time/venue and overlap checking against the same staff member's other sessions |
| Attendance | Per-session attendance marking and summary reporting for extracurricular sessions, separate from academic attendance |
| Practice work | Staff can assign practice work to a batch (assignment only — no student submission mechanism exists) |
| Events | Staff can record activity events/competitions |
| **Awards / Certificates** | **Implemented as file-upload records, not auto-generated certificates.** Staff upload a title, description, date, and a supporting file (a photo of a physical certificate/trophy, or any document) per student into a dedicated storage bucket. There is no certificate-generation logic anywhere in the backend. |
| Activity gallery | Image-type achievement uploads are surfaced as a photo gallery section within the student's Extracurricular overview page |
| Activity management | Full CRUD for staff, batches, schedules, achievements, and events from the dedicated Extracurricular Staff console; students see a read-only overview/participation page |

---

## 18. Notification System

A single, central pipeline (`notification.service.ts`) drives three delivery channels from one event source:

1. **In-app** — a row in the `notifications` table plus a `notification_reads` per-user read receipt; delivered live via Supabase Realtime to the notification bell.
2. **Email** — via Nodemailer/SMTP, dispatched fire-and-forget after every notification insert (respects a per-school `emailEnabled` setting toggle).
3. **Browser push** — via `web-push`/VAPID, used selectively by specific high-value events (leave decisions, published marks, homework, fees, school requests) rather than every notification type.

**Notification types** (a documented ~30+ value enum) span: attendance, homework (created/approved), marks published, transport/van events (trip started, proximity, pickup/drop), announcements, emergency alerts, teacher/principal/student leave (submitted/approved/rejected — 9 distinct variants), timetable-change proposals, student profile-change requests (submitted/approved/rejected), extracurricular activity events (assigned/completed/practice work/event/certificate/schedule updated), fee events (due/updated/removed/payment received), registration (submitted/approved/rejected), school-creation requests (submitted/approved/rejected), and website-knowledge-quiz completion.

**Who receives what:**

| Event | Recipient(s) |
|---|---|
| Homework created/approved | Students (and their linked account) in the class |
| Leave submitted | The designated reviewer (Principal for teacher leave; School Admin/Super Admin for principal leave; class teacher for student leave) |
| Leave approved/rejected | The original applicant |
| Marks published | The affected students; the class's homeroom teacher is separately notified when a *different* subject teacher uploads marks (a lightweight completion-visibility signal, not a formal approval gate) |
| Exam results published | All students in the class |
| Fee due/updated/removed, payment recorded | The affected student(s); the class teacher, all Principals, and all School Admins/Super Admins (via a shared "admin-tier recipient" resolver ensuring platform Super Admins and multi-school School Admins are never silently dropped) |
| Transport alerts (trip started, 10-min/5-min/arrived, pickup/drop) | Students on that route (and whoever is viewing the live map) |
| Registration submitted/approved/rejected | The applicant, and the assigned reviewer on submission |
| Emergency alert | School-wide broadcast to every role with a notifications inbox |

**Duplicate-notification prevention:** the general notification pipeline does not deduplicate by default (each explicit call sends once). Two subsystems implement dedicated dedup logic: (1) transport proximity notifications use per-trip, per-student "already notified" timestamp columns so repeated ~10-second GPS pings only fire the 10-minute/5-minute/arrived notification once each; (2) the (unmounted) website-knowledge-quiz completion notification uses a database unique constraint to guarantee at most one notification per attempt per recipient.

**Scheduled/automatic notifications:** an in-process poller (`announcementScheduler.ts`, 60-second interval) publishes scheduled announcements once their `publish_at` time passes; a second poller (`teacherAttendanceScheduler.ts`) auto-marks teachers absent past a configurable per-school check-in cutoff. Both are documented as a single-server-instance tradeoff — there is no external cron/job-queue infrastructure.

---

## 19. Leave Management

| Aspect | Detail |
|---|---|
| Student leave | Self-service application by the student; a distinct table/workflow from staff leave |
| Teacher leave | Self-service application, reviewed by the Principal |
| Principal leave | Self-service application, reviewed only by School Admin/Super Admin — **explicitly never by another Principal** (enforced server-side) |
| Approval hierarchy | Teacher → Principal · Principal → School Admin/Super Admin · Student → the student's own class/homeroom teacher |
| Date restrictions | A hard **6:00 PM same-day cutoff**: after 6 PM local server time, the current day is no longer selectable as a leave start date. Distinct, specific error messages are returned for "date already passed" vs. "cutoff passed." Also blocks a duplicate pending request for identical start/end dates. |
| Race-safety | Approve/reject actions use a conditional update guarded on `status = pending`, so two simultaneous approval clicks cannot double-process the same request |
| Leave entitlement | A read-only computed summary (default 12 casual / 10 sick / 5 other days per year, configurable per school) minus approved days already used |
| Notification flow | Submission notifies the designated reviewer (in-app + push for staff leave, in-app for student leave); the decision notifies the original applicant |

---

## 20. Examination & Marks

| Aspect | Detail |
|---|---|
| Exam creation | Single class, all active classes, or a selected set of classes — each fans out into one row per class in a shared `exams` table |
| Exam timetable | Per-subject schedule entries (date/time/room/max marks) with a database constraint preventing double-booking a subject |
| Question papers | Either an uploaded file or browser-composed rich-text content; always created unpublished and require an explicit publish action before students can see them — **independent** of whether results/marks have been released |
| Marks entry | Per student per subject per exam, upserted, with automatic letter-grade calculation (A+ at ≥90% down to E below 40%) if not manually supplied |
| Marks publishing | A separate `is_published` flag on the exam itself gates whether marks are visible to students, distinct from question-paper publishing |
| Teacher submission → class-teacher monitoring | A dedicated "subject completion status" view lets the class (homeroom) teacher see, per subject, whether marks entry is complete or pending, with a one-click "send reminder" to a lagging subject teacher — a lightweight visibility tool, not a formal sign-off/approval gate |
| Student visibility | Marks, question papers, and evaluated papers are each independently gated to their own publish flag |
| Evaluated papers | A distinct concept from question papers — scanned/graded physical answer scripts uploaded per student per exam+subject, a pure document repository with no scoring logic of its own |
| Report cards | Combined attendance + marks summary, generated server-side as structured data and rendered to PDF client-side |
| Notifications | Exam publish, marks-published, and question-paper-published events each notify the affected students |

---

## 21. Homework & Assignment System

Homework and "assignment" are the **same entity** in this codebase — there is no separate assignment table.

| Aspect | Detail |
|---|---|
| Teacher creates homework | Any teacher assigned to the class/subject can create homework |
| Approval/review flow | **Implemented, real workflow.** If the creating teacher is the class's homeroom (Class) Teacher, the homework auto-approves and publishes immediately. If a subject teacher (not the class teacher) creates it, it starts in a `pending` state and the class teacher is notified to review it — only on explicit approval does it become visible to students. A "request changes" action sends it back to the author with a note; any subsequent edit by the author resets it to `pending` again. |
| Class teacher visibility | Full review queue of pending homework for their class |
| Student notification | Students (and the combined student/parent account) are notified on creation (if auto-approved) or on approval |
| Daily homework logs | Homework is listed per class with due dates; the combined student portal dashboard surfaces "today's homework" as a widget |
| Assignment workflow | Student submission is tracked per student per homework item (`homework_submissions`, one row per student, resubmittable) |

---

## 22. Registration & Login

| Aspect | Detail |
|---|---|
| Registration roles | Self-registration is available for six roles: **Principal, Teacher, Student, Accountant, Driver, and Extracurricular Staff.** (School Admin and Super Admin accounts are provisioned only by an existing administrator — there is no self-registration path for them.) |
| Login | Standard email/password login against Supabase Auth; the backend re-issues session/refresh tokens |
| Password generation | No email-invite flow is used — accounts are created directly via Supabase's admin user-creation API with an admin- or self-supplied password (a deliberate choice to avoid Supabase's rate-limited transactional email sender); the password is shared out-of-band |
| Password validation | Enforced client-side (Zod schema) and by Supabase Auth's own password rules; a dedicated change-password and forgot/reset-password flow exists |
| Approval workflows | **Implemented, real workflow.** Every self-registered account is created in a `pending` status and cannot log in until approved. Reviewer routing depends on role: Principal requests go to any School Admin/Super Admin; Teacher/Accountant/Driver/Extracurricular Staff requests go to any Principal at the school; Student requests go to the specific class teacher of the class the student selected (falling back to an admin reviewer if that class has no class teacher yet) |
| Pending approval | The applicant sees a dedicated "Registration Status" page while awaiting review |
| Rejection | A rejected request is recorded with reviewer notes; the account remains unable to log in |
| Account activation | Approval flips the account's `status` to `approved`, unlocking login; for teacher registrations, any proposed class/subject assignments captured at registration time are only actually applied once approved — never live on a pending account |

---

## 23. Syllabus Management

| Role | Access |
|---|---|
| School Admin / Principal | Full create/edit/delete/publish across all classes and subjects |
| Teacher | Create/edit/publish restricted to the specific class/subject combinations they are actually assigned to teach |
| Student/Parent | Read-only — sees only **published** syllabus entries for their own class |

**Functionality:** one syllabus entry per academic year + class + subject, each with a single uploaded document (title/description metadata), stored in a dedicated private Storage bucket. Publish/unpublish is an explicit boolean flag, stamped with who published it and when. Preview and download both use short-lived (1-hour) signed URLs regenerated on every fetch — the backend does not distinguish "preview" from "download" as separate operations.

---

## 24. Academic Management

| Aspect | Detail |
|---|---|
| Academic years | Per-school, with exactly one year marked "current" at a time (enforced by a database constraint) |
| Classes | Per school, optionally scoped to a branch and an academic year; capacity tracking; active/inactive status |
| Sections | Modeled as a field on the class record itself (a "class" is effectively class name + section) |
| Subjects | Per-school catalog, with active/inactive status |
| Default subjects | No platform-wide default subject seed was found — subjects are created per school |
| Teacher assignment | Teachers are linked to class+subject combinations via a dedicated assignment table, with bulk-assignment support |
| Class teacher assignment | A single homeroom/"class teacher" can be set (and cleared) per class, distinct from subject-teacher assignment |
| Subject teacher assignment | One teacher per class+subject pairing |

---

## 25. Location Management

| Aspect | Detail |
|---|---|
| Country / State / City | The frontend uses the **`country-state-city`** npm package to power cascading Country → State → City dropdowns on forms (e.g. school and student address fields) |
| District / PIN code | Captured as free-text fields on `schools` and `students` records (`district`, `pin_code`) — not sourced from a cascading lookup, since `country-state-city` does not model districts as a distinct tier |
| Cascading dropdowns | Implemented for Country/State/City selection |
| Custom city entry | The underlying package/field is free-text-compatible at the data-storage level, so a value outside the package's known city list can still be saved (no server-side whitelist enforcement was found restricting city values) |

---

## 26. Student Management

| Field / Feature | Status |
|---|---|
| Personal details | Implemented (name, DOB, gender, place of birth, nationality, religion, category, blood group) |
| Parent details | Implemented as quick-contact fields directly on the student record (father/mother name, phone, email, occupation) — a database constraint requires at least one parent contact be provided. There is no separate parent account/table (removed in migration 064). |
| Contact details | Implemented (phone, address, city, district, state, PIN code) |
| Aadhaar | Implemented — a dedicated field with a 12-digit format validation constraint |
| Blood group | Implemented |
| Religion | Implemented |
| Category | Implemented |
| Address | Implemented, including cascading location fields |
| Academic details | Implemented (class/section assignment, admission number) |
| Profile photo | Implemented, stored in the shared `avatars` bucket |
| Attendance | Implemented — full history and summary access from the student profile |
| Marks | Implemented — full history and summary access from the student profile |
| Fees | Implemented — full dues/payment history from the student profile |
| Reports | Implemented — report card and progress reports |
| Bulk import | Implemented — bulk student creation endpoint |
| Bulk delete | Implemented — bulk delete endpoint (staff-only) |
| Activation/deactivation | Implemented — both single and (for creation) bulk operations; a separate permanent-delete endpoint also exists for staff |
| Sibling linking | Implemented — manual bidirectional sibling search/link/unlink between student records |

---

## 27. Teacher Management

| Field / Feature | Status |
|---|---|
| Profile | Implemented |
| Qualification | Captured as part of the teacher profile record |
| Experience | Implemented (`experience_years` field) |
| Employee ID | Implemented, unique per school |
| Class assignment | Implemented (class-subject assignment table) |
| Subject assignment | Implemented, including bulk assignment |
| Homeroom (class teacher) assignment | Implemented — set/clear per class |
| Attendance reports | Implemented — daily and monthly-summary views, plus automatic absence marking past a configurable check-in cutoff |
| Profile photo | Implemented, shared `avatars` bucket |
| Leave | Implemented — self-service application (reviewed by Principal) and admin-side review/creation |
| Timetable | Implemented — own weekly schedule view |
| Students | Implemented — full roster and individual profile access for their own class's students |
| Documents | Implemented — HR-style document uploads (resume, ID proof, degree certificate, experience letter, photo) in a dedicated private bucket |

---

## 28. Gamified Website Learning / Certification

**Status: Backend fully built, but not reachable — no live feature exists today.**

The database schema (migrations 071–072) and a complete backend implementation exist for a role-specific MCQ knowledge assessment:

- Question bank with 4-option multiple-choice questions, organized into named "question sets" per role (student, teacher, principal, school admin, accountant, driver, extracurricular staff), managed by Super Admin.
- Retake logic: round-robin selection cycles through every active set for a role before repeating one.
- Question order and answer-option order are shuffled per attempt.
- Score percentage computed automatically; pass/fail against a configurable passing threshold (70–90%, admin-configurable).
- Certification: a database row (certificate number, score, percentage, issue date) recorded on a pass — **not a generated PDF or image**; only the best passing attempt per role is retained.
- Role-based visibility: a monitoring hierarchy exists so each supervising tier (class teacher for students, principal for teachers, school admin for principals, super admin for school admins, and principal for accountants/drivers/EC staff) can see completion status for the people they oversee.

**Why it does not function today:** the corresponding route file (`backend/src/routes/websiteKnowledge.routes.ts`) exists with full controller wiring and validation, but is **never imported or mounted** in the application's route index — so none of these endpoints are callable over HTTP. There is also **no frontend page, component, or service** referencing this feature anywhere in the codebase. This should be understood as complete-but-disconnected backend work, not a partial feature.

**Student animations / completion tracking:** not applicable, since there is no reachable frontend to animate.

**Recommendation:** flagged in Section 36 as a near-term, low-effort win — the backend work is done; what remains is mounting the route and building the frontend quiz/certificate UI.

---

## 29. Student Learning Activities

**Status: Not implemented — database schema only.**

Migration `073_learning_games.sql` creates three tables (`learning_game_attempts`, `learning_game_stats`, `learning_game_user_achievements`) and their Row Level Security policies, along with a migration comment describing an intended 17-title catalog across Mathematics/Logic/General Learning categories. **No backend service, controller, route, or frontend code exists anywhere in the repository referencing this feature.** This is a genuine stub — schema was provisioned ahead of implementation, and implementation has not yet started. Labeled **Planned / Future Enhancement**.

---

## 30. UI/UX Design

- **Design system:** a hand-rolled component kit (no external UI library), styled entirely with Tailwind CSS utility classes against a custom `brand`/`accent` color token palette — giving the platform a consistent look without the visual signature of a generic component library.
- **Responsive design:** the frontend build targets standard responsive breakpoints via Tailwind; the production-hardening pass documented in `DEPLOYMENT.md` specifically called out mobile navigation improvements.
- **Modern cards / dashboards:** every role's dashboard is built from stat-card and chart components (Recharts), consistent across portals.
- **Animations / transitions:** **Framer Motion** and **lottie-react** are real, used dependencies — confirming animated UI elements exist, though the specific extent (e.g. which pages use Lottie animations) was not itemized in this audit.
- **Role-specific dashboards:** confirmed — Super Admin, Admin Console (School Admin/Principal), Teacher, the combined Student/Parent Portal, Accountant, Driver, and Extracurricular Staff each have visually and functionally distinct dashboards; only Support Staff lacks one (see Section 36).
- **Gender-based student visual theme:** the combined Student/Parent portal shell (`PortalShell.tsx`) is documented internally as "gender-themed" — a value confirmed to exist in the codebase, though the exact visual treatment was not independently itemized in this audit; **do not over-state this as a fully art-directed system without a direct visual review.**
- **Child-friendly vs. professional dashboards:** the student portal and staff/admin consoles use visually distinct shells (`PortalShell` vs. the generic `DashboardShell`/premium admin shell), consistent with a "friendlier student experience, professional adult dashboards" design intent.
- **Accessibility:** no dedicated accessibility audit, ARIA-specific tooling, or accessibility test suite was found in the codebase. This should not be assumed to meet a formal accessibility standard (e.g. WCAG) without a separate review.

---

## 31. Security

| Area | Implementation |
|---|---|
| Authentication | Supabase Auth (JWT-based); the backend independently verifies every incoming JWT (`requireAuth` middleware) rather than trusting the frontend |
| Authorization | Two-layer: role/permission middleware (`requireRole`/`requirePermission`, DB-backed) plus row-level guard helpers for "is this actually your data" checks (`assertTeacherOwnsClass`, `assertStudentAccess`, tenant-scoping helpers) |
| Password hashing | Delegated entirely to Supabase Auth's managed user store — the application never stores or hashes passwords itself |
| Role-based permissions | 43 distinct permission codes across 9 active roles, enforced server-side on every mutating and most read routes (see Section 9) |
| Input validation | Zod schemas on every mutating backend route, applied via shared validation middleware; React Hook Form + Zod on the frontend as a first line of defense (not the security boundary) |
| API security | Helmet (security headers), CORS with an explicit origin allow-list, `express-rate-limit` on authentication endpoints, response compression |
| Database security | Row Level Security enabled on essentially every table as defense-in-depth tenant isolation, built on `SECURITY DEFINER STABLE` helper functions (`has_role`, `has_permission`, `has_school_access`, `is_staff`, `is_super_admin`) to avoid RLS self-recursion; the backend's primary authorization boundary remains its own middleware, since it connects with a service-role key that bypasses RLS |
| File upload security | Storage bucket policies scope reads/writes by school/user/role; sensitive buckets (student documents, teacher documents, exam documents, evaluated papers, syllabus) are private and served via short-lived signed URLs rather than public links |
| Session management | Supabase-issued access/refresh tokens, refreshed via a dedicated `/auth/refresh` endpoint; server-side login-attempt logging (`login_history`) |
| Account activation/deactivation | Every account carries an `is_active`/`status` flag; deactivation is soft (data-preserving) with a separate, explicit permanent-delete path for students; Super Admin can additionally cascade-suspend an entire school's access |
| Audit trail | `login_history` (every login attempt, success or failure), `activity_logs` (curated per-school admin actions), and `platform_audit_logs` (cross-school Super Admin actions) |

**Not found / not implemented:** no dedicated intrusion-detection or WAF layer beyond Helmet/rate-limiting; no automated dependency-vulnerability scanning pipeline (no CI exists at all — see Section 34/35); no formal penetration-test report reviewed as part of this audit.

---

## 32. Database Design

**Engine:** PostgreSQL via Supabase. **Schema management:** no ORM — plain SQL, one base schema file plus 75 additive numbered migrations (some migration numbers were reused for two unrelated, independently-applied files, e.g. two different files both numbered `019`, `029`, `039`, `040`, `049` — all confirmed real and applied, not conflicting).

### 32.1 Table Catalog (grouped)

**Core / Auth / RBAC:** `schools`, `roles`, `users`, `permissions`, `role_permissions`, `user_roles`, `school_admin_schools`, `platform_audit_logs`, `login_history`, `activity_logs`, `registration_requests`, `school_creation_requests`.

**Academic structure:** `classes`, `subjects`, `class_subjects`, `academic_years`, `branches`, `departments`, `syllabus`.

**People (1:1 extensions of `users`):** `students`, `teachers`, `drivers`, `extracurricular_staff`, `extracurricular_staff_code_seq`, `student_siblings`, `student_documents`, `teacher_documents`. *(`parents` and `student_parents` existed originally and were dropped by migration 064.)*

**Attendance:** `attendance`, `attendance_history`, `teacher_attendance`, `extracurricular_attendance` (plus four reporting views: `vw_attendance_daily_summary`, `vw_attendance_monthly_summary`, `vw_attendance_student_summary`, `vw_attendance_class_summary`).

**Exams / Marks:** `exams`, `exam_marks`, `exam_schedule`, `exam_documents`, `evaluated_papers`.

**Homework:** `homework`, `homework_submissions`.

**Timetable:** `timetable_periods`, `timetable_change_requests`.

**Fees:** `fee_structures`, `fee_payments`, `student_fee_overrides`.

**Transport:** `vehicles`, `routes`, `pickup_points`, `student_pickup_points`, `trips`, `trip_student_status`, `vehicle_locations`, `trip_history`, `vehicle_maintenance_records`, `student_live_locations` (originally `parent_locations`).

**Notifications / Announcements:** `notifications`, `notification_reads`, `announcements`, `announcement_classes`, `announcement_attachments`, `announcement_teachers`, `announcement_extracurricular_staff`, `push_subscriptions`.

**Leave / Change Requests:** `leave_requests` (teacher/principal), `student_leave_requests`, `student_profile_change_requests`.

**Extracurricular:** `activities`, `extracurricular_staff_activities`, `extracurricular_batches`, `extracurricular_batch_students`, `extracurricular_schedule_slots`, `extracurricular_practice_work`, `extracurricular_events`, `extracurricular_achievements`.

**Website Knowledge Assessment** *(schema built, not connected — see Section 28)*: `website_knowledge_questions`, `website_knowledge_question_sets`, `website_knowledge_question_set_items`, `website_knowledge_settings`, `website_knowledge_attempts`, `website_knowledge_attempt_answers`, `website_knowledge_certificates`, `website_knowledge_notification_log`.

**Learning Games** *(schema only — see Section 29)*: `learning_game_attempts`, `learning_game_stats`, `learning_game_user_achievements`.

### 32.2 Relationships (ER-style summary)

- **Tenancy root:** `schools` — nearly every business table carries a `school_id` foreign key, the basis of the multi-tenant isolation model.
- **Identity:** `users` is a 1:1 extension of Supabase's own `auth.users`. Role-specific data hangs off `users.id` via further 1:1 tables — `students`, `teachers`, `drivers`, `extracurricular_staff`. A person's *primary* role lives on `users.role_id` (used for dashboard redirect); the authoritative permission source is the `user_roles` → `role_permissions` → `permissions` chain, which also allows one person to legitimately hold more than one role.
- **Students ↔ Classes ↔ Schools:** a student belongs to exactly one school and optionally one class; a class belongs to a school and optionally a branch/academic year; `class_subjects` links a class to the subjects it studies and the teacher assigned to each. Teacher "ownership" of a class (for API authorization) derives from either homeroom assignment (`classes.class_teacher_id`) or a `class_subjects` row.
- **Students ↔ Parents (historical):** originally modeled via a `parents` extension table and a `student_parents` link table; both were dropped when the combined Student/Parent account model was introduced (migration 064) — parents now log in as the student's own account.
- **Transport:** a `route` owns its `vehicle_id` (unique) and up to two `driver` FKs; `pickup_points` belong to a route as an ordered list; `trips` are individual runs of a vehicle/route/direction/date; `trip_student_status` tracks each student's pickup/absent state per trip; `vehicle_locations`/`trip_history` form the GPS/event stream (Realtime-enabled); `student_live_locations` separately tracks the last-known position of whoever has the transport page open.
- **Notifications:** a single `notifications` table addresses recipients via one of five `audience_scope` modes (school-wide, class, student, role, or a single user); `announcements` is a separate authoring layer that fans out into `notifications` rows on publish.
- **Fees:** `fee_structures` can target a whole class or a single student; `student_fee_overrides` lets one student's amount differ from their class's shared fee line without touching the class-wide record; `fee_payments` records actual collections against a structure.

### 32.3 Roles Table (seed data)

| id | Role name | Notes |
|---|---|---|
| 1 | `school_admin` | |
| 2 | `principal` | Granted parity with `school_admin` (minus `platform.manage_schools`) |
| 3 | `teacher` | |
| ~~4~~ | ~~`parent`~~ | **Deleted** — combined into the `student` role |
| 5 | `student` | Combined Student/Parent account |
| 6 | `driver` | |
| 7 | `super_admin` | Platform tier, holds every permission |
| 8 | `support_staff` | Self-service profile only; no dedicated portal today |
| 9 | `accountant` | Finance-only permission scope |
| 10 | `extracurricular_staff` | Non-academic instructors |

### 32.4 Supabase Storage Buckets

| Bucket | Visibility | Purpose |
|---|---|---|
| `avatars` | Public | Profile photos for all user types |
| `student-documents` | Private (signed URL) | Student files (birth certificate, ID, transfer certificate, medical, other) |
| `homework-attachments` | Public | Teacher-uploaded homework/worksheet files |
| `homework-submissions` | Public | Student-uploaded homework submission files |
| `teacher-documents` | Private (signed URL) | Teacher HR files (resume, ID, degree certificate, experience letter, photo) |
| `exam-documents` | Private (signed URL) | Question papers, answer keys, hall tickets, result sheets |
| `school-logos` | Public | School branding logo |
| `announcement-attachments` | Private | Files attached to announcements |
| `extracurricular-achievements` | Private | Achievement/certificate uploads |
| `evaluated-papers` | Private (signed URL) | Graded/corrected exam answer sheets |
| `syllabus-documents` | Private (signed URL) | Syllabus files |

### 32.5 Row Level Security

RLS is enabled on essentially every table. Because the backend connects with a Supabase **service-role** key (which bypasses RLS) for nearly all of its own queries, RLS functions primarily as (a) the access mechanism for the small set of legitimate direct-client operations (self-profile edits, a driver updating their own trip, push-subscription management) and (b) defense-in-depth, so a leaked or misused client key still cannot read across schools. Two RLS-hygiene fixes are worth noting: migration 043 corrected an overly broad notification policy that had been leaking every school notification to any staff member regardless of its intended recipient, and migration 064 rewrote roughly a dozen policies to cleanly remove the dropped parent-account branch.

---

## 33. API Documentation Overview

All endpoints are mounted under the base path **`/api/v1`**. The table below summarizes the API surface by module (see the project's route source files for the complete, line-by-line listing — 31 route files, 300+ endpoints in total). Authentication is `requireAuth` (a valid Supabase JWT) unless marked Public.

| Module | Representative Endpoints | Auth / Role |
|---|---|---|
| **Auth** | `POST /auth/login`, `/auth/refresh`, `/auth/register/{principal,teacher,student,accountant,driver,extracurricular-staff}`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me` | Public (login/register/reset) or authenticated (`/me`, change-password) |
| **Schools** | `GET/POST /schools`, `GET/PATCH /schools/me`, `/schools/me/academic-years`, `/schools/me/branches`, `/schools/me/departments`, `/schools/me/holidays`, `/schools/platform/stats` | `platform.manage_schools` (platform-wide) or `school.manage_settings` (own school) |
| **School Requests** | `POST /school-requests`, `GET /school-requests/mine`, `POST /school-requests/:id/approve\|reject` | `schools.request_creation` (submit) / `platform.manage_schools` (review) |
| **Users** | `GET/POST /users`, `POST /users/bulk-*`, `GET/PATCH/DELETE /users/:id`, `/users/:id/roles` | `users.view` / `users.manage` / `roles.manage` |
| **RBAC** | `GET /roles`, `/permissions`, `/role-permissions` | `users.view` |
| **Classes & Subjects** | Full CRUD `/classes`, `/subjects`, `/classes/:id/subjects`, `/classes/:id/students` | `classes.manage` |
| **Students** | Full CRUD `/students`, bulk endpoints, plus 25+ sub-resource routes under `/students/:id/*` (documents, evaluated-papers, fees, transport, siblings, activity, dashboard, attendance, marks, exams, report-card, question-papers, homework, timetable, extracurricular, notifications, leave-requests, profile-change-requests) | `students.view/manage` (staff) or owning teacher/self, row-scoped |
| **Student Leave / Profile-Change Review** | `GET/PATCH /student-leave-requests`, `/profile-change-requests` | `requireRole("teacher")` — class-teacher review queue |
| **Teachers** | Full CRUD `/teachers`, assignments, homeroom, documents, attendance, leave-requests | `teachers.manage` |
| **Teacher Portal (self-service)** | `/teacher-portal/dashboard`, `/my-assignments`, `/students`, `/timetable`, `/assessments`, `/homework/ai-enhance`, `/leave-requests`, `/attendance/check-in\|check-out` | `requireAuth` only (self-scoped) |
| **Teacher Attendance (admin)** | `/teacher-attendance/daily`, `/monthly-summary`, `/mark` | `teachers.manage` |
| **Staff Leave Requests** | `/leave-requests/me/*` (self-service), `/leave-requests` (admin review) | `requireRole("teacher","principal")` or `teachers.manage` |
| **Attendance** | `/attendance/mark`, `/daily`, `/history`, `/reports/{daily,monthly,student-wise,class-wise}`, `/analytics/overall` | `requireRole("teacher")` (mark) up to `requireRole("school_admin","super_admin")` (analytics) |
| **Exams** | Full CRUD `/exams`, `/exams/:id/schedule`, `/documents`, `/marks`, `/subject-status`, `/report`, `/analytics/performance` | `marks.view` / `marks.manage` |
| **Homework** | `/homework`, `/homework/review`, `/:id/approve`, `/:id/request-changes`, `/:id/submit`, `/:id/submissions` | `homework.view/manage/submit` |
| **Timetable** | `/timetable`, `/timetable-change-requests` | `timetable.view/manage`; teacher self-service for change requests |
| **Notifications** | `/notifications/me`, `/read-all`, `/notifications` (admin), `/notifications/emergency` | `requireAuth` (self) / `notifications.view\|manage` |
| **Push** | `/push/subscribe`, `/push/unsubscribe` | `requireAuth` |
| **Announcements** | Full CRUD `/announcements` | `announcements.view/manage` |
| **Audit Log** | `/audit/login-history`, `/audit/activity-log` | `security_logs.view` |
| **Activities** | `/activities`, `/activities/:id/assignments` | `requireAuth` (list) / `activities.manage` (write) |
| **Extracurricular Staff** | Full CRUD `/extracurricular-staff`, batches, schedule, achievements | `extracurricular_staff.manage` |
| **Extracurricular Portal (self-service)** | `/extracurricular-portal/dashboard`, `/activities`, `/batches`, `/schedule`, `/attendance`, `/practice-work`, `/events`, `/achievements` | `requireAuth` only (self-scoped) |
| **Syllabus** | Full CRUD `/syllabus`, `/syllabus/my-class` | `requireRole(...staff...)` for write; `requireRole("student")` for own-class read |
| **Transport** | Full CRUD `/transport/{vehicles,drivers,routes,pickup-points,student-pickups,maintenance}` | `transport.manage` |
| **Tracking** | `/tracking/driver/trips`, `/location`, `/end`, `/students/:studentId/status`, `/tracking/student/vehicles`, `/tracking/admin/active-vehicles`, `/tracking/trips/:tripId/eta` | `requireRole("driver"\|"student")` or `transport.view/manage` |
| **Reports** | `/reports/admin/overview`, `/principal/school-analytics`, `/teacher/class-performance`, `/student-progress/:id`, `/reports/hub/{attendance,students,teachers,fees,transport,exams}` | Role-gated per report tier, or `reports.view` (Reports Hub) |
| **Fees** | `/fees/structures`, `/dashboard`, `/analytics`, `/students`, `/payments`, `/payments/:id/receipt`, `/reports/collection`, `/reports/class-wise`, `/bulk/*` | `fees.view/manage` |
| **Super Admin (Platform)** | `/super-admin/dashboard`, `/schools`, `/schools/impact`, `/schools/set-active`, `/school-admins`, `/school-admins/:id/schools`, `/audit-log` | `requireRole("super_admin")` + specific `platform.*` permission on every route (double-gated) |
| **Registration Requests** | `GET /registration-requests`, `PATCH /registration-requests/:id` | `requireAuth` (row/permission-scoped inside the service) |
| **Health** | `GET /health` | Public |
| **Website Knowledge (built, unmounted)** | N/A — not reachable | N/A |

---

## 34. Testing

| Aspect | Detail |
|---|---|
| Backend unit tests | **16 test files** (`*.test.ts`), covering 14 services (announcement, attendance, auditLog, backup, exam, fees, homework, leaveRequest, registration, reportsHub, studentLeaveRequest, teacherPortal, tracking, transport) and 2 utility modules (leave-date cutoff logic, teacher-class-ownership guard). Run via **Vitest**. |
| Backend mocking approach | A hand-built Supabase query-builder mock (`backend/src/test-support/supabaseChain.ts`) — every chain method returns itself, with a preset resolved result — so services are tested in isolation with **no real database hit** |
| Frontend tests | **3 test files**: one service-level unit test (`auth.service.test.ts`) and two component tests (`TeacherAttendancePage.test.tsx`, `TeacherDashboardPage.test.tsx`) using **@testing-library/react + jsdom**, with hooks/services mocked via `vi.mock` |
| Manual testing | Not independently verifiable from the codebase; `DEPLOYMENT.md`'s pre-deploy checklist calls for running the full test suite by hand before every deploy |
| Role testing | No dedicated role-based-access-control test suite was found (e.g. verifying a Teacher cannot call a School Admin-only endpoint) — coverage is concentrated on service business logic, not authorization boundaries |
| API testing | No dedicated integration/API-contract test suite (e.g. Supertest against a live Express instance) was found — only isolated service-layer unit tests |
| UI testing | Limited to the 2 component tests listed above; most pages have no automated UI test coverage |
| Validation testing | Zod schemas are exercised indirectly through the service tests that hit validation paths, not via a dedicated validator test suite |
| Permission testing | Not covered by an automated test suite (see "Role testing" above) |
| **End-to-end (e2e) testing** | **Not implemented** — no Playwright, Cypress, or equivalent tool/config exists anywhere in the repository |
| **Continuous Integration** | **Not implemented** — no `.github/workflows/` directory or any CI configuration exists; tests do not run automatically on push/PR today |

---

## 35. Deployment

| Aspect | Detail |
|---|---|
| Frontend hosting | **Vercel** — root directory `frontend`, Vite auto-detected, `npm run build`, output `dist`; `frontend/vercel.json` handles SPA routing fallback, security headers, and static asset caching |
| Backend hosting | Any Docker-capable host — `backend/Dockerfile` is a multi-stage, Node 20-alpine build with a non-root runtime user and a container health check against `/api/v1/health`. `DEPLOYMENT.md` gives worked deployment examples for **Render** and **Railway**, and documents the same approach applying to Fly.io, AWS ECS/App Runner, Google Cloud Run, Azure Container Apps, or a self-managed VPS |
| Database hosting | **Supabase-managed PostgreSQL** — production project created via the Supabase dashboard; schema, RLS, and all migrations are applied by hand, in ascending numeric order, through the Supabase SQL Editor (one migration file, `009_attendance_system.sql`, is explicitly documented and confirmed to be a stray draft against an incompatible schema and must be skipped) |
| Environment variables | Two `.env` files (`backend/.env`, `frontend/.env`), both validated at process boot (Zod on the backend — a missing required variable crashes startup immediately with a clear error rather than failing later). The Supabase **service-role key** is backend-only and is never exposed to the frontend or placed behind a `VITE_`-prefixed variable |
| Production configuration | Rate limiting, HTTP compression, `trust proxy` configuration for correct client-IP detection behind a reverse proxy, multi-origin CORS, and a hardened Nodemailer/SMTP configuration were all specifically called out as part of a documented production-hardening pass |
| Domain / HTTPS | Vercel auto-manages SSL for the frontend; most recommended backend hosts do the same; a bare-VPS deployment is documented as needing Caddy or Nginx+Certbot in front of the container |
| Backup strategy | Primarily Supabase's own managed automatic daily backups (with a recommendation to upgrade to a plan offering Point-in-Time Recovery before go-live); a supplementary nightly `pg_dump`-via-scheduled-job approach is documented as example configuration in `DEPLOYMENT.md`, **not** an implemented, running workflow. Storage bucket contents are explicitly noted as *not* covered by `pg_dump` and needing separate handling |
| Rollback plan | Frontend: instant promotion of a previous Vercel deployment. Backend: redeploy the previous Docker image/commit. Database: migrations are additive-only with no down-migration story — any reversal requires a hand-written SQL script, tested on a staging project first |
| CI/CD | **Not implemented** — deployments and pre-deploy checks are manual today (see Section 34) |

---

## 36. Future Enhancements

The following are **not implemented today** and are flagged here explicitly as planned/future work, not completed functionality:

1. **Parent-Teacher Meeting (PTM) scheduling** — no meeting-scheduling feature exists.
2. **School-wide image gallery** — only an activity-photo section exists inside the Extracurricular module; a general school gallery is not built.
3. **Communication / chat module** — no messaging feature, table, or service exists.
4. **Gamified Website-Knowledge Assessment — go-live** — the backend (questions, sets, attempts, scoring, certificates, monitoring hierarchy) is fully built; the remaining work is mounting the existing `websiteKnowledge.routes.ts` router into the application and building the corresponding frontend quiz/certificate UI.
5. **Student Learning Games** — only database schema exists (17-title catalog across Math/Logic/General Learning was scoped in the migration's own comments); no backend service, API, or frontend has been built.
6. **Support Staff portal** — the role and its permission exist in RBAC, but there is no dedicated dashboard, navigation, or feature set for this role; accounts currently land on a generic profile page only.
7. **Automated CI/CD pipeline** — no continuous integration currently runs the existing test suite or build on push/PR; this is recommended before scaling the engineering team or release cadence.
8. **End-to-end (browser) test coverage** — no Playwright/Cypress suite exists; current automated testing is limited to backend service unit tests and a small number of frontend component tests.
9. **Automated backup workflow** — the documented nightly `pg_dump` approach is example configuration only; it is not a running, scheduled job today.
10. **Real AI-powered features** — the current "AI Homework Assistant" is a deterministic, rule-based text formatter, explicitly designed to be swapped for a genuine LLM integration later; no such integration exists today.
11. **Geofencing for transport** — proximity notifications are distance/time-estimate based (haversine + rolling average speed); there is no true geofence (zone-boundary) model for "arrived at school" / "arrived at home" detection.

---

## 37. Conclusion

The Smart School Management System is a substantially complete, production-architected multi-tenant platform covering the core operational needs of running one or more schools: student and staff records, attendance, academics (timetable, homework, exams, marks, syllabus), fee collection, live GPS-tracked transport, extracurricular activity management, and a unified multi-channel notification system — all governed by a database-backed role-based access control model spanning nine active user roles.

The engineering is consistent and conventional: a layered Express/TypeScript backend with no ORM, a Supabase-backed PostgreSQL database secured by Row Level Security as defense-in-depth, and a component-based React 19/TypeScript frontend with role-gated, lazy-loaded routing. Several subsystems — transport/GPS live tracking, the homework and leave approval workflows, and the RBAC/multi-school administration model — are notably mature and fully wired end to end.

The most significant gaps are clearly bounded and inexpensive to close relative to the platform's overall scope: the Website-Knowledge Assessment feature needs only its existing route file mounted and a frontend built against an already-complete backend; Learning Games, PTM scheduling, a general gallery, and chat remain unbuilt; and the project currently lacks automated CI/CD and end-to-end test coverage, which should be prioritized before any significant scale-up in usage or contributor count. None of these gaps affect the integrity of what has been built — they represent a clear, prioritizable roadmap rather than defects in the existing system.

---

*This report was generated by direct inspection of the project's source code, database migrations, and configuration files as they exist in the repository at the time of writing. Every claim of "implemented" functionality was verified against actual code (routes, services, and frontend pages); every claim of a gap or limitation was verified by its absence. No feature described here was inferred from documentation alone without corresponding code, except where explicitly noted.*
