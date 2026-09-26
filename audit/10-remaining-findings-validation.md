# 10 — Remaining Findings Validation

- **Date:** 2026-09-25. **Commit:** `1252957` (fixes uncommitted). **Target:** staging only (`ruseufindaxkwgajkuev`), backend on `.env.staging`. No production contact, no code modified.
- **Method:** each finding was reproduced against the running staging app with the synthetic accounts where safe, or classified from code/DB/tool evidence where a live attack isn't safe or possible. Every write was synthetic and reverted; end state re-verified clean (2 schools, 17 accounts, 0 probes).
- **Classification:** CONFIRMED (reproduced or proven) · NOT REPRODUCED (couldn't trigger in this env) · FALSE POSITIVE · BLOCKED (needs config/fixtures not available) · FIXED (verified closed).

## Summary table

| ID | Sev | Class | Evidence (this pass) |
|---|---|---|---|
| SEC-06 | MED | **FIXED** | student→another student `/fees/summary` → 403 (grant removed) |
| SEC-22 | LOW | **FIXED** | admin.a `/users/<studentB>/roles` → **404**; same-school → 200 |
| SEC-07 | MED | **CONFIRMED** | student.a `/notifications` returned a notification addressed only to teacher.a (status 200, seeded+reverted) |
| SEC-08 | MED | **CONFIRMED** | teacher-audience announcement created by admin.a was visible in student.a `/announcements` |
| SEC-09 | MED | **CONFIRMED** (authz) / **BLOCKED** (file) | `DELETE /announcements/<random-uuid>` → 200 silent success (no ownership/school scope). Cross-tenant storage-object delete/read not run (needs cross-school attachment fixtures) |
| SEC-10 | MED | **CONFIRMED** | teacher.a `PATCH /students/<student.a>` (not their class) → 200, address changed (reverted) |
| SEC-11 | MED | **CONFIRMED** | XSS payload stored verbatim in `exam_documents.content` and returned to student.a via `/students/:id/question-papers` unsanitized |
| SEC-12 | MED | **CONFIRMED (code)**, partially mitigated | register→provision sets role/school+approved, then `markPending`; window/fail-open persists. 077 makes the trigger default safe. Not runtime-raced |
| SEC-13 | MED | **CONFIRMED** | user created w/o password; logged in with predicted default `Pwtes<phone>` → 200 |
| SEC-14 | MED | **CONFIRMED** | `/push/subscribe` accepted `http://169.254.169.254/...` (201, SSRF sink); re-subscribe with same endpoint by teacher.a took over student.a's row (onConflict) |
| SEC-15 | LOW | **CONFIRMED** | raw `.or()` interpolation; `/users?search=a,b)` → 500 (see FN-03). Injection surface present |
| SEC-16 | LOW | **CONFIRMED** | student.a `POST /teacher-portal/leave-requests` → 201 (reverted) |
| SEC-17 | LOW | **CONFIRMED** | unauthenticated `POST /auth/record-login-attempt` inserted a forged `login_history` row (reverted) |
| SEC-18 | LOW | **CONFIRMED (code)**, not load-tested | `/auth/refresh` has no limiter; real login bypasses the backend limiter (browser→Supabase) |
| SEC-19 | LOW | **CONFIRMED** | register with an existing email → 409 "A user with this email already exists" (enumeration) |
| SEC-20 | LOW | **CONFIRMED** | `homework-attachments` and `homework-submissions` buckets `public=true` |
| SEC-21 | LOW | **CONFIRMED** | `extracurricular_staff_code_seq.relrowsecurity = false` |
| SEC-23 | LOW | **CONFIRMED** | `frontend/vercel.json` has no CSP and no HSTS header |
| SEC-24 | MED | **CONFIRMED** | `npm audit`: backend 1 high (nodemailer) + 5 moderate; frontend 5 high (incl. `xlsx`, no fix) + 32 moderate |
| SEC-25 | INFO | **CONFIRMED** | teacher role holds academic_years/departments/activities/notifications/transport manage (replay matrix) |
| SEC-26 | LOW | **BLOCKED** | `forgot-password` `redirectTo` safety depends on the Supabase redirect allow-list (project config not inspected) |
| FN-01 | MED | **CONFIRMED** | teacher.a with 2 subjects in one class → `/teacher-portal/classes/:id/students` → 500 "multiple (or no) rows returned" (setup reverted) |
| FN-02 | MED | **NOT REPRODUCED** (code-confirmed) | no multi-school admin exists in the test data; guard uses `user.schoolId` not `canTargetSchool` (code) |
| FN-03 | LOW | **CONFIRMED** | `/users?search=a,b)` → 500 |
| FN-04 | LOW | **CONFIRMED** | `z.coerce.boolean()` parses `"false"`→true (config) |
| FN-05 | LOW | **CONFIRMED (code)**, not runtime | scheduler compares local-time HH:MM against a UTC date |
| FN-06 | LOW | **CONFIRMED** | `DELETE /announcements/<random-uuid>` → 200 (same call as SEC-09) |
| FN-07 | LOW | **CONFIRMED** | backend lint `eslint: not found`; frontend `no config` |
| FN-08 | INFO | **CONFIRMED** | README (UTF-16) claims no public signup + lists parent role (removed) |
| FN-09 | LOW | **CONFIRMED** | observed earlier on staging: unreachable Supabase → "Invalid or expired session" (401) |
| PERF-01 | MED | **CONFIRMED** | `country-state-city` chunk = **8.2 MB** in `dist/assets` |
| PERF-02 | MED | **CONFIRMED (code)** | `requireAuth` issues ~5 sequential Supabase round-trips per request |
| PERF-03 | LOW | **CONFIRMED (code)** | per-row count/audience queries in `listAnnouncements` |
| PERF-04 | MED | **CONFIRMED (code)** | in-process `setInterval` schedulers; no atomic claim → duplicate work with >1 instance |
| PERF-05 | LOW | **CONFIRMED (code)** | `myVehicles` embeds all `trips` with no filter/limit |
| PERF-06/07 | LOW | **CONFIRMED** | large lazy chunks; per-request `getSession()` |
| UI-01 | MED | **CONFIRMED** | = SEC-11 (`dangerouslySetInnerHTML`, no sanitizer) |
| UI-02 | LOW | **CONFIRMED** | = PERF-01 (8.2 MB chunk on registration/profile forms) |
| UI-03 | INFO | **CONFIRMED (code)** | `ProtectedRoute` is UX-only (backend enforces) — correct by design |
| UI-04 | INFO | **CONFIRMED (code)** | runtime third-party Google Translate script (`lib/googleTranslate.ts`) |
| UI-05 | INFO | **CONFIRMED (code)** | 401s don't force logout (by design); NOT browser-tested |
| REL-01 | LOW | **CONFIRMED (code)** | `provisionUser` does 4 non-transactional writes; a mid-way failure leaves a partial (but never over-privileged) account |

**Browser-level UI/accessibility (axe, keyboard, responsive, console errors): NOT TESTED** — the Playwright MCP server is disconnected this session; these remain from the original `06-ui-findings.md` (static only).

## Detail — reproductions run this pass

### Fixed (incidentally), re-verified
- **SEC-06** — `student.a GET /students/<studentB>/fees/summary` → 403. Closed by SEC-04's `fees.view` grant removal (the staff shortcut in `assertStudentFeeAccess` no longer applies to students).
- **SEC-22** — `admin.a GET /users/<studentB>/roles` → **404**; `admin.a GET /users/<teacher.a>/roles` → 200. Closed by the `assertUserInSchool` guard added to `listUserRoles` for SEC-03.

### Authorization / data exposure (all CONFIRMED)
- **SEC-07** — seeded a notification with `audience_scope='user'`, `audience_user_id=teacher.a`; `student.a GET /notifications` returned it (the endpoint runs `listForSchool`, which ignores audience). Reverted.
- **SEC-08** — `admin.a` created an `audience_type='teachers'` announcement; it appeared in `student.a GET /announcements` (`listAnnouncements` filters only by school). Reverted.
- **SEC-10** — `teacher.a` (holds `students.manage`) edited `student.a`, who is not in a class teacher.a teaches; `PATCH /students/:id` → 200 and the address changed. The `requireStudentWriteAccess` short-circuit on `students.manage` runs before the own-class check. Reverted.
- **SEC-09 / FN-06** — `admin.a DELETE /announcements/<random-uuid>` → 200 (no such row; the service deletes by id without confirming ownership/school first). The cross-tenant storage-object delete/read described in the finding was not exercised (would need an announcement + attachment seeded in School B); classified BLOCKED for that portion.

### XSS / SSRF / upload
- **SEC-11 (CONFIRMED)** — `admin.a` created an exam (single class) and a `question_paper` document with `content = "<img src=x onerror=alert(document.cookie)>"`. Stored byte-identical in `exam_documents.content`; after publish, `student.a GET /students/:id/question-papers` returned the identical unsanitized string. The frontend renders `content` via `dangerouslySetInnerHTML` (`PortalExamsPage.tsx:150`, `TeacherQuestionPapersPage.tsx:70`), so this is exploitable stored XSS. Exam + docs deleted.
- **SEC-14 (CONFIRMED)** — `POST /push/subscribe` with `endpoint=http://169.254.169.254/latest/meta-data/...` → 201 (only `z.string().url()` validation; the server later POSTs to this URL). Re-subscribing the same endpoint as `teacher.a` reassigned the row's `user_id` (upsert `onConflict: endpoint`) — a subscription takeover. Row deleted.
- **SEC-20 (CONFIRMED)** — `homework-attachments`, `homework-submissions` buckets are public.

### Authentication / session
- **SEC-13 (CONFIRMED)** — created a user via `/users` with no password; the server generated `generateDefaultPassword` = first 5 letters of the name + phone. Logging in with the predicted `Pwtes9000000031` succeeded (200). Probe deleted.
- **SEC-17 (CONFIRMED)** — unauthenticated `POST /auth/record-login-attempt {email, success}` inserted a `login_history` row for an arbitrary email (fire-and-forget; confirmed after a short delay). Row deleted.
- **SEC-19 (CONFIRMED)** — `POST /auth/register/principal` with an existing email → 409 "A user with this email already exists" (account enumeration; provisioning also uses `email_confirm:true`, no ownership proof).
- **SEC-18 (CONFIRMED, code)** — `/auth/refresh` has no rate limiter; the real login runs browser→Supabase, bypassing the backend `authLimiter`. Not load-tested (avoided hammering Auth).
- **SEC-12 (CONFIRMED, code; partially mitigated)** — registration provisions the account (correct role/school, `status` default approved) then calls `markPending`; a failure between the two leaves an approved account. 077 ensures the trigger's own default is safe, but the app-layer window persists — overlaps REL-01.

### Functional
- **FN-01 (CONFIRMED)** — assigned `teacher.a` two subjects in one class (not class teacher); `GET /teacher-portal/classes/:id/students` → 500 (`maybeSingle()` over two `class_subjects` rows → PGRST116). Setup reverted. Affects the teacher-portal/homework/exam class views for any multi-subject teacher.
- **FN-03 (CONFIRMED)** — `/users?search=a,b)` → 500 (raw `.or()` interpolation, SEC-15).
- **FN-02 (NOT REPRODUCED)** — needs a school_admin assigned to 2 schools; none exists in the test data. Code path (`assertStudentAccess` compares `user.schoolId`, not `canTargetSchool`) unchanged → finding stands as code-confirmed.
- **FN-04 (CONFIRMED)** — `z.coerce.boolean()("false") === true`.
- **FN-05 (CONFIRMED, code)** — timezone mismatch in `teacherAttendanceScheduler`; not runtime-tested (time-dependent).
- **FN-07/08/09 (CONFIRMED)** — lint broken; README drift; network-error-as-401 (observed earlier).

### Dependency / configuration
- **SEC-24 (CONFIRMED)** — `npm audit`: backend {high:1, moderate:5}; frontend {high:5, moderate:32}. `xlsx@0.18.5` (high, no fix) parses uploaded files.
- **SEC-21 (CONFIRMED)** — `extracurricular_staff_code_seq` has RLS disabled.
- **SEC-23 (CONFIRMED)** — no CSP/HSTS in `vercel.json`.
- **SEC-26 (BLOCKED)** — depends on Supabase Auth redirect allow-list (not inspected).

### Performance
- **PERF-01 (CONFIRMED)** — 8.2 MB `country-state-city` chunk in `dist/assets`.
- **PERF-02/03/04/05/06/07 (CONFIRMED, code)** — auth-middleware round-trips; announcement N+1; scheduler multi-instance safety; unbounded trip embed; large lazy chunks; per-request session read.

## Cleanup / end state
Every reproduction used synthetic data and was reverted or deleted (announcements, exams+docs, notifications, leave requests, push subscriptions, login_history rows, class_subjects rows, probe users). Final staging: 2 schools, 17 accounts, 0 probe rows across all touched tables. Backend process stopped. No production system contacted; no application code modified.

## Remaining CONFIRMED issues (for the next remediation round)
- **MEDIUM:** SEC-07, SEC-08, SEC-09, SEC-10, SEC-11, SEC-12, SEC-13, SEC-14, SEC-24, FN-01, PERF-01, PERF-02, PERF-04, UI-01.
- **LOW:** SEC-15, SEC-16, SEC-17, SEC-18, SEC-19, SEC-20, SEC-21, SEC-23, FN-02, FN-03, FN-04, FN-05, FN-06, FN-07, FN-09, PERF-03, PERF-05/06/07, REL-01, UI-02.
- **INFO:** SEC-25, FN-08, UI-03, UI-04, UI-05.
- **BLOCKED (needs config/fixtures):** SEC-26; SEC-09 storage-object portion.
- **NOT REPRODUCED (code-confirmed):** FN-02.
- **FIXED (verified):** SEC-01–SEC-06, SEC-22.
- **NOT TESTED:** browser-level UI/accessibility (Playwright MCP unavailable this session).

---

# Post-fix update (2026-09-25)
The authorized batch SEC-07, SEC-08, SEC-09, SEC-10, SEC-11, SEC-13, SEC-14 has been fixed and re-tested against staging (attack now fails, legitimate operation works). See `08-regression-results.md` Round 4 and `07-fix-plan.md` P1. Status changes:

| ID | Was | Now |
|---|---|---|
| SEC-07 | CONFIRMED | **FIXED** (student `/notifications` → 403; `/me` unaffected) |
| SEC-08 | CONFIRMED | **FIXED** (student `/announcements`+`/:id` → 403) |
| SEC-09 | CONFIRMED (authz) / BLOCKED (file) | **FIXED (app-layer authz)**; cross-school storage-object read still BLOCKED for full runtime proof |
| SEC-10 | CONFIRMED | **FIXED** (teacher out-of-class edit → 403) |
| SEC-11 | CONFIRMED | **FIXED** (stored content sanitized on write; sanitized on render) |
| SEC-13 | CONFIRMED | **FIXED** (random credential; old predictable pw rejected) |
| SEC-14 | CONFIRMED | **FIXED** (SSRF allowlist + ownership isolation) |

Remaining CONFIRMED/open (unchanged, not in this batch): SEC-12, SEC-15, SEC-16, SEC-17, SEC-18, SEC-19, SEC-20, SEC-21, SEC-23, SEC-24, SEC-25, FN-01, FN-02(code), FN-03, FN-04, FN-05, FN-06, FN-07, FN-09, PERF-01…07, REL-01, UI-01…05. BLOCKED: SEC-26; SEC-09 storage-object portion. FIXED earlier: SEC-01…06, SEC-22.

---

# Post-fix update 2 (2026-09-26) — SEC-15/16/17/18/19/20/21/23/24
Owner authorized fixing all nine; implemented and re-verified (see `08-regression-results.md` Round 7). Status changes:

| ID | Was | Now |
|---|---|---|
| SEC-15 | CONFIRMED | **FIXED** — search term escaped via `escapeOrFilterValue` (also fixes FN-03) |
| SEC-16 | CONFIRMED | **FIXED** — `requireRole("teacher")` on the teacher-portal router (student → 403) |
| SEC-17 | CONFIRMED | **FIXED** — `record-login-attempt` requires auth, records caller's own verified login only (unauth → 401) |
| SEC-18 | CONFIRMED (code) | **FIXED (code)** — `authLimiter` on `/auth/refresh`; not load-tested |
| SEC-19 | CONFIRMED | **FIXED** — public register returns a generic `{status:"pending"}` for an existing email (no enumeration); admin create still 409 |
| SEC-20 | CONFIRMED | **FIXED** — homework buckets private (migration 081); store path + signed URL on read; cross-school path guard. Public object URL → 400 |
| SEC-21 | CONFIRMED | **FIXED** — RLS enabled on `extracurricular_staff_code_seq` (migration 080); direct client read → 0 rows |
| SEC-23 | CONFIRMED | **FIXED (config)** — CSP + HSTS in `vercel.json`; browser smoke-test recommended before prod |
| SEC-24 | CONFIRMED | **FIXED** — `xlsx` → vendored patched 0.20.3; nodemailer/browserslist/js-yaml via `npm audit fix`. Deferred: `@tiptap/core`, `vite` (breaking majors) |

Still open (unchanged, not in scope): SEC-12, SEC-25, SEC-26 (BLOCKED), FN-01, FN-02, FN-04, FN-05, FN-07, FN-09, PERF-01…07, REL-01, UI-03/04/05. FIXED earlier: SEC-01–11, SEC-13, SEC-14, SEC-22, and now SEC-15–21, SEC-23, SEC-24. (FN-03 fixed incidentally by SEC-15.)

---

# Security regression validation (2026-09-26) — SEC-07/08/09/10/11/13/14
Full re-validation against staging (attack + legitimate + boundary tests); see `audit/11-security-regression.md` for the detailed matrix (SEC-09 storage lifecycle, SEC-11 7 payload classes, SEC-14 12 SSRF vectors). All seven remain **CLOSED**; no exploit reproduced; no new issues; no false positives. Static suite green both packages (lint now passes); targeted security tests 72 (backend) + 8 (frontend) pass. Staging restored to baseline. Items still requiring manual/production verification: SEC-09 live storage RLS review, SEC-23 CSP browser smoke-test, SEC-18 refresh rate-limit load test, SEC-26 redirect allow-list, SEC-01 prod signup setting, FN-09 outage simulation.
