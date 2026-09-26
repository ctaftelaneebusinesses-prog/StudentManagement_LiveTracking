# 04 — Security Findings

- **Commit:** `1252957`. Review date: 2026-09-23.
- **Method:**
  - Static code review of the backend routes, controllers, services, guards and migrations.
  - The effective role→permission matrix and RLS state come from **replaying all SQL** (`schema.sql`, `rls_policies.sql`, then 81 migrations, skipping the documented stray `009_attendance_system.sql`) into a local in-memory Postgres (PGlite) with minimal Supabase shims. The replay applies duplicate-numbered migrations in alphabetical order. Script and output: `audit/evidence/db/`.
  - Endpoint→guard inventory: `audit/evidence/api/endpoint-guard-inventory.tsv`.
- **Not done:** no requests were sent to the hosted Supabase project or to a running backend with real data. Everything marked LIKELY is based on code evidence and still needs a dynamic reproduction in an owner-approved test environment (see `07-fix-plan.md`).

Status legend (CLAUDE.md): CONFIRMED / LIKELY / SUSPECTED / NOT TESTED.

---

## Summary

| ID | Severity | Status | Title |
|---|---|---|---|
| SEC-01 | CRITICAL (if public sign-up is on) | LIKELY | Sign-up metadata sets the account's role and school, and the account starts `approved` |
| SEC-02 | CRITICAL | LIKELY | RLS `users_update_self` lets a user rewrite their own `status`, `school_id`, `role_id` and `is_active` |
| SEC-03 | HIGH | CONFIRMED (code) | Cross-tenant role assignment: an admin in School A can grant roles to users in School B |
| SEC-04 | HIGH | LIKELY | Students can read the school-wide fee roster (with parents' names and phones) and payment history |
| SEC-05 | HIGH | LIKELY | Registration approval endpoint has no role or permission check |
| SEC-06 | MEDIUM | LIKELY | Any student can read any other student's fee summary, payments and receipts |
| SEC-07 | MEDIUM | LIKELY | `GET /notifications` returns the whole school's notifications to students |
| SEC-08 | MEDIUM | LIKELY | Announcements are not filtered by audience, so staff-only announcements are readable by all roles |
| SEC-09 | MEDIUM | CONFIRMED (code) | Announcement attachments: cross-tenant file delete and read by ID or path |
| SEC-10 | MEDIUM | CONFIRMED (code) | Teacher own-class restriction on student edits is bypassed (guard short-circuit) |
| SEC-11 | MEDIUM | LIKELY | Stored XSS through exam and question-paper HTML `content` |
| SEC-12 | MEDIUM | LIKELY | Self-registration creates an `approved` account first, then marks it `pending` (race window, fails open) |
| SEC-13 | MEDIUM | CONFIRMED (code) | Predictable default passwords, never forced to change |
| SEC-14 | MEDIUM | CONFIRMED (code) | Web-push `endpoint` accepts any URL (blind SSRF); subscriptions can be taken over or removed by endpoint |
| SEC-15 | LOW | CONFIRMED (code) | PostgREST filter injection in user search |
| SEC-16 | LOW | LIKELY | Any authenticated user can file "teacher" leave requests |
| SEC-17 | LOW | CONFIRMED (code) | Unauthenticated login-history forgery (`/auth/record-login-attempt`) |
| SEC-18 | LOW | NOT TESTED | Authentication rate-limit gaps |
| SEC-19 | LOW | CONFIRMED (code) | Registration reveals which emails exist and never verifies email ownership |
| SEC-20 | LOW | CONFIRMED (replay) | Homework buckets are public |
| SEC-21 | LOW | CONFIRMED (replay) | `extracurricular_staff_code_seq` has RLS disabled |
| SEC-22 | LOW | CONFIRMED (code) | `GET /users/:id/roles` is not school-scoped |
| SEC-23 | LOW | CONFIRMED | Frontend has no CSP and no HSTS |
| SEC-24 | MEDIUM | CONFIRMED (`npm audit`) | Vulnerable dependencies, including `xlsx` parsing uploaded files |
| SEC-25 | INFO | CONFIRMED (replay) | Broad teacher permissions to review as policy |
| SEC-26 | LOW | NOT TESTED | `forgot-password` accepts a client-supplied `redirectTo` |

---

## SEC-01 — Sign-up metadata controls the account's role and school
- **Severity:** CRITICAL, conditional on the Supabase project allowing public sign-up. **Confidence:** High on the code; the project setting was not checked.
- **Where:** `database/migrations/002_rbac_permissions.sql:120-148` (`handle_new_auth_user`), and `users.status` defaulting to `'approved'` (migration 061, confirmed by the replay).
- **Root cause:** the `AFTER INSERT ON auth.users` trigger copies `raw_user_meta_data->>'role_id'` and `->>'school_id'` into `public.users` and `public.user_roles`. `raw_user_meta_data` is **user-controlled**: it is the `options.data` argument of `supabase.auth.signUp()`, which anyone can call with the public anon key shipped in the frontend. New rows default to `status='approved'` and `is_active=true`.
- **Impact:** if sign-up is enabled (Supabase's default) and email confirmation can be completed with an address the attacker owns, the attacker gets an account with any role. That includes `role_id = 7` (super_admin), which reaches every school, or school_admin in any school.
- **Reproduction:** NOT PERFORMED against any live system. To reproduce in a disposable Supabase project: call `signUp` with metadata `{role_id: 7}`, confirm the email, then call `GET /api/v1/auth/me`.
- **Recommended fix:**
  1. Disable public sign-ups in Supabase Auth, since all accounts are created server-side through `auth.admin.createUser`.
  2. Change the trigger to read role and school from `raw_app_meta_data`, which only the service role can set, or to ignore metadata and let the backend insert `user_roles` explicitly.
  3. Default `users.status` to `'pending'` for any row the trigger creates.
- **Regression test:** a SQL test that inserts into `auth.users` with user metadata `role_id=7` and asserts that no super_admin `user_roles` row exists.

## SEC-02 — Users can rewrite their own authorization fields through Supabase REST
- **Severity:** CRITICAL. **Confidence:** High on the policy; exploitability depends on the table grants in the live project.
- **Where:** `database/rls_policies.sql:89-92`:
  ```sql
  create policy users_update_self on public.users for update
    using (id = auth.uid()) with check (id = auth.uid());
  ```
  No migration adds column-level `REVOKE`s or a guard trigger (`grep revoke` finds nothing).
- **Root cause:** the policy limits *which row* a user can update, but not *which columns*. The backend treats `users.status`, `users.is_active` and `users.school_id` as authoritative in `requireAuth` and `resolveSchoolId`.
- **Impact:** with Supabase's default `authenticated` table privileges, any user with a session (including a *pending* self-registrant) could send a PATCH to `/rest/v1/users?id=eq.<self>` using the anon key and their own JWT. They could:
  - set `status='approved'`, which bypasses registration approval;
  - set `is_active=true`, which undoes a deactivation;
  - change `school_id`, which moves their roles and permissions into another tenant, because `resolveSchoolId` returns `users.school_id`.

  Combined with public principal registration (`POST /auth/register/principal` only needs a school code), this could give an internet user principal-level access to a school.
- **Reproduction:** NOT PERFORMED. Verify first in a disposable project; the policy text itself is not in doubt.
- **Recommended fix:**
  1. `REVOKE UPDATE ON public.users FROM authenticated, anon;`, then `GRANT UPDATE (full_name, phone, avatar_url, …) ON public.users TO authenticated;`.
  2. Alternatively, add a `BEFORE UPDATE` trigger that rejects changes to `status`, `is_active`, `school_id` and `role_id` unless the caller is the service role.
- **Regression test:** an RLS test acting as `authenticated` with `sub = user`: updating `status` must fail, and updating `full_name` must succeed.

## SEC-03 — Cross-tenant role assignment
- **Severity:** HIGH. **Confidence:** High.
- **Where:**
  - `backend/src/services/user.service.ts` `assignRole`: upserts `{user_id, role_id, school_id}` with **no check that `user_id` belongs to `schoolId`**.
  - The controller (`user.controller.ts:144-150`) only runs `assertPrincipalMayManageUser` and `assertPrincipalMayAssignRole`, and neither checks school membership.
  - `validators/user.validator.ts:57-63` accepts any `role_id` from 1 to 10.
  - `backend/src/middleware/auth.middleware.ts` loads permissions from **every** `user_roles` row the user has, ignoring each row's `school_id`, and acts on the user's home `users.school_id`.
- **Impact:** a school_admin (or a principal, for non-admin roles) of School A who knows a user ID in School B can call `POST /api/v1/users/<B-user>/roles {"role_id":1}`. The target becomes school_admin **inside School B**, which breaks tenant isolation. The attacker only needs to know the ID of a School B account they control (for example one created through self-registration). School B's admins can't revoke the role, because `revokeRole` is scoped to the caller's school.
- **Reproduction:** code review only. Suggested dynamic test: two synthetic schools, adminA assigns role 1 to studentB, then studentB calls `GET /users` and expects 403 but would get 200.
- **Recommended fix:**
  1. Call `assertUserInSchool(schoolId, userId)` at the start of `assignRole`, `revokeRole` and `listUserRoles`.
  2. In `requireAuth`, only load `user_roles` rows whose `school_id` is null (platform) or is in the user's accessible schools.

## SEC-04 — Students can read the school-wide fee roster and payment history
- **Severity:** HIGH, because it exposes minors' family contact details and financial data to every student. **Confidence:** High on the code and grants; not reproduced dynamically.
- **Evidence:**
  - The replayed permission matrix shows the student role holds `fees.view` (granted in `016_student_management_extras.sql:88-95`).
  - `backend/src/routes/fees.routes.ts:49-61`: `/fees/students`, `/fees/payments`, `/fees/dashboard`, `/fees/analytics`, `/fees/recent-activity`, `/fees/reports/*` and `/fees/structures` are gated **only** by `requirePermission("fees.view")`.
  - The controllers (`fees.controller.ts`) add no role or ownership check.
  - `STUDENT_FEE_SELECT` (`fees.service.ts:782`) returns `father_name, father_phone, mother_name, mother_phone`, class, and balance or status for every student in the school.
- **Impact:** any logged-in student can list every student's parents' names and phone numbers and fee arrears, plus the school's payment history. The `fees.view` grant was meant for "their own records by RLS", but the backend uses the service role and bypasses RLS.
- **Recommended fix:**
  1. Remove `fees.view` from the student role; the student portal already uses `/students/:id/fees/*`.
  2. Or add `requireRole('school_admin','principal','accountant','super_admin')` to the school-wide fee routes.
- **Regression test:** student token → `GET /fees/students` returns 403.

## SEC-05 — Registration approval has no role or permission check
- **Severity:** HIGH. **Confidence:** High on the code.
- **Where:**
  - `routes/registration.routes.ts:43` (`queueRouter.patch("/:id", validate(...), review)`, behind `requireAuth` only).
  - `controllers/registration.controller.ts:87-95` has no check, while `listQueue` above it *does* branch on role and permission.
  - `services/registration.service.ts:368-422` sets `users.status` to approved or rejected.
- **Impact:** any approved user in a school (student, driver, accountant) can approve or reject any pending registration in that school, including principal registrations. The attacker needs the request's UUID, which the submit response doesn't return. That limits exploitation, but it is still a missing function-level authorization check.
- **Recommended fix:** apply the same reviewer resolution as `listQueue`:
  - a teacher may review only requests assigned to them (`assigned_reviewer_id`);
  - `registration.review` covers principal-routed requests;
  - `users.manage` covers admin-routed requests;
  - everyone else gets 403.

## SEC-06 — Any student can read any other student's fee data
- **Severity:** MEDIUM. **Status:** LIKELY.
- **Where:** `utils/studentAccess.ts` `assertStudentFeeAccess` returns early for any `fees.view` holder whose school matches. Because students hold `fees.view` (SEC-04), `GET /students/<other-id>/fees/summary`, `/fees/payments` and `/fees/payments/:id/receipt` succeed for any student ID in the same school.
- **Fix:** the SEC-04 fix. Additionally, make the shortcut require a staff role, not just the permission.

## SEC-07 — School-wide notification feed exposed to students
- **Severity:** MEDIUM. **Status:** LIKELY.
- **Where:** `GET /notifications/` requires only `notifications.view`, which students hold (confirmed by the replay). `notification.controller.ts:55-62` then `notification.service.ts:217-226` return the last 50 notifications for the whole school, **including ones addressed to specific other users** (`audience_user_id`) and their `metadata`. Migration 043 scoped notifications to recipients at the RLS level, but the service-role query bypasses that.
- **Fix:** restrict this endpoint to staff, or filter by recipient the same way `listForStudent` does.

## SEC-08 — Announcements not filtered by audience
- **Severity:** MEDIUM. **Status:** LIKELY.
- **Where:** `announcement.service.ts:~250` `listAnnouncements(schoolId, …)` and `getAnnouncement` filter only by school. `announcements.view` is held by students (replay). Announcements aimed at teachers, principals or specific staff are readable by every role through `GET /announcements`.
- **Fix:** filter by `audience_type` against the caller's roles, class, and user ID (see `announcementAccess.ts`).

## SEC-09 — Announcement attachments: cross-tenant delete and read
- **Severity:** MEDIUM, because it needs another school's UUIDs or storage paths. **Status:** CONFIRMED by code reading.
- **Where** (`backend/src/services/announcement.service.ts`):
  - `deleteAnnouncement` (lines ~567-580) selects attachments **by `announcement_id` only** and removes their storage objects *before* the school-scoped row delete. So `DELETE /announcements/<other-school-id>` deletes the other school's files and then reports success.
  - `updateAnnouncement`'s `remove_attachment_ids` (lines ~531-541) deletes attachment rows and objects by ID with **no announcement or school scope**.
  - `attachments` / `new_attachments.storage_path` are not prefix-validated (other modules do check the prefix). The GET handler then signs a one-hour URL for whatever path is stored, so a caller can read any object in `announcement-attachments` whose path they know.
- **Who:** anyone holding `announcements.manage`, which includes **teachers** (replay).
- **Fix:**
  1. In delete, fetch the announcement with `.eq('school_id', schoolId)` first and return 404 if it's missing.
  2. Scope attachment removal with `.eq('announcement_id', id)`.
  3. Require `storage_path` to start with `${schoolId}/${announcementId}/`.

## SEC-10 — Teacher own-class restriction on student edits is bypassed
- **Severity:** MEDIUM. **Status:** CONFIRMED by code logic, and the replay confirms teachers hold `students.manage`.
- **Where:** `utils/teacherAccess.ts` `requireStudentWriteAccess`:
  ```ts
  if (isStaff(user.roles) || user.permissions.includes("students.manage")) return next();
  ```
  This runs before the teacher branch. Migration 057 granted teachers `students.manage` and explicitly relies on this guard to keep teachers to their own class, and that is not what happens.
- **Impact:** any teacher can create students in any class, and edit any student's personal details in the school through `POST /students` and `PATCH /students/:id`. The check "Only staff can move a student to a different class" (in the teacher branch) never runs, so teachers can also move students between classes through `PATCH /students/:id {class_id}`.
- **Fix:** replace the permission short-circuit with `isStaff(user.roles)` only, or check `students.manage` *and* a non-teacher role.

## SEC-11 — Stored XSS through exam and question-paper content
- **Severity:** MEDIUM. **Status:** LIKELY (no sanitizer anywhere; not executed in a browser).
- **Where:**
  - `backend/src/validators/exam.validator.ts:90` (`content: z.string()`, no sanitizing).
  - Rendered with `dangerouslySetInnerHTML` in `frontend/src/pages/portal/PortalExamsPage.tsx:150` (students) and `frontend/src/pages/teacher/TeacherQuestionPapersPage.tsx:70` (teachers).
  - `marks.manage` (teachers) can write it by calling the API directly, bypassing the TipTap editor.
- **Impact:** script runs in the browser of students and teachers who view the paper. The Supabase session sits in `localStorage` (`persistSession: true`), so session theft is possible.
- **Fix:** sanitize on write (server side, with an allow-list) *and* on render (DOMPurify), and add a CSP (SEC-23).

## SEC-12 — Self-registration is approved-by-default until it gets marked pending
- **Severity:** MEDIUM. **Status:** LIKELY race; the fail-open ordering is CONFIRMED in code.
- **Where:** `services/registration.service.ts` `registerPrincipal` and the other register functions call `userService.createUser` (which inserts `users` and `user_roles` through the trigger, with status defaulting to `'approved'` and a caller-chosen password). Only then does `markPending` run. If `markPending` throws, the account stays approved, with its role, permanently.
- **Fix:** create the row with `status='pending'` atomically (pass the status into provisioning, or default `'pending'`), and roll back the auth user on any later failure.

## SEC-13 — Predictable default passwords
- **Severity:** MEDIUM. **Status:** CONFIRMED by code.
- **Where:** `backend/src/utils/defaultPassword.ts`: first 5 letters of the name + roll number, phone or employee ID. Used for students, teachers, drivers, extracurricular staff, users and registrations whenever no password is given. There is no forced change on first login (no `must_change_password` anywhere).
- **Impact:** classmates or colleagues can guess each other's credentials.
- **Fix:** generate random passwords or send an invite or reset link, and force a password change on first login.

## SEC-14 — Web push: blind SSRF and subscription takeover
- **Severity:** MEDIUM. **Status:** CONFIRMED by code.
- **Where:**
  - `validators/push.validator.ts` accepts any `endpoint` URL.
  - `services/push.service.ts` upserts on `endpoint` (`onConflict: "endpoint"`), which *reassigns* someone else's subscription to the caller.
  - `removeSubscription(endpoint)` deletes by endpoint with no user filter.
  - `webpush.sendNotification` POSTs to the stored URL, so the server makes requests to attacker-chosen hosts, including internal addresses.
- **Fix:**
  1. Allow-list push-service hosts (FCM, Mozilla autopush, Apple, WNS) and require `https:`.
  2. Scope upsert and delete by `user_id`.

## SEC-15 — PostgREST filter injection in user search
- **Severity:** LOW. **Status:** CONFIRMED by code.
- **Where:** `backend/src/services/user.service.ts:28` interpolates the raw `search` into `.or(...)`. Every other module uses `escapeOrFilterValue`.
- **Impact:** the `school_id` filter is ANDed separately, so the scope stays within the school, but callers can add filter clauses (a boolean oracle over `users` columns). A search containing `,` or `)` breaks the query and returns 500 (see FN-03).
- **Fix:** use `escapeOrFilterValue`.

## SEC-16 — Non-teachers can file "teacher" leave requests
- **Severity:** LOW. **Status:** LIKELY.
- **Where:** `/teacher-portal/*` has no role guard (inventory). `applyForLeave` inserts with `applicant_role: "teacher"`, and `leave_requests.teacher_id` references `users(id)` since migration 034, so there is no foreign key keeping non-teachers out.
- **Impact:** a student or driver can create leave requests and trigger notifications to principals and admins.
- **Fix:** add `requireRole("teacher")` to the teacher-portal router, keeping any shared endpoints separate.

## SEC-17 — Login-history forgery
- **Severity:** LOW. **Status:** CONFIRMED by code.
- **Where:** `POST /auth/record-login-attempt` is public (`auth.controller.ts:33-41`) and writes a success or failure entry for any email. This makes the admin login-history screen untrustworthy.
- **Fix:** record successful logins server-side from `requireAuth` or `/auth/me`, and use a verified signal for failures.

## SEC-18 — Authentication rate-limit gaps
- **Severity:** LOW. **Status:** NOT TESTED dynamically.
- **Details:**
  - The real login goes straight from the browser to Supabase, so the backend `authLimiter` doesn't protect it.
  - The limiter key is IP + email, so password spraying across many accounts from one IP is capped only by the global limit (3000 per 15 minutes).
  - `/auth/refresh` has no limiter.
- **Fix:** rely on Supabase's rate limits and review them, add a per-IP ceiling, and put a limiter on `/auth/refresh`.

## SEC-19 — Registration reveals existing emails; no email verification
- **Severity:** LOW. **Status:** CONFIRMED by code.
- **Details:** `provisionUser` uses `email_confirm: true`, so self-registrants never prove they own the email address. The public register endpoints return `409 "A user with this email already exists"`.

## SEC-20 — Public homework buckets
- **Severity:** LOW. **Status:** CONFIRMED by the replay.
- **Details:** `homework-attachments` and `homework-submissions` are `public = true` (`homework_submissions_read_public` policy). Anyone with the URL can read student submissions.
- **Fix:** make them private and serve signed URLs.

## SEC-21 — `extracurricular_staff_code_seq` has RLS disabled
- **Severity:** LOW. **Status:** CONFIRMED by the replay.
- **Details:** the only public table without RLS. With default grants, `anon` and `authenticated` could read or modify staff-code counters.
- **Fix:** enable RLS with no policies, or revoke table privileges.

## SEC-22 — `GET /users/:id/roles` is not school-scoped
- **Severity:** LOW. `listUserRoles(req.params.id)` doesn't check the school, so any `users.view` holder can read the roles of a user in another school.

## SEC-23 — No CSP or HSTS on the frontend
- **Severity:** LOW. `frontend/vercel.json` sets `nosniff`, `DENY`, a Referrer-Policy and a Permissions-Policy, but no `Content-Security-Policy` and no `Strict-Transport-Security`. The app also loads Google Translate script from a third party.

## SEC-24 — Vulnerable dependencies
- **Severity:** MEDIUM. **Status:** CONFIRMED by `npm audit` (see 00-baseline §8).
- **Details:**
  - `xlsx@0.18.5` (high, no npm fix) parses **user-uploaded** spreadsheets in `utils/importStudents.ts` and `importUsers.ts`, which exposes prototype-pollution and ReDoS advisories.
  - `nodemailer` (high, backend) and `vite` (high, dev server) also have advisories.
- **Fix:** move to the SheetJS CDN build (0.20.x) or another parser, and run `npm audit fix` for the rest.

## SEC-25 — Teacher permission breadth (policy review)
- **Severity:** INFO.
- **Details:** the replayed matrix gives teachers `academic_years.manage` (including `set-current`, which is school-wide), `departments.manage`, `activities.manage`, `notifications.manage` (school-wide `POST /notifications`), `students.manage` and `transport.manage`. Transport management is intentional (migration 051). The owner should confirm the others are intended, because migration 057's own header says org-wide administration is excluded.

## SEC-26 — `forgot-password` redirect
- **Severity:** LOW. **Status:** NOT TESTED.
- **Details:** `redirectTo` comes from the client (`validators/auth.validator.ts:23`). It is safe only if Supabase's redirect allow-list is tight. Check Auth → URL Configuration.

---

## Areas reviewed with no issue found
- `resolveSchoolId`: tenant resolution logic is sound; non-admins' `school_id` is ignored.
- Driver trip ownership: `recordLocation`, `endTrip` and `markStudentStatus` all filter by `driver_id`.
- `/students/:id/*` reads all call `assertStudentAccess` (checked across 35 handlers).
- Storage prefix checks in the student, teacher, exam, syllabus, evaluated-paper and extracurricular document services.
- Super-admin router: `requireRole("super_admin")` plus per-route permission checks.
- Secrets are not in git, and the frontend has only the anon key (00-baseline §7).
- The error handler doesn't leak stack traces, and `Authorization` is redacted in logs.
