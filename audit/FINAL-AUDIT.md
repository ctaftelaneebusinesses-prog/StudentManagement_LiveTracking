# FINAL AUDIT — Smart School Management System

- **Commit:** `1252957` (main). **Date:** 2026-09-23.
- **Scope:** full repository (frontend, backend, database, deployment configuration).
- **Coverage:** static review, baseline checks, and a local replay of all SQL.
- **Not covered:** dynamic testing against a running app with data. No approved test environment existed, and no request was sent to the hosted Supabase project.

## Findings by severity
Unique defects; cross-references and duplicates are counted once.

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 2 | SEC-01, SEC-02 |
| HIGH | 3 | SEC-03, SEC-04, SEC-05 |
| MEDIUM | 16 | SEC-06–SEC-14, SEC-24, API-06, FN-01, FN-02, PERF-01, PERF-02, PERF-04 |
| LOW | 20 | SEC-15–SEC-23, SEC-26, API-07, FN-03–FN-07, PERF-03, PERF-05–PERF-07 |
| INFO | 6 | SEC-25, API-10, FN-08, UI-03, UI-04, UI-05 |
| **Total** | **47** | |

By evidence strength:
- **CONFIRMED** means shown by code, library behaviour, the migration replay, or tool output.
- **LIKELY** means strong code evidence that has not been reproduced dynamically.
- Neither CRITICAL finding has been reproduced against a live system.

## Highest-risk areas
1. **Account provisioning and identity fields in the database (SEC-01, SEC-02).** A user-controlled signup payload, plus row-level policies that don't restrict columns, may let users give themselves roles, approve themselves, or switch school. **Quick mitigation:** disable public sign-ups in the Supabase dashboard today.
2. **Tenant isolation in role management (SEC-03).** A school admin can grant roles to users in other schools.
3. **Permission codes used as stand-ins for roles (API-06).** Student `fees.view` and teacher `students.manage` silently widened access (SEC-04, SEC-06, SEC-10), exposing parents' contact details and fee data to students.
4. **Registration workflow (SEC-05, SEC-12).** There is no reviewer check, and new accounts are approved by default.

## Affected files and components
- **Database:**
  - `database/migrations/002_rbac_permissions.sql` (trigger)
  - `database/rls_policies.sql` (`users_update_self`)
  - `016_student_management_extras.sql`, `057_teacher_student_management_parity.sql` (grants)
  - `061_registration_approval.sql` (status default)
  - `040` (RLS-less table)
  - the homework bucket migrations
- **Backend:**
  - `middleware/auth.middleware.ts`
  - `services/user.service.ts`, `controllers/user.controller.ts`
  - `routes/fees.routes.ts`, `utils/studentAccess.ts`, `utils/teacherAccess.ts`
  - `routes/registration.routes.ts`, `controllers/registration.controller.ts`, `services/registration.service.ts`
  - `services/announcement.service.ts`, `services/notification.service.ts`
  - `services/push.service.ts`, `validators/push.validator.ts`
  - `utils/defaultPassword.ts`
  - `routes/teacherPortal.routes.ts`, `controllers/auth.controller.ts`
  - `config/env.ts`
  - `services/teacherAttendanceScheduler.ts`, `server.ts`
- **Frontend:**
  - `pages/portal/PortalExamsPage.tsx`, `pages/teacher/TeacherQuestionPapersPage.tsx`
  - `utils/indianRegions.ts`, `utils/importStudents.ts`, `utils/importUsers.ts`
  - `vercel.json`
- **Dependencies:** `xlsx`, `nodemailer`, `vite`, `@tiptap/*`.

## Checks performed
| Check | Result |
|---|---|
| Typecheck (both packages) | PASS |
| Unit tests | backend 104/104, frontend 6/6 PASS (mocked only) |
| Build | PASS (8.4 MB chunk warning) |
| Lint | BROKEN (both packages) |
| npm audit | backend 1 high / 5 moderate; frontend 5 high / 32 moderate |
| SQL replay (PGlite) | 83/83 files apply; role matrix and RLS state extracted |
| Secret scan | no secrets tracked; frontend holds only the anon key |
| Startup | NOT RUN: the in-process schedulers would write to the hosted DB |

## Untested areas and remaining risk
- Everything dynamic: login and session behaviour, every CRUD flow, registration and approval, driver trips and the live map, uploads, exports, concurrency, rate limits, live headers and CORS, UI, accessibility, responsive layout and performance under load.
- The **live Supabase configuration**: whether sign-up is enabled, the email-confirmation setting, the redirect allow-list, the actual table grants, and whether the deployed schema matches the repo. SEC-01 and SEC-02 depend on these.
- Around 300 remaining endpoints, which were reviewed for guards but not for business-logic correctness.
- The order in which duplicate-numbered migrations were actually applied in production.

## Tests still missing from the codebase
- Auth middleware: status, active and school gates; role loading.
- `resolveSchoolId` and every `assert*Access` guard, including cross-school cases.
- A role × endpoint authorization matrix test driven by the effective permission matrix.
- SQL/RLS tests: self-update of protected columns, the signup trigger, bucket policies.
- Route-level integration tests (supertest) against a disposable Supabase project.
- E2E tests (Playwright) for each role's main flows.
- Frontend: XSS rendering of rich content, and the import flows.

## Exact next steps
1. **Today:** in the Supabase dashboard (Auth → Providers → Email), turn off "Allow new users to sign up", unless public sign-up is genuinely needed. Confirm the redirect allow-list.
2. Tell me whether `hffi…supabase.co` is production. Create a **separate** test project and apply the SQL there.
3. Approve the P0 fixes in `07-fix-plan.md` (SEC-01 to SEC-05). I'll implement each as a focused change with a regression test, run the suite, and record results in `08-regression-results.md`.
4. With the test project and synthetic accounts in two schools, I'll dynamically confirm the LIKELY findings and run the functional and UI passes (`/bug-hunt`, `/api-audit`, `/ui-audit`).
5. Fix lint so static checks can gate future changes.

---

# RE-AUDIT ADDENDUM — Round 2 (2026-09-25)

Second full audit pass after remediation. Supersedes the status of the P0 findings above; all other findings from the original report stand unchanged (their code is untouched). Evidence: `00-baseline.md` (Round 2), `08-regression-results.md`, `09-security-reproduction.md` §10–11. Nothing committed yet — `HEAD` still `1252957`.

## Findings by severity (current)
| Severity | Original | Fixed | Still open |
|---|---|---|---|
| CRITICAL | 2 (SEC-01, SEC-02) | **2** | 0 |
| HIGH | 3 (SEC-03, SEC-04, SEC-05) | **3** | 0 |
| MEDIUM | 16 | 4 (SEC-06, SEC-09*, SEC-10*, SEC-24 partial) → **SEC-06 fixed; SEC-24 open** | ~15 |
| LOW | 20 | +1 new (REL-01) | ~21 |
| INFO | 6 | — | 6 |

Precisely: **6 findings fixed and regression-tested** — SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, and SEC-06 (incidental via SEC-04's grant removal). **1 new low finding** introduced by the fix work — REL-01 (provisioning not atomic). Everything else from the original audit remains open.

## Confirmed security issues — current state
- **Closed (verified on staging + automated tests):** SEC-01 (signup privilege escalation — code fixed; production Auth "disable sign-up" still recommended), SEC-02 (self-editing authz columns), SEC-03 (cross-school role assignment), SEC-04 (student fee-roster exposure), SEC-05 (unauthorized registration approval), SEC-06 (cross-student fee read).
- **Still open (unchanged code, still valid):** SEC-07 (school-wide notifications to students), SEC-08 (announcement audience not filtered), SEC-09 (announcement attachment cross-tenant delete/read), SEC-10 (teacher own-class write bypass via `students.manage` short-circuit), SEC-11 (stored XSS in exam/question-paper HTML), SEC-12 (approve-by-default race — partially mitigated by 077's safe default, full atomicity still open, see REL-01), SEC-13 (predictable default passwords), SEC-14 (web-push SSRF / subscription takeover), SEC-15 (PostgREST filter injection in user search), SEC-16 (non-teacher leave requests), SEC-17 (login-history forgery), SEC-18 (auth rate-limit gaps), SEC-19 (email enumeration / no verification), SEC-20 (public homework buckets), SEC-21 (`extracurricular_staff_code_seq` no RLS), SEC-22 (`GET /users/:id/roles` scope — **now fixed as a side effect of SEC-03's `assertUserInSchool` on listUserRoles**), SEC-23 (no CSP/HSTS), SEC-24 (vulnerable deps incl. `xlsx`), SEC-25/26 (info/config).
  - Note: **SEC-22 is now also closed** — `listUserRoles` gained the same `assertUserInSchool` guard.

## Functional bugs — current state
Unchanged from Round 1 (`02-functional-findings.md`): FN-01 (`maybeSingle` on multi-row class_subjects → 500), FN-02 (multi-school admin blocked from assigned-school students), FN-03 (search punctuation 500), FN-04 (`SMTP_SECURE` parsing), FN-05 (scheduler timezone), FN-06 (silent delete success), FN-07 (lint broken — re-confirmed this pass), FN-08 (doc drift), FN-09 (network error reported as 401). None fixed (out of the SEC-01…05 scope).

## Performance issues
Unchanged (`05-performance-findings.md`): PERF-01 (8.4 MB region chunk — re-confirmed via build warning), PERF-02 (auth middleware 4–5 round-trips), PERF-03 (announcement N+1), PERF-04 (in-process schedulers not multi-instance safe), PERF-05 (unbounded trip embed), PERF-06/07.

## Highest-risk areas (now)
1. **Announcement module (SEC-08, SEC-09)** — audience not enforced on read; attachment delete/read not scoped to the announcement/school. Reachable by teachers. This is now the top unremediated cluster.
2. **Stored XSS (SEC-11)** — teacher-authored HTML rendered to students without sanitization; session in localStorage.
3. **Teacher own-class write bypass (SEC-10)** — `students.manage` short-circuit lets any teacher edit/move any student in the school.
4. **Vulnerable `xlsx` parsing uploaded files (SEC-24)**.
5. **Auth-layer performance (PERF-02)** and **scheduler multi-instance safety (PERF-04)** for reliability at scale.

## Files/components affected (open findings)
`services/announcement.service.ts`, `controllers/announcement.controller.ts`; `pages/portal/PortalExamsPage.tsx`, `pages/teacher/TeacherQuestionPapersPage.tsx`, `validators/exam.validator.ts`; `utils/teacherAccess.ts` (`requireStudentWriteAccess`); `utils/importStudents.ts`, `importUsers.ts` (xlsx); `services/push.service.ts`, `validators/push.validator.ts`; `services/notification.service.ts`; `middleware/auth.middleware.ts`; `services/announcementScheduler.ts`, `teacherAttendanceScheduler.ts`; `services/user.service.ts` (search); `frontend/vercel.json` (headers); `utils/indianRegions.ts` (bundle).

## Fixes recommended (next priorities, unremediated)
P1: SEC-10 (staff-only short-circuit), SEC-08/SEC-07 (audience/recipient filtering), SEC-09 (scope attachment ops), SEC-11 (sanitize + CSP), SEC-14 (push allow-list + user scope), SEC-24 (replace xlsx / audit fix). P2: SEC-13, SEC-15/FN-03, SEC-16, SEC-17, SEC-20, SEC-21, SEC-23, FN-01, FN-02, FN-04, FN-05, REL-01, PERF-01/02/04, and restore lint (FN-07).

## Tests still missing
- Auth middleware (status/active/school gates, role loading) — no tests.
- Route-level integration tests (supertest) for the full role×endpoint matrix.
- E2E/browser tests (none exist) — SEC-11 XSS render, import flows, driver trip UI.
- Tests for the still-open findings (announcement audience, teacher write scope, push SSRF).
- The new security suite covers SEC-01…06 only.

## Exact next steps
1. **Deploy the fixes**: apply migrations `077/078/079` to production, and **disable public sign-up** in production Supabase Auth (SEC-01 residual).
2. **Commit** the working-tree changes (currently all uncommitted) so the fixes + tests are preserved.
3. **Rotate the staging DB password** (exposed in-session).
4. Prioritize the P1 cluster above (announcements, XSS, teacher write bypass, xlsx) as the next remediation round.
5. Add integration + E2E test coverage; restore eslint so static analysis gates future changes.
