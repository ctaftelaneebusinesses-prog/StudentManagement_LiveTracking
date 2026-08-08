# Scope of Work

## Smart School Management System

**Version:** 1.0.0
**Document Date:** August 7, 2026
**Document Type:** Scope of Work (SOW)

This document defines what is included in the Smart School Management System as it exists today, based on direct inspection of the project's source code, database, and configuration. It complements the *Detailed Project Report* and uses the same terminology, module names, and role names throughout.

---

## Table of Contents

1. Project Overview
2. Project Objectives
3. Scope of Work
4. User Roles
5. Functional Modules (A–H)
6. Student Management Scope
7. Teacher Management Scope
8. Academic Management Scope
9. Attendance Scope
10. Fee Management Scope
11. Examination Scope
12. Homework & Assignment Scope
13. Timetable Scope
14. Leave Management Scope
15. Notification Scope
16. Transport & GPS Scope
17. Extracurricular Activities Scope
18. Syllabus Scope
19. Registration & Login Scope
20. User & Role Management Scope
21. Communication / Chat Scope
22. Reports Scope
23. UI/UX Scope
24. Security Scope
25. Database Scope
26. API Scope
27. Testing Scope
28. Deployment Scope
29. Out-of-Scope Items
30. Assumptions & Dependencies
31. Deliverables
32. Acceptance Criteria
33. Future Enhancements

---

## 1. Project Overview

The Smart School Management System is a multi-tenant, web-based platform (Vite + React 19 + TypeScript frontend; Node.js + Express + TypeScript backend; Supabase/PostgreSQL database, authentication, and file storage) that digitizes school administration and academic operations. One deployment serves multiple independent schools, each with isolated data, and provides nine active, role-specific portals: Super Admin, School Admin, Principal, Teacher, the combined Student/Parent portal, Accountant, Driver, and Extracurricular Staff (plus a minimal Support Staff account).

## 2. Project Objectives

- Digitize core school operations: student/staff records, attendance, academics, examinations, fees, transport, and extracurricular activities.
- Provide a platform-level administrative tier so an organization can operate multiple schools from one system.
- Enforce structured, auditable approval workflows for homework publication, leave, registration, and profile changes.
- Deliver live GPS-based transport visibility to students/parents and staff.
- Centralize communication across in-app, email, and push notification channels.
- Maintain a secure, role-based access model with server-side enforcement, independent of what the frontend UI shows or hides.

## 3. Scope of Work

This engagement's scope, as reflected in the current codebase, covers:

- A complete multi-tenant backend REST API (`/api/v1`, 31 route modules, 300+ endpoints) with database-backed role-based access control.
- A complete, role-gated single-page frontend application covering all nine active roles.
- A PostgreSQL schema (via Supabase) of 75+ additive migrations covering every module listed in Section 5 below, with Row Level Security as a tenant-isolation safeguard.
- Integrated file storage (11 Supabase Storage buckets) for documents, photos, receipts, and achievement uploads.
- A unified, multi-channel notification pipeline (in-app, email, browser push).
- Live GPS transport tracking with automated proximity notifications.
- Deployment configuration for a static frontend host (Vercel) and a containerized backend (Docker, deployable to any container host).
- A backend and frontend automated unit-test suite (Vitest).

Items explicitly outside this scope are listed in Section 29.

## 4. User Roles

| # | Role | Portal |
|---|---|---|
| 1 | Super Admin | Platform Console |
| 2 | School Admin | Admin Console |
| 3 | Principal | Admin Console (shared with School Admin, restricted) |
| 4 | Teacher | Teacher Portal |
| 5 | Student / Parent *(combined account)* | Student Portal |
| 6 | Accountant | Accountant Portal |
| 7 | Driver | Driver/Transport Portal |
| 8 | Extracurricular Staff | Extracurricular Portal |
| 9 | Support Staff | *(RBAC role only — no dedicated portal; see Section 29)* |

*(Role id 4, "parent," was a distinct role in an earlier version of the schema and has been removed — parents and students now share one account and one portal.)*

## 5. Functional Modules

### A. Super Admin
Multi-school creation/management, School Admin account management (including assignment to more than one school), school activation/deactivation with cascading suspension, school-creation request review, platform-wide audit log, platform statistics dashboard.

### B. School Admin
Full administrative control of one school (or assigned schools): classes/sections/subjects, teachers, students, timetable, fees, exams, transport, announcements, users & roles, reports, syllabus, settings (branches, academic years, departments, holidays), registration approvals (Principal-tier), staff leave review, school-creation requests.

### C. Principal
Identical console to School Admin with one functional restriction (no cross-school/platform administration rights); additionally reviews Teacher/Accountant/Driver/Extracurricular Staff registration requests and applies for their own leave (approved by School Admin/Super Admin).

### D. Teacher
Class/subject teaching duties: attendance marking, homework creation and (as class teacher) approval, marks entry, question papers, syllabus publishing, own timetable, own leave application, review of student leave and profile-change requests (as class teacher), review of student registration requests (as class teacher), read-only transport monitoring.

### E. Student/Parent
Attendance history/calendar, homework, exams/marks/report cards, evaluated papers, fees, timetable, syllabus, extracurricular participation, live transport tracking, notifications, self-service leave requests, profile-edit requests (teacher-approved).

### F. Accountant
Fee structure management (class-wide and per-student), payment recording, receipts, collection reporting (daily/weekly/monthly/yearly, class-wise/student-wise), due tracking.

### G. Driver
Trip start/end, continuous GPS sharing while a trip is active, per-student pickup/absent and drop/not-dropped marking.

### H. Extracurricular Staff
Activity/batch management, student enrollment (whole-class or selected), weekly scheduling, session attendance, practice-work assignment, event recording, achievement/certificate file uploads.

## 6. Student Management Scope

**In scope:** personal details, parent quick-contact fields (father/mother name/phone/email/occupation), contact/address details with cascading country-state-city selection, Aadhaar number (validated format), blood group, religion, category, academic details (class/section, admission number), profile photo, attendance/marks/fees history access, bulk import, bulk class assignment, bulk delete, activation/deactivation (soft) and permanent delete, sibling linking.

## 7. Teacher Management Scope

**In scope:** profile, qualification/experience fields, employee ID, class and subject assignment (including bulk assignment), homeroom/class-teacher assignment, attendance tracking with automated absence marking past a configurable check-in cutoff, profile photo, leave application and review, own timetable, HR document uploads, roster and profile access for their own students.

## 8. Academic Management Scope

**In scope:** academic years (one "current" year per school, enforced), classes and sections, subjects (per-school catalog), branches (multi-campus support), departments, class-subject-teacher assignment, homeroom assignment.

**Out of scope:** a platform-wide default subject template/seed — each school builds its own subject catalog from scratch.

## 9. Attendance Scope

**In scope:** daily student attendance (present/absent/late/half-day/leave) with a change-history audit trail; class-wise, student-wise, daily, and monthly reporting; overall analytics; teacher (staff) attendance with check-in/check-out and automated absence marking past a cutoff; extracurricular-session attendance (separate from academic attendance).

## 10. Fee Management Scope

**In scope:** class-wide and per-student fee structures; per-student overrides on a class-wide fee line; discount and scholarship amounts; payment recording and receipt generation (client-rendered PDF); bulk fee assignment/update/removal; collection dashboards and reports (daily/weekly/monthly/yearly, class-wise); deletion safeguard preventing removal of a fee structure with recorded payments; transport-fee integration into a student's total dues.

## 11. Examination Scope

**In scope:** exam creation (single class, all classes, or a selected set); per-subject exam timetable with double-booking prevention; question-paper compose (rich text) or upload, with an independent publish gate; marks entry with automatic grade calculation; independent results-publish gate; class-teacher visibility into per-subject marks-entry completion with a reminder action; evaluated (graded) paper uploads, distinct from question papers; combined attendance+marks report card generation (client-rendered PDF).

## 12. Homework & Assignment Scope

**In scope:** homework creation by class or subject teachers; a real approval workflow — auto-approved if created by the class teacher, otherwise routed to the class teacher for approval or "request changes" before publication; per-student submission tracking; notifications on creation/approval. Homework and "assignment" are one and the same feature — there is no separate assignment entity.

## 13. Timetable Scope

**In scope:** weekly recurring period schedule per class (day, period number, time, room, academic or extracurricular type); teacher-proposed change requests with an admin review queue; own-timetable views for teachers and students.

## 14. Leave Management Scope

**In scope:** self-service leave application for teachers, principals, and students, each with its own approval path (Teacher → Principal; Principal → School Admin/Super Admin, never another Principal; Student → their own class teacher); a hard same-day 6:00 PM cutoff on selecting the current day as a leave start date; duplicate-request prevention; race-safe approval (no double-processing); computed leave-entitlement summaries; notification on submission and decision.

## 15. Notification Scope

**In scope:** a single event-driven pipeline delivering to three channels — in-app (with Realtime live delivery and per-user read tracking), email (SMTP via Nodemailer, optional/skippable in environments without SMTP configured), and browser push (Web Push/VAPID, optional/skippable without keys configured); ~30 distinct notification types spanning every workflow in this document; scheduled/automatic notifications for published announcements and auto-marked teacher absences (in-process polling, single-server-instance model); emergency school-wide broadcast alerts; a shared admin-tier recipient resolver ensuring Super Admins and multi-school School Admins are never dropped from "notify the admins" fan-outs.

## 16. Transport & GPS Scope

**In scope:** vehicle/driver/route fleet management with route-owned vehicle+driver assignment (one vehicle per route, up to two drivers); unified, ordered stop list per route (evening leg computed as the reverse of the morning leg, not separately stored); per-student standing pickup assignment with a morning/evening/both preference; driver trip start/end flow with screen wake-lock, offline GPS retry queue, and in-progress-trip recovery on reload; continuous GPS sharing (~10-second interval) visible live to students/parents and staff; haversine-distance/rolling-average-speed ETA calculation; automated 10-minute, 5-minute, and arrival proximity notifications, de-duplicated per trip/student; per-student pickup/absent and drop/not-dropped marking; vehicle maintenance record-keeping; trip history.

**Out of scope:** third-party mapping/routing/traffic APIs; true geofencing (zone-boundary detection).

## 17. Extracurricular Activities Scope

**In scope:** a 16-activity global preset catalog (Dance, Yoga, PT, Karate, Music, Singing, Violin, Keyboard, Guitar, Drawing, Painting, Chess, Skating, Drama, Spoken English, Martial Arts) plus per-school custom activities; dedicated Extracurricular Staff accounts; activity assignment to staff; student enrollment via batches (whole-class or selected students); weekly scheduling with overlap detection; session attendance and summaries; practice-work assignment (staff-to-student direction only, no submission mechanism); event recording; achievement/certificate file uploads (image or document), including reuse of image uploads as an activity photo gallery.

**Out of scope:** system-generated certificate documents (achievements are file uploads of existing certificates/photos, not auto-generated PDFs).

## 18. Syllabus Scope

**In scope:** one syllabus entry per academic year + class + subject with a single uploaded document; admin/principal (full access) and teacher (restricted to their own assigned class/subject) create/edit/publish; student/parent read-only access to published entries for their own class; signed-URL preview/download (1-hour expiry, regenerated per request).

## 19. Registration & Login Scope

**In scope:** self-registration for six roles (Principal, Teacher, Student, Accountant, Driver, Extracurricular Staff), each entering a `pending` state and routed to the correct reviewer (School Admin/Super Admin for Principals; Principal for Teacher/Accountant/Driver/Extracurricular Staff; the selected class's teacher, or an admin fallback, for Students); login blocked until approved; rejection with reviewer notes; direct account creation (no email-invite flow) with out-of-band password sharing; deferred application of proposed assignments (e.g. a teacher's proposed class/subject) until approval; standard login, password change, and forgot/reset-password flows.

**Out of scope:** self-registration for School Admin or Super Admin accounts (provisioned only by an existing administrator).

## 20. User & Role Management Scope

**In scope:** database-backed RBAC (43 permission codes across 9 active roles), many-to-many user-to-role-to-school assignment, user CRUD, bulk activate/deactivate/create/delete, role assignment/revocation per user, a queryable role/permission/role-permission matrix API.

## 21. Communication / Chat Scope

**Out of scope — not implemented.** No messaging/chat feature, table, or service exists in the current codebase. See Section 29 and Section 33.

## 22. Reports Scope

**In scope:** admin overview and dashboard-overview reports; principal school-analytics; teacher class-performance reports; per-student progress reports; a "Reports Hub" with attendance, student, teacher, fee, transport, and exam-summary reports, each exportable from the frontend.

## 23. UI/UX Scope

**In scope:** a hand-rolled, Tailwind-CSS-based component kit (no third-party UI framework); role-specific dashboards for all roles except Support Staff; responsive layout; chart-based dashboards (Recharts); animation via Framer Motion/lottie-react; a distinct, "gender-themed" shell for the combined Student/Parent portal versus the professional admin/staff console shells; lazy-loaded, role-gated routing so a given role only downloads the code for portals it can reach.

**Out of scope / not verified:** a formal accessibility (e.g. WCAG) audit or certification.

## 24. Security Scope

**In scope:** Supabase Auth-based authentication with independent backend JWT verification; two-layer authorization (role/permission middleware plus row-level ownership guards); Zod input validation on all mutating routes; Helmet security headers, CORS allow-listing, rate limiting on auth endpoints; Row Level Security on essentially every database table as tenant-isolation defense-in-depth; private storage buckets with signed URLs for sensitive documents; login-attempt and administrative-action audit logging (school-level and platform-level); soft deactivation plus a separate permanent-delete path for students; cascading school/account suspension for Super Admin.

**Out of scope:** a dedicated WAF/intrusion-detection layer; automated dependency-vulnerability scanning; a formal penetration-test engagement (none reviewed as part of this scope).

## 25. Database Scope

**In scope:** PostgreSQL via Supabase; ~90 tables across Core/Auth/RBAC, Academic, Attendance, Exams/Marks, Homework, Timetable, Fees, Transport, Notifications/Announcements, Leave/Change-Requests, Extracurricular, and Website-Knowledge/Learning-Games schema groups (the latter two schema-only, see Section 33); 75+ additive, hand-applied SQL migrations (no ORM, no automated migration runner); Row Level Security policies on nearly every table; 11 Storage buckets.

## 26. API Scope

**In scope:** a versioned REST API under `/api/v1`, 31 route modules, 300+ endpoints, covering every module in Section 5; consistent `{ success, data }` response shaping and centralized error handling; Zod-validated request bodies on all mutating routes; middleware-enforced authentication and authorization on every protected route.

**Out of scope:** a public/external-partner API tier (all endpoints are for the platform's own frontend); GraphQL (REST only).

## 27. Testing Scope

**In scope (delivered):** 16 backend service/utility unit-test files (Vitest, with a hand-built Supabase query-builder mock — no live database in tests); 3 frontend unit/component tests (Vitest + @testing-library/react + jsdom).

**Out of scope (not delivered):** end-to-end/browser test automation (no Playwright/Cypress); integration/API-contract tests against a live server; a dedicated RBAC/permission-boundary test suite; automated test execution in CI (no CI pipeline exists — tests run manually today).

## 28. Deployment Scope

**In scope (delivered):** a production-ready backend Dockerfile (multi-stage, Node 20-alpine, non-root user, container health check); a Vercel-ready frontend configuration (`vercel.json`); documented deployment paths for Render/Railway (worked examples) and other container hosts (Fly.io, AWS, GCP, Azure, VPS); environment-variable validation at process boot; a documented backup/rollback strategy relying primarily on Supabase-managed backups.

**Out of scope (not delivered):** a `docker-compose.yml` or frontend Dockerfile; an automated CI/CD pipeline; an automated, running nightly backup job (documented as example configuration only); a dedicated staging environment configuration.

## 29. Out-of-Scope Items

The following are confirmed **not implemented** in the current codebase and are explicitly out of scope for this version of the platform:

- Parent-Teacher Meeting (PTM) scheduling
- A standalone, school-wide image gallery (only an activity-photo section exists inside Extracurricular)
- Communication / chat / messaging
- A functioning Gamified Website-Knowledge Assessment (backend fully built but its route is not mounted; no frontend exists — see Section 33)
- Student Learning Games (database schema only; no service, API, or frontend)
- A dedicated Support Staff portal/dashboard (role exists in RBAC only)
- Automated CI/CD
- End-to-end browser test automation
- A running, automated database backup job (only documented/example configuration exists)
- Real AI/LLM-powered features (the current "AI Homework Assistant" is a deterministic, rule-based text formatter, not an LLM integration)
- Geofencing for transport (proximity is time/distance-estimated, not zone-based)
- Third-party mapping/routing APIs (Leaflet renders maps locally; no Google Maps/Mapbox routing is integrated)
- A public/partner-facing API or GraphQL interface
- WCAG/accessibility certification

## 30. Assumptions & Dependencies

- A Supabase project (PostgreSQL + Auth + Storage) is available and provisioned per environment (development/production); the application has no functionality without it.
- SMTP credentials and VAPID (Web Push) keys are optional — email and push notifications are silently skipped (with a logged warning) if not configured, but in-app notifications always function.
- Node.js ≥ 20 is required for both frontend build tooling and the backend runtime.
- Database migrations are applied by hand, in ascending numeric order, via the Supabase SQL Editor — there is no automated migration runner, so environment setup requires a documented manual step (with one known stray file, `009_attendance_system.sql`, to be skipped).
- The platform assumes a single running backend instance for scheduled/automatic behaviors (announcement publishing, teacher auto-absence marking) — these are in-process pollers, not distributed job infrastructure, so multi-instance horizontal scaling of the backend would require re-architecting this piece.
- Client devices (parent/student and driver) require browser GPS/geolocation permission for live transport tracking to function.

## 31. Deliverables

- Full source code: `backend/` (Express/TypeScript API) and `frontend/` (React/TypeScript SPA).
- Database schema and migration files (`database/schema.sql`, `database/rls_policies.sql`, `database/migrations/*.sql`).
- Environment configuration templates (`backend/.env.example`, `frontend/.env.example`).
- Containerization for the backend (`backend/Dockerfile`) and static-hosting configuration for the frontend (`frontend/vercel.json`).
- Developer onboarding documentation (`README.md`) and production deployment documentation (`DEPLOYMENT.md`).
- Automated unit-test suites for both backend and frontend (Vitest).
- This Scope of Work and the accompanying Detailed Project Report.

## 32. Acceptance Criteria

- Every module listed as "in scope" in Sections 6–20 is reachable and functional end-to-end for the roles entitled to it, verified by direct exercise of the corresponding frontend page and backend endpoint.
- Role-based access control is enforced on the backend for every protected endpoint — a user without the required role/permission receives a rejection regardless of what the frontend displays.
- Data created under one school is never visible to, or editable by, a user of a different school (multi-tenant isolation).
- The backend builds and passes its existing test suite (`npm run build && npm test` in `backend/`); the frontend builds and passes its existing test suite (`npm run build && npm test` in `frontend/`).
- The documented deployment steps in `DEPLOYMENT.md` produce a running frontend (Vercel) and backend (Docker container) against a provisioned Supabase project.
- Items listed in Section 29 (Out-of-Scope) are not represented to stakeholders as delivered functionality.

## 33. Future Enhancements

Recommended next-phase work, in rough order of estimated effort relative to value:

1. **Mount and launch the Website-Knowledge Assessment feature** — lowest-effort item on this list; the backend (questions, sets, attempts, scoring, certificates, monitoring) is complete and only needs its route mounted plus a frontend quiz/certificate UI.
2. **Stand up a CI/CD pipeline** running the existing test suites and build on every push/PR, before scaling contributor count or release frequency.
3. **Build Student Learning Games** against the existing (currently unused) schema, per the 17-title catalog scoped in the schema's own migration comments.
4. **Build a Support Staff portal** with a dashboard and feature set appropriate to non-teaching staff.
5. **Add end-to-end test coverage** (e.g. Playwright) for the highest-traffic user journeys (login, attendance marking, fee payment, transport tracking).
6. **Implement PTM scheduling, a general school gallery, and a communication/chat module** — each a net-new module, not an extension of existing schema.
7. **Automate the database backup job** documented in `DEPLOYMENT.md` as a real, monitored, scheduled process rather than example configuration.
8. **Evaluate a genuine LLM integration** for the homework-assistant feature, replacing the current deterministic formatter, if AI-assisted content generation remains a product priority.
9. **Introduce transport geofencing** (true zone-boundary detection) if proximity-notification accuracy needs to improve beyond the current distance/speed estimate.

---

*This Scope of Work was derived directly from inspection of the project's source code, database schema, and configuration files, using the same verification standard as the accompanying Detailed Project Report: every "in scope" claim corresponds to code found in the repository, and every "out of scope" claim corresponds to a confirmed absence.*
