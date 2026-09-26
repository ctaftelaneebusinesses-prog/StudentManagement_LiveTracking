# 00 — Baseline Audit

| | |
|---|---|
| Date | 2026-09-23 (checks run 14:40–14:47 UTC) |
| Commit | `1252957` ("Added login page"), branch `main` |
| Auditor | Claude Code (Opus 5.5) |
| Scope | Repository inspection plus local static checks. **No server was started, no HTTP requests were made, and no database reads or writes happened.** |
| Application code modified | None. The frontend build rewrote the tracked `frontend/tsconfig.tsbuildinfo`, and that change was reverted with `git checkout`. |

---

## 1. Technology stack (verified from manifests and source)

| Layer | Technology | Evidence |
|---|---|---|
| Frontend | Vite 5 + React 19 + TypeScript SPA, Tailwind 3, React Router 6, TanStack Query 5, Zustand 4, React Hook Form + Zod, Axios, Leaflet (maps), TipTap 3 (rich text), Recharts, jsPDF, xlsx, country-state-city | `frontend/package.json` |
| Backend | Node ≥20, Express 4, TypeScript, Zod validation, Pino logging, helmet, cors, compression, express-rate-limit 8, nodemailer 9, web-push | `backend/package.json`, `backend/src/app.ts` |
| Database | Supabase Postgres. There is **no ORM**: every query goes through `@supabase/supabase-js` (PostgREST) | `backend/src/config/supabase.ts` |
| Auth | Supabase Auth (JWT). The browser signs in **directly against Supabase** and the backend checks the bearer JWT on every request | `frontend/src/lib/supabaseClient.ts`, `backend/src/middleware/auth.middleware.ts` |
| File storage | Supabase Storage, 11 buckets (§5) | migrations |
| Real-time | `socket.io` is installed but **not wired up**. Live tracking uses **polling** | `backend/src/server.ts` comment, README §1 |
| Package manager | npm, two separate projects (`backend/`, `frontend/`). The root `package-lock.json` is empty | lockfiles |
| Local runtime | Node v22.23.2, npm 12.0.2 (the Dockerfile targets Node 20) | `node -v` |

## 2. Architecture

```
Browser (Vite/React SPA) ──HTTPS──▶ Express API /api/v1 ──service-role key──▶ Supabase (Postgres/Auth/Storage)
        │                                                                          ▲
        └───────────── anon key + user JWT (login, session refresh, Storage uploads) ┘
```

- **Layering:** `routes/*.routes.ts` (middleware + Zod) → `controllers/` → `services/` (Supabase queries). 35 route files, 51 controllers, about 60 services, 40 validators.
- **Authorization boundary:** the backend uses `supabaseAdmin` (service role, **bypasses RLS**) for nearly every query. RLS is only defence-in-depth, so the real boundary is:
  1. `requireAuth`: verifies the JWT through `supabaseAdmin.auth.getUser`, loads `users`, `user_roles`, `role_permissions` and `school_admin_schools` **on every request**, and blocks pending or rejected accounts, inactive accounts and inactive schools. Super admins skip the activity gates.
  2. `requireRole(...)` / `requirePermission(code)`: permissions are stored in the database.
  3. Row-level guard helpers: `utils/tenant.ts` (`resolveSchoolId`), `schoolAccess.ts`, `teacherAccess.ts`, `studentAccess.ts`, `userAccess.ts`, `extracurricularAccess.ts`, `announcementAccess.ts`, `scopeGuards.ts`.
- **Multi-tenancy:** every school-owned table has a `school_id`. A super_admin, or a school_admin assigned to several schools, can send `?school_id=` on any request. The Axios interceptor adds it automatically, and `resolveSchoolId` is meant to check it against `accessibleSchoolIds`.
- **Background jobs:** two in-process `setInterval` pollers start with the server (§8.1).
- **Deployment:** backend uses a multi-stage Docker build (non-root, healthcheck on `/api/v1/health`) and targets Render, Railway, Fly or similar. The frontend deploys to Vercel (`vercel.json` has an SPA rewrite, `X-Frame-Options: DENY`, `nosniff`, a Referrer-Policy and a Permissions-Policy, but **no CSP and no HSTS**). There is no CI config in the repo.

## 3. User roles

From `backend/src/config/roles.ts` and the README:

| id | role | Frontend portal |
|---|---|---|
| 7 | super_admin | `/dashboard/super-admin/*` (platform tier, multiple schools) |
| 1 | school_admin | `/dashboard/admin/*` |
| 2 | principal | `/dashboard/admin/*` (parity with admin via migrations 027/029) plus "my leave" |
| 3 | teacher | `/dashboard/teacher/*`, plus admin transport pages |
| 5 | student | `/dashboard/portal/*` |
| 6 | driver | `/dashboard/driver` |
| 8 | support_staff | defined, but has no dedicated portal routes |
| 9 | accountant | `/dashboard/accountant/*` |
| 10 | extracurricular_staff | `/dashboard/extracurricular/*` |
| 4 | parent | **removed** by `064_remove_parent_role.sql`. The README still lists it (documentation drift) |

A user can hold several roles through `user_roles`. `ProtectedRoute` gates on any held role, but only for UX.

## 4. API surface

About **412 endpoints** under `/api/v1`, counted by grepping `router.<verb>(`. The full per-file inventory is in `audit/01-architecture.md`, which will be produced in Phase 1.

**Unauthenticated endpoints:**

| Endpoint | Guard |
|---|---|
| `GET /health` | none |
| `POST /auth/login`, `/forgot-password`, `/reset-password`, `/record-login-attempt` | `authLimiter` (20 per 15 min, keyed by IP + email) |
| `POST /auth/refresh` | **no limiter** |
| `GET /auth/register/meta` | none |
| `POST /auth/register/{principal,accountant,driver,extracurricular-staff,teacher,student}` | `authLimiter` |
| `GET /schools/lookup` | none (resolves a school from its code) |

**Largest or most sensitive route groups:** students (50), website-knowledge (31), schools (29), transport (29), exams (20), super-admin (20, `requireRole("super_admin")` plus per-route permission checks), extracurricular portal and staff (37), tracking (13), users (13), fees (16), registration-requests (2).

Global middleware: `helmet`, `cors` (explicit origin list, credentials on), `express.json` capped at 1 MB, pino request logging (redacts `Authorization`), and a global limiter of 3000 requests per 15 min per IP. `trust proxy` is set to `1`.

## 5. Database

- The schema is `database/schema.sql`, then `rls_policies.sql`, then **76 migration files** applied **by hand** in the Supabase SQL editor. There is no migration runner and no down-migrations.
- **Duplicate migration numbers:** 009, 019, 023, 025, 029, 039, 040, 049. `009_attendance_system.sql` is documented as a stray file that must be skipped.
- **86 tables**. RLS is enabled on 85 of them. The exception is `extracurricular_staff_code_seq` (migration 040).
- 19 `SECURITY DEFINER` occurrences need review.
- **Storage buckets:**

| Bucket | Public? |
|---|---|
| avatars, school-logos | public |
| **homework-attachments, homework-submissions** | **public** (student work can be read by anyone who has the URL) |
| announcement-attachments, evaluated-papers, exam-documents, extracurricular-achievements, student-documents, syllabus-documents, teacher-documents | private |

## 6. Integrations

| Integration | Status |
|---|---|
| Supabase (DB, Auth, Storage) | configured. `backend/.env` points at a **hosted Supabase project** (`https://hffi…supabase.co`). **It is not known whether this is production or a dev/staging project** (see §9) |
| SMTP (nodemailer) | not configured locally (no `SMTP_*` in `.env`), so emails are skipped |
| Web Push (VAPID) | configured locally (keys present) |
| Google Translate widget | loads an external script from `translate.google.com` (`frontend/src/lib/googleTranslate.ts`) |
| "AI" homework assistant | rule-based only, no external LLM calls (`backend/src/services/ai.service.ts`) |
| Payments | **none found**. Fees are recorded manually and there is no payment gateway |
| Maps | Leaflet (tile provider to be confirmed in Phase 1) |

## 7. Secrets and configuration hygiene

- `backend/.env` and `frontend/.env` exist, are gitignored and **have never been committed** (`git log --all` on those paths is empty).
- Key roles were checked by decoding the JWT `role` claim without printing any values. `frontend/.env` holds the **anon** key only. `backend/.env` holds the anon and **service_role** keys, as intended.
- Tracked files contain no JWT-shaped strings or `*_KEY=` values (`git grep`).
- `backend/scripts/emergency-export.js` and `emergency-restore.js` dump or upsert **every table** with the service-role key. Running either one is a significant data operation, and **I will not run them**.

## 8. Baseline check results

Commands were run inside each package. Logs are in `audit/evidence/baseline/`.

| Package | Command | Exit | Result |
|---|---|---|---|
| backend | `npm run typecheck` | 0 | ✅ PASS |
| backend | `npm run lint` | 127 | ❌ **BROKEN**: `eslint: not found`. eslint is not in backend devDependencies and there is no config |
| backend | `npm test` | 0 | ✅ 16 files, **104 tests passed** (all unit tests with a mocked Supabase chain) |
| backend | `npm run build` | 0 | ✅ PASS (`dist/`, gitignored) |
| frontend | `npm run typecheck` | 0 | ✅ PASS |
| frontend | `npm run lint` | 2 | ❌ **BROKEN**: "ESLint couldn't find a configuration file" |
| frontend | `npm test` | 0 | ✅ 3 files, **6 tests passed** |
| frontend | `npm run build` | 0 | ✅ PASS, with a warning that chunks exceed 500 kB |
| backend | `npm audit` | – | 6 advisories: **1 high (nodemailer, direct)**, 5 moderate (express, body-parser, qs, vitest) |
| frontend | `npm audit` | – | 37 advisories: **5 high** (`xlsx` direct with **no fix available**, `vite` direct, `@tiptap/core`, `js-yaml`, `browserslist`), 32 moderate (TipTap family, react-router, esbuild, …) |

Largest production chunks:

| Chunk | Size |
|---|---|
| `country-state-city` | **8.37 MB** (used by `utils/indianRegions.ts`) |
| `PortalLearningGamesPage` | 868 KB |
| `index` | 736 KB |
| `xlsx` | 420 KB |
| `jspdf` | 384 KB |
| `RichTextEditor` | 372 KB |

**Test coverage gaps:** there are no tests for the auth middleware, `resolveSchoolId` or tenant isolation, and no route-level or integration tests. There are no E2E tests, and no `playwright` or `cypress` config.

**Not run yet:** application startup, E2E tests, database migrations. See §8.1 and §9.

### 8.1 Why the backend server was NOT started

`server.ts` starts two pollers on boot, and both **write to whatever database `.env` points at**:
- `announcementScheduler`: every 60 s it publishes due scheduled announcements and fans out notifications and web push to real users.
- `teacherAttendanceScheduler`: every 60 s it runs `autoMarkAbsentees`, which inserts "absent" rows for teachers who have not checked in after the cutoff.

`.env` points at a hosted Supabase project of unknown environment, so starting the server could modify real data. **The owner must confirm before it is started (§9).**

## 9. Blockers and decisions needed from the owner

1. **Is `https://hffi….supabase.co` production or a disposable dev/staging project?** Functional, API and authorization testing needs a running backend and test accounts. I will not start the server or send any write requests until this is confirmed. The preferred option is a separate Supabase project loaded with synthetic data.
2. **Test accounts:** at least one synthetic account per role (super_admin, school_admin, principal, teacher, student, driver, accountant, extracurricular_staff), spread across **two schools** so cross-tenant access can be tested.
3. **Permission to run write-path tests** (creating, updating and deleting synthetic records) against that environment.

## 10. Early observations (unverified leads, not findings yet)

These are recorded so the owner knows where testing will focus. Each item gets a proper finding ID, reproduction and severity in its phase file. Statuses follow CLAUDE.md.

| # | Observation | Evidence | Status |
|---|---|---|---|
| L1 | `PATCH /registration-requests/:id` (approve or reject) has **no role or permission check**, only `requireAuth` plus a school scope. Any approved user in the school (for example a student or driver) could approve a pending registration, including a principal self-registration submitted through the public `/auth/register/principal`. Exploiting this requires knowing the request UUID, which the submit endpoint does not return. | `routes/registration.routes.ts:43`, `controllers/registration.controller.ts:87-95`, `services/registration.service.ts:368-422` (compare with `listQueue`, which does check roles and permissions) | **LIKELY** (code evidence, not yet reproduced) |
| L2 | Stored XSS path: exam and question-paper `content` is rendered with `dangerouslySetInnerHTML`, and neither side sanitizes it (no DOMPurify or similar). Teacher-authored HTML is displayed to students. The Supabase session is stored in localStorage. | `frontend/src/pages/portal/PortalExamsPage.tsx:150`, `pages/teacher/TeacherQuestionPapersPage.tsx:70`, `validators/exam.validator.ts:90` | **LIKELY** |
| L3 | `SMTP_SECURE=false` is parsed as `true`, because `z.coerce.boolean()` treats any non-empty string as true. | `config/env.ts:21`. Verified with `node -e`: `"false"=>true` | **CONFIRMED** (config bug, low impact until SMTP is configured) |
| L4 | The `homework-submissions` and `homework-attachments` buckets are public. | migrations | SUSPECTED data-exposure issue. The deployed bucket flags need checking |
| L5 | `extracurricular_staff_code_seq` has no RLS. With Supabase default grants, anon/authenticated users might be able to write to it through PostgREST. | migration 040 | SUSPECTED. Depends on the grants in the live database |
| L6 | The public `POST /auth/record-login-attempt` lets anyone insert forged success or failure login-history rows for any email. | `controllers/auth.controller.ts:33-41` | LIKELY (low severity) |
| L7 | Login is done directly against Supabase from the browser, so the backend `authLimiter` does not protect the real login path. The limiter's IP+email key also allows password spraying across many accounts. `/auth/refresh` has no limiter. | `auth.controller.ts` comment, `rateLimit.middleware.ts` | NOT TESTED |
| L8 | The teacher auto-absent scheduler compares **local-time** HH:MM against a **UTC** date (`toISOString().slice(0,10)`). For an IST school between 00:00 and 05:30 local time, this may mark attendance on the wrong day. | `services/teacherAttendanceScheduler.ts:24-25` | SUSPECTED |
| L9 | `forgot-password` accepts a client-supplied `redirectTo`. This is safe only if the Supabase redirect allow-list is tight. | `validators/auth.validator.ts:23` | NOT TESTED (Supabase configuration) |
| L10 | Every authenticated request makes 4–5 sequential Supabase round-trips in `requireAuth`, with no caching. | `auth.middleware.ts` | Performance observation |
| L11 | The frontend loads an 8.4 MB `country-state-city` chunk. | build output | CONFIRMED (performance) |
| L12 | Lint is broken in both packages, so there is no static-analysis gate. | §8 | CONFIRMED |
| L13 | `xlsx@0.18.5` (high severity, no fix) is used to **parse user-uploaded files** in the student and user import flows. | `utils/importStudents.ts:82`, `importUsers.ts:63` | CONFIRMED vulnerable dependency, exploitability NOT TESTED |
| L14 | `vercel.json` sets no Content-Security-Policy and no HSTS. | `frontend/vercel.json` | CONFIRMED (hardening) |
| L15 | Documentation drift: the README says "no public signup" and lists a parent role, but the code has public self-registration and removed the parent role. The README is saved as UTF-16. | README, migration 064 | CONFIRMED (documentation) |

## 11. Test plan (what happens next)

| Phase | Output file | Approach | Needs a running environment? |
|---|---|---|---|
| 1 Discovery | `01-architecture.md` | Full endpoint → guard → service map, guard-helper review (`resolveSchoolId`, `assert*Access`), `SECURITY DEFINER` and RLS review, bucket policies | No |
| 3 Functional QA | `02-functional-findings.md` | Login, logout and session refresh; the self-registration → approval flow per role; password reset; CRUD for students, teachers, classes, fees, exams, homework and attendance; driver trip start → location → end with the student live view; leave requests; announcements | **Yes** |
| 4 API | `03-api-findings.md` | Per-role access matrix over the 412 endpoints; IDOR tests (a student reading another student's records, a teacher reaching a class they are not assigned to, cross-school `?school_id=` tampering); validation limits; pagination caps; status codes | Static now, dynamic **Yes** |
| 5 Data integrity | inside 03/04 | Constraints, uniqueness, race conditions (duplicate fee payments, attendance double-mark, registration double-approve) | Partly |
| 6 UI | `06-ui-findings.md` | Console errors, responsive layout, accessibility, the XSS sinks, loading and error states (Playwright) | **Yes** (frontend only; could run against a mocked API) |
| 7 Security | `04-security-findings.md` | Confirm or refute L1–L9, OWASP review, CORS, headers, uploads, secrets, dependency advisories | Static now, confirmations **Yes** |
| 8 Performance | `05-performance-findings.md` | Unbounded queries, N+1 in services, auth middleware cost, bundle size | Mostly static |
| 9 Fix plan | `07-fix-plan.md` | Prioritized fixes. **No code changes without owner approval** | No |

All dynamic testing will use synthetic data, and only in the environment the owner approves.

---

# Re-audit — Round 2 (2026-09-25)

Second full `/audit` pass, run after the SEC-01…SEC-05 fixes and their regression tests. `HEAD` is still `1252957` (all work remains **uncommitted** in the working tree). All numbers below are from commands run this pass, not carried over.

## Delta since Round 1
- **Fixed & verified:** SEC-01, SEC-02, SEC-03, SEC-04 (+SEC-06) and SEC-05 — see `09-security-reproduction.md` §10–11 (staging re-attack) and `08-regression-results.md` (Rounds 1–3).
- **New migrations:** `077_signup_trigger_privilege_fix.sql`, `078_protect_user_authorization_columns.sql`, `079_remove_student_fees_view.sql` (85 migrations total now; all idempotent).
- **New backend code:** `utils/provisionUser.ts` (authoritative role/school), `controllers/user.controller.ts` (tenant guard), `services/registration.service.ts` + `controllers/registration.controller.ts` (review authz).
- **New tests:** `security/sec-db-enforcement.test.ts` (PGlite DB-layer), `utils/provisionUser.test.ts`, `utils/scopeGuards.test.ts`, `utils/studentAccess.test.ts`, extended `services/registration.service.test.ts`. Added `@electric-sql/pglite` as a backend **devDependency**.

## Baseline checks (this pass)
| Package | typecheck | lint | tests | build | npm audit |
|---|---|---|---|---|---|
| backend | ✅ PASS | ❌ `eslint: not found` (FN-07) | ✅ **128 passed** (20 files) | ✅ PASS | 6 (1 high nodemailer, 5 moderate) |
| frontend | ✅ PASS | ❌ no config (FN-07) | ✅ 6 passed (3 files) | ✅ PASS (chunk warning) | 37 (5 high incl. `xlsx` no-fix, 32 moderate) |

Test count rose 104 → **128** (+24 security regression tests). Dependency-advisory counts unchanged from Round 1 (SEC-24 still open). Bundle warning unchanged (PERF-01 still open).

## New observation this pass
| ID | Severity | Status | Note |
|---|---|---|---|
| REL-01 | LOW | CONFIRMED (code) | `provisionUser` now performs 4 sequential writes (create auth user → update `users` role/school → delete default `user_roles` → insert intended `user_roles`) with **no transaction and no rollback of the auth user** on a later failure. If a step after `createUser` fails, the account is left as the safe default (student / no school) or with the default membership deleted — orphaned/partial, not privileged. Safe-by-default (never over-privileged), but a reliability gap. Recommend a rollback (`auth.admin.deleteUser`) on failure, or an RPC that does the profile+role write atomically. Overlaps the SEC-12 "provision atomically" hardening. |

## Startup
Not started in this pass. The staging environment (`ruseufindaxkwgajkuev`) remains available and was used for the SEC re-attacks; the schedulers there are harmless. Production Supabase was not contacted.
