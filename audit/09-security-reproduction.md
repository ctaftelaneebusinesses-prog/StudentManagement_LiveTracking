# 09 — Security Reproduction Record (SEC-01 to SEC-05)

- **Date:** 2026-09-23. **Commit:** `1252957`. No application code was changed.

## 1. Environment determination

| Check | Result | Evidence |
|---|---|---|
| Databases configured in the repo | Only the hosted project `hffi…supabase.co` (`backend/.env`, `frontend/.env`) | 00-baseline §6–7 |
| Is that project disposable? | **Unknown.** The owner says it may be production | owner instruction |
| Any staging `.env` or `supabase/config.toml` | None | `ls supabase` → missing; no `config.toml` |
| Local Supabase stack possible? | **No.** Docker daemon is not accessible to user `prajith` (not in the `docker` group), and the Supabase CLI isn't installed | `docker info` → permission denied |
| Plain Postgres substitute? | Not sufficient: the backend needs GoTrue and PostgREST | STAGING-SETUP §1 |

**Decision:** there is no disposable database target, so **the backend and frontend were NOT started**. Validation steps A–F and the E2E part of H are **BLOCKED BY ENVIRONMENT**. Nothing was sent to `hffi…`.

**Verified safety mechanisms for later use:**
- `DOTENV_CONFIG_PATH` with dotenv 16.6.1 loads only the named file. A probe run confirmed `backend/.env` was not read (`SUPABASE_URL` stayed unset).
- `unshare -rn` gives a working no-network namespace: `curl https://example.com` → "Could not resolve host".

## 2. Validation sequence

| Step | Status | Notes |
|---|---|---|
| A. Authentication tests | BLOCKED BY ENVIRONMENT | needs GoTrue and API |
| B. Authorization tests | BLOCKED BY ENVIRONMENT | |
| C. Cross-school isolation | BLOCKED BY ENVIRONMENT | |
| D. Registration / approval | BLOCKED BY ENVIRONMENT | |
| E. Fee-data access | BLOCKED BY ENVIRONMENT | |
| F. API permission tests | BLOCKED BY ENVIRONMENT | |
| G. Existing automated tests | **RUN, PASS** | see below |
| H. Frontend / E2E | Unit: **PASS**. E2E: BLOCKED | no E2E suite exists; would need staging |

**G/H evidence.** Both suites ran inside `unshare -rn` (no network), with every Supabase and API URL overridden to `http://127.0.0.1:9`:
- Backend: `npx vitest run` → **16 files, 104 tests passed** (2026-09-23T17:16:13Z–17:16:24Z).
- Frontend: `npx vitest run` → **3 files, 6 tests passed** (17:16:24Z–17:16:53Z).
- Logs: `audit/evidence/staging-validation/{backend,frontend}-tests-isolated.log`.
- 15 of 16 backend test files mock `config/supabase`; `leaveDate.test.ts` is pure.

**Relevance to SEC-01 to SEC-05:** **none of the existing tests exercise these findings.** There are no tests for the auth middleware, `assignRole`, the fee route guards, registration `review`, or database policies. Passing suites say nothing about these issues.

## 3. Classification

| ID | Dynamic classification | Static evidence already on record |
|---|---|---|
| SEC-01 | **BLOCKED BY ENVIRONMENT** | Trigger reads `raw_user_meta_data` role and school (`migrations/002_rbac_permissions.sql:120-148`); `users.status` default `'approved'` (replay). Depends on the production Auth sign-up setting (unknown) |
| SEC-02 | **BLOCKED BY ENVIRONMENT** | `users_update_self` has no column restriction (`rls_policies.sql:89-92`); no REVOKEs in the repo. Depends on the live table grants (unknown) |
| SEC-03 | **BLOCKED BY ENVIRONMENT** | `assignRole` has no membership check (`services/user.service.ts`); the middleware loads all `user_roles` rows |
| SEC-04 | **BLOCKED BY ENVIRONMENT** | Student holds `fees.view` (replay); `/fees/*` reads are gated only by that permission (`routes/fees.routes.ts:49-61`) |
| SEC-05 | **BLOCKED BY ENVIRONMENT** | `review` has no role or permission check (`controllers/registration.controller.ts:87-95`) |

None are classified FALSE POSITIVE. Nothing learned in this session contradicts the code evidence. All five **still need dynamic testing** once staging exists.

## 4. Verification procedures (staging only, after STAGING-SETUP §6 preflight)
These are written as verification test cases. **Expected** is the secure behaviour. A different result confirms the finding. Record status code, response body (with synthetic data only) and timestamp for each step in `audit/evidence/staging-validation/`.

### SEC-01 — Role or school from signup metadata
- **Precondition:** staging Auth settings mirror production.
- **Steps:**
  1. Using the staging anon key only, perform a standard email sign-up for a new synthetic address, supplying a role and school in the sign-up metadata.
  2. Complete email confirmation if required.
- **Inspect (staging SQL editor):** that user's `users.role_id`, `users.status` and `user_roles` rows. Also check whether `GET /api/v1/auth/me` with that user's token shows elevated roles.
- **Expected (secure):** either sign-up is rejected, or the account gets no role from metadata and is not `approved`.
- **Decision rule:**
  - If the production project has sign-ups disabled, SEC-01 is not currently exploitable there; the finding stays as hardening.
  - Otherwise, classify from the result.

### SEC-02 — Self-update of authorization fields
- **Precondition:** a synthetic **pending** registrant (from the SEC-05 set) with a session.
- **Step:** as that user, using the staging anon key and their own session, attempt a direct REST update of their own `users` row, changing only `status`.
- **Expected (secure):** rejected (permission denied, or 0 rows updated); `users.status` still `pending`.
- **Repeat** separately for `school_id` and `is_active`. Also confirm a benign column (`phone`) *can* be updated, as a control.

### SEC-03 — Cross-school role assignment
- **Steps:**
  1. As school_admin A: `POST /api/v1/users/<studentB1-id>/roles` with body `{"role_id": 9}`. Use the accountant role as the least-privileged meaningful probe.
  2. Then, as student B1: `GET /api/v1/auth/me`.
- **Expected (secure):** step 1 returns 403 or 404; no new `user_roles` row for student B1; student B1's permissions are unchanged.
- **Cleanup:** delete the created `user_roles` row in staging.

### SEC-04 — School-wide fee data as a student
- **Steps:** as student A1:
  - `GET /api/v1/fees/students`
  - `GET /api/v1/fees/payments`
  - `GET /api/v1/fees/dashboard`
- **Expected (secure):** 403 for each. A confirmed result would return a roster containing student A2 and the synthetic parent contact fields.
- **Also (SEC-06):** as student A1, `GET /api/v1/students/<A2-id>/fees/summary` should return 403.

### SEC-05 — Registration approval by an unauthorized user
- **Precondition:** a pending, admin-routed (principal) registration in School A; obtain its ID from the staging `registration_requests` table.
- **Step:** as student A1 (or driver A), `PATCH /api/v1/registration-requests/<id>` with body `{"action":"reject"}`. Reject is used so a positive result doesn't grant access.
- **Expected (secure):** 403; the request stays `pending`.
- **Controls:** principal A can review it; the assigned class teacher can review only student requests assigned to them.
- **Cleanup:** reset the request to `pending` in staging.

## 5. Other observation (this session)
- **INFO:** the frontend enables a client-side demo login whenever `import.meta.env.DEV` or `VITE_DEMO_MODE=true` (`frontend/src/services/auth.service.ts:34-51`, default demo password in code). It never reaches production builds unless `VITE_DEMO_MODE` is set, and the backend rejects demo sessions. Recommendation: keep `VITE_DEMO_MODE` unset in Vercel.

## 6. Staging readiness check (2026-09-24)
| Check | Result |
|---|---|
| `backend/.env.staging` URL ref vs key `ref` claims | ✅ all `ruseufindaxkwgajkuev`; anon = `anon`, service = `service_role`; not the production ref |
| `frontend/.env.staging` | ❌ `VITE_SUPABASE_URL` is `reusefind…` (typo; public DNS returns NXDOMAIN), but its anon key is for `ruseufind…` |
| Reaching staging from this machine | ❌ **BLOCKED**: local DNS resolves every `*.supabase.co` name to `106.51.255.28` (connection times out). Public DNS (Cloudflare DoH) returns Supabase's Cloudflare IPs `104.18.38.10`, `172.64.149.246`. This is an ISP-level block; `supabase.com` itself is reachable. I did not bypass it (a direct-IP attempt was denied by the tool policy) |
| Backend boot with `DOTENV_CONFIG_PATH=.env.staging`, no network (`unshare -rn`) | ✅ boots; `GET /health` 200; no-token `/users` → 401; HSTS, nosniff, X-Frame-Options and RateLimit-Policy present; disallowed Origin gets no `Access-Control-Allow-Origin` header. Log: `evidence/staging-validation/backend-offline-boot.log` |
| New observation (LOW) | unknown routes return **401 instead of 404** (`GET /api/v1/nope`): `classRoutes` and `rbacRoutes` are mounted at `/` with `router.use(requireAuth)`, so every unmatched path hits auth before `notFoundHandler` |
| Schema applied to staging? | NOT CHECKED (unreachable) |

## 7. Staging re-check (2026-09-24, after network change)
| Check | Result |
|---|---|
| Reachability of `ruseufindaxkwgajkuev.supabase.co` | ✅ `auth/v1/health` → 200 (normal DNS; no workaround used) |
| Auth settings (staging) | sign-up **enabled** (`disable_signup=false`), email confirmation **on** (`mailer_autoconfirm=false`), email provider on. These are Supabase defaults. Production values are still unknown and should be mirrored |
| Database contents | ✅ **empty / disposable**: `schools`, `users`, `roles`, `role_permissions`, `registration_requests` → 404 PGRST205 (tables don't exist); 0 auth users |
| Schema / migrations applied | ❌ not yet |
| `frontend/.env.staging` URL | ❌ still `reusefind…` (typo) |

## 8. Staging schema applied (2026-09-24)
- **Connection:** the direct DB host is IPv6-only (no A record) and this machine has no IPv6 route, so the session pooler (IPv4, `aws-0-ap-northeast-2`) was used. The URL is in the gitignored `backend/.env.staging` as `STAGING_DB_URL`.
- **Preflight** (read-only, before any write): target ref `ruseufindaxkwgajkuev` ✔; Postgres 17.6; 0 public tables, 0 auth users, 0 buckets ✔ (empty, disposable).
- **Applied:** `schema.sql`, `rls_policies.sql`, then 81 migrations in name order, skipping `009_attendance_system.sql`. **83/83 OK**, no errors. Log: `evidence/staging-validation/staging-migrations.log`.
- **Verification** (`evidence/staging-validation/staging-schema-verify.log`):
  - 84 public tables; RLS off only on `extracurricular_staff_code_seq` (matches SEC-21).
  - Role→permission matrix **identical** to the local PGlite replay, so the grants behind SEC-04, SEC-06, SEC-10 and SEC-25 are present on a real Supabase instance.
  - Buckets match (4 public); `users.status` default `'approved'` (SEC-01/SEC-12).
  - 0 users, 0 schools. Test data is not seeded yet.

## 9. Synthetic test data in staging (verified read-only, 2026-09-24)
- Created by the owner through the app UI: super_admin, school admins, single-entry forms, and bulk import (School B users and students). No passwords are recorded here; they are in the gitignored `audit/test-data/accounts.local.md`.
- **Schools:**
  - School A: code `SCHOOLNS9O`, id `2e379540-c487-40f8-9c55-d01ef7a2a1d5`.
  - School B: code `SCHOOL5EM0`, id `7ec971a2-1093-4fef-9731-2fd78538abfb`.
  - Each has a current 2026-2027 academic year.
- **Accounts:** 17 in total, all `@sms-staging.test`, all `approved`, active and email-confirmed, each holding exactly one role.
  - Platform: `superadmin`.
  - Per school (`.a` → School A, `.b` → School B): `admin`, `principal`, `teacher`, `student`, `driver`, `support`, `accountant`, `ecstaff`, covering school_admin, principal, teacher, student, driver, support_staff, accountant and extracurricular_staff.
- **Students:** `STG-S-A1` (School A, class "Class 1-Section A") and `STG-S-B1` (School B, class 1-A).
- **Email confirmation:** not required. Accounts created through the app use `email_confirm: true`, and no email was sent (SMTP unset).
- **Not yet created** (needed for some tests): fee structures and payments, a teacher with 2 subjects in one class (FN-01), pending registration requests (SEC-05), and announcements or notifications with specific audiences.

---

# 10. RUNTIME REPRODUCTION RESULTS (staging, 2026-09-24)

- **Target:** staging only — `https://ruseufindaxkwgajkuev.supabase.co` (verified: URL contains the staging ref, not `hffi`). Backend running locally with `DOTENV_CONFIG_PATH=.env.staging`.
- **Method:** logins via the Supabase password-grant endpoint using the anon key (same path the browser uses); backend calls to `http://127.0.0.1:4000/api/v1`; direct-to-PostgREST calls to `/rest/v1` with anon key + user JWT. Read-only DB verification and all cleanup via the service role. No production access. No application code changed. Tokens/passwords were never printed. Every write was reverted or deleted; end-state re-verified.
- **Accounts:** synthetic `@sms-staging.test` only (School A = `2e379540-…a1d5`, School B = `7ec971a2-…abfb`).

## Revised classification

| ID | Classification | One-line result |
|---|---|---|
| SEC-01 | **CONFIRMED** (mechanism); public reach **BLOCKED** on this staging config | `raw_user_meta_data.role_id=7` → account provisioned as `super_admin`, `status=approved` |
| SEC-02 | **CONFIRMED** | A student rewrote their own `is_active`, `status`, and `school_id` via PostgREST |
| SEC-03 | **CONFIRMED** | School A admin granted `accountant` to a School B student; target gained `fees.manage` |
| SEC-04 | **CONFIRMED** | A student read the whole school's fee roster, payments and dashboard |
| SEC-05 | **CONFIRMED** | A student rejected a genuine pending principal registration |

Cross-school isolation on **reads** — **correctly enforced** (see below): every cross-tenant read returned 403/404.

---

## SEC-01 — Signup metadata controls role/school — CONFIRMED (mechanism)
- **Account:** service-role create of a throwaway user carrying attacker-style metadata (see note on reachability).
- **Action:** create an auth user with `raw_user_meta_data = {role_id: 7, school_id: <School B>}`. GoTrue writes both public-signup `options.data` and admin `user_metadata` into the **same** `raw_user_meta_data` column that the `handle_new_auth_user` trigger reads.
- **Expected (secure):** role/school not taken from client metadata; account not auto-approved.
- **Actual:** trigger wrote `public.users {role_id:7, status:"approved", is_active:true, school_id:"…B"}` and `user_roles = super_admin`.
- **Evidence:** `t-sec01b.cjs` output — `trigger wrote public.users: {"role_id":7,"status":"approved",...}`, `user_roles: super_admin`. Probe deleted (`public.users remaining: 0`).
- **Public-reachability note (BLOCKED here):** the unauthenticated `/auth/v1/signup` path could not be completed on staging — `@sms-staging.test` is rejected (`email_address_invalid`), and a real domain returns `over_email_send_rate_limit` (429) and would send a real confirmation email (disallowed). Staging currently has `disable_signup=false`, `mailer_autoconfirm=false`. **End-to-end exploitation by an anonymous user depends on the production Auth config** (whether sign-up is enabled and whether the attacker can confirm an email). The trigger flaw itself is confirmed.
- **Impact:** if public sign-up is enabled in production, an anonymous user who can confirm any email could self-provision `super_admin` (all schools) or any role in any school. **Mitigation available now:** disable public sign-ups in the production Auth settings.

## SEC-02 — User rewrites own authorization fields — CONFIRMED
- **Account/School:** `student.a@sms-staging.test`, School A.
- **Action:** `PATCH /rest/v1/users?id=eq.<self>` (anon key + own JWT), one field at a time.
- **Expected (secure):** update of `status` / `is_active` / `school_id` rejected (0 rows / permission denied).
- **Actual:** each returned **200 with the changed value** — `is_active=false`, `status="rejected"`, and `school_id` moved to **School B**. A `full_name` control also succeeded. All values reverted to the originals afterward (re-read confirms `status=approved, is_active=true, school_id=A, full_name="Student"`).
- **Other-user vector:** `student.a` PATCH of `teacher.a`'s row → **200 rowsChanged=0** (RLS row scope holds; only *own* row is writable).
- **Evidence:** `t-sec02.cjs` output.
- **Impact:** a pending/deactivated user can self-approve, re-activate, or move their own `school_id` into another tenant. `school_id` drives `resolveSchoolId`, so this is a self-service tenant switch. Root cause: `users_update_self` restricts the row but not the columns, and `UPDATE` is granted to `authenticated` on all columns.

## SEC-03 — Cross-school role assignment — CONFIRMED
- **Accounts/Schools:** actor `admin.a` (School A school_admin); target `student.b` (School B student).
- **Action:** `POST /api/v1/users/<student.b>/roles {"role_id":9}` (accountant).
- **Expected (secure):** 403/404 (target is in another school).
- **Actual:** **201**; `student.b`'s roles became `["student","accountant"]` and their permission set gained `fees.manage` (confirmed via `student.b`'s own `/auth/me`).
- **Evidence:** `t-sec03.cjs` output. Cleanup deleted the injected row; `student.b` roles back to `student`.
- **Impact:** an admin of one school can grant roles to users in any other school (target user id is the only prerequisite), breaking tenant isolation on the **write** side. `requireAuth` also loads permissions from every `user_roles` row regardless of its `school_id`.

## SEC-04 — School-wide fee data readable by a student — CONFIRMED
- **Account/School:** `student.a@sms-staging.test`, School A.
- **Action:** `GET /api/v1/fees/students`, `/fees/payments`, `/fees/dashboard`.
- **Expected (secure):** 403.
- **Actual:** **200** for all three. `/fees/students` returned the school roster; fields exposed to the student include `admissionNo, name, className, parentName, parentContact, contactNumber, due, paid, balance, status`.
- **Evidence:** `t-read.cjs` + field dump. (`/fees/payments` was empty only because no payments are seeded; the endpoint authorized the student.)
- **Impact:** any student can read every student's guardian name and contact number and fee balances school-wide. Root cause: the student role holds `fees.view`, and the school-wide fee routes gate on that permission only.

## SEC-05 — Unauthorized registration approval — CONFIRMED
- **Account/School:** `student.a@sms-staging.test`, School A (no `registration.review`, no `users.manage`, not a teacher).
- **Setup:** one synthetic pending **principal** registration created in School A (reviewer_type `admin`).
- **Action:** `PATCH /api/v1/registration-requests/<id> {"action":"reject"}`.
- **Expected (secure):** 403.
- **Actual:** **200**; the pending user's `status` and the request's `status` both became `rejected`, with `reviewed_by` set to the student. A random request id returned **404 (not 403)**, showing there is no role gate before the record lookup.
- **Evidence:** `t-sec05.cjs` output. Cleanup deleted the probe user and its request (0 remaining).
- **Impact:** any approved user in a school can approve or reject that school's pending registrations (including principal/admin registrations), given the request id. Missing function-level authorization.

---

## Cross-school isolation — READ paths (verified secure)
| Actor | Action | Result |
|---|---|---|
| `student.a` | `GET /students/<student.b>` | **403** |
| `student.a` | `GET /students/<student.b>/fees/summary` | **403** |
| `teacher.a` | `GET /students/<student.b>` | **403** |
| `admin.a` | `GET /users/<student.b>` (own-school scope) | **404** |
| `admin.a` | `GET /users/<student.b>?school_id=<B>` | **403** ("You do not have access to this school") |
| `admin.a` | `GET /users?school_id=<B>` | **403** |

`resolveSchoolId` correctly rejects cross-tenant `school_id` and scopes reads to the caller's own school. The isolation gap is on the **write/RBAC** side (SEC-02, SEC-03), not these read paths.

## Cleanup / end state
All writes were synthetic and reverted: SEC-02 fields restored; SEC-03 injected role deleted; SEC-01 and SEC-05 probe users deleted (cascade). Re-verification queries returned the original 17-account / 2-school baseline. No production system was contacted. No application code was modified.

---

# 11. POST-FIX VERIFICATION (staging, 2026-09-25)

Fixes for SEC-01…SEC-05 were implemented, rebuilt, applied to staging, and re-reproduced. Migrations `077`/`078`/`079` applied via the session pooler; backend rebuilt (`tsc -p`) and restarted on `.env.staging`. Unit suite: 108 passed. Every probe was cleaned up; staging restored to the 2-school / 17-account baseline. No production access.

## SEC-01 — signup privilege escalation — STATUS: FIXED
- **BEFORE:** `handle_new_auth_user()` copied `role_id`/`school_id` from `raw_user_meta_data` (client-controlled at signup) and accounts defaulted to `status=approved` → a signup could self-provision `super_admin`/any role/any school.
- **FIX:** migration `077` — the trigger no longer reads client metadata for privileged fields; every new auth user gets the safe default (role `student`, no school). `backend/src/utils/provisionUser.ts` now assigns the intended role/school **authoritatively via the service role** after creation (and replaces the default membership). (GoTrue applies admin `app_metadata` after the INSERT, so an app_metadata-reading trigger is not reliable — the server-side write is the robust mechanism.)
- **AFTER (staging):** creating a user carrying metadata `role_id:7` → trigger wrote `role_id=5 (student), school_id=null, user_roles=student`. Legitimate `POST /auth/register/principal` → `role_id=2 (principal)`, School A, `status=pending`, `roles=principal`. So the injection is blocked and the real registration workflow still assigns the correct role.
- **PRODUCTION DEPENDENCY (documented):** this closes metadata injection. Whether an anonymous user can create *any* account still depends on the production Auth setting **"Allow new users to sign up."** This app never uses public GoTrue signup, so that setting should be **disabled** in production. Staging currently has it enabled (`disable_signup=false`).

## SEC-02 — user authorization-field modification — STATUS: FIXED
- **BEFORE:** a student rewrote their own `is_active`, `status`, and `school_id` via PostgREST (anon key + own JWT); `users_update_self` restricted the row but not the columns.
- **FIX:** migration `078` — `BEFORE UPDATE` trigger `enforce_users_privileged_columns` raises `42501` if a client role (`authenticated`/`anon`) changes `role_id`, `status`, `is_active`, or `school_id`. Service-role (backend) and migration roles are unaffected. Enforced database-side.
- **AFTER (staging):** student self-PATCH of `is_active` / `status` / `school_id` → **403 `42501`**, 0 rows changed. Control: `full_name` self-edit still **200**. Other-user PATCH still 0 rows. Legitimate admin operations (which use the service role) unaffected.

## SEC-03 — cross-school role assignment — STATUS: FIXED
- **BEFORE:** `admin.a` (School A) granted `accountant` to `student.b` (School B) → 201; target gained `fees.manage`.
- **FIX:** `backend/src/controllers/user.controller.ts` — `assignRole`, `revokeRole`, and `listUserRoles` now call `assertUserInSchool(resolveSchoolId(req), targetId)` before acting. Server-side tenant boundary; not reliant on frontend.
- **AFTER (staging):** `admin.a` POST role to `student.b` → **404 "User not found"** (target not in caller's school); `student.b` roles unchanged. Positive control: `admin.a` assigning a role to a **same-school** user → **201**, revoke → **200**. Manipulated `school_id` on the request is already rejected by `resolveSchoolId` (403), verified earlier (§10 isolation table).

## SEC-04 — student fee-data exposure — STATUS: FIXED
- **BEFORE:** a student read `/fees/students`, `/fees/payments`, `/fees/dashboard` (guardian names, contacts, balances) — the student role held `fees.view`.
- **FIX:** migration `079` — removed `fees.view` from the student role. The student's own fee page uses the self branch of `assertStudentFeeAccess`, which does not require the permission. Finance/admin roles keep `fees.view`.
- **AFTER (staging):** student → **403** ("Requires permission: fees.view") on roster/payments/dashboard. Legitimate: `accountant.a` `/fees/students` → **200**; `student.a` own `/students/:id/fees/summary` → **200**. Also closes SEC-06 (student → another student's fee summary) → **403**.

## SEC-05 — unauthorized registration approval — STATUS: FIXED
- **BEFORE:** `student.a` rejected a genuine pending principal registration → 200.
- **FIX:** `backend/src/services/registration.service.ts::review` now authorizes the reviewer against the request's `reviewer_type`, mirroring the `listQueue` model: `admin`-routed → `users.manage`; `principal`-routed → `registration.review`; `class_teacher`-routed → the assigned class teacher (or a principal/admin as oversight). Controller passes `req.user` context. Regression tests added (`registration.service.test.ts`: student denied, unassigned teacher denied, `registration.review`-only denied on admin-routed, school-admin allowed).
- **AFTER (staging):** `student.a` `PATCH /registration-requests/<realPendingId>` → **403**; request stays `pending`, `reviewed_by` unset. Positive controls: `admin.a` review → **200**; `principal.a` review → **200**.
- **Note (intended model):** in this app principals hold `users.manage` (admin parity — migrations 027/029), so a principal is authorized to review admin-routed requests. This is by the app's permission model, not a bypass. The vulnerability (any authenticated in-school user could review) is closed; unauthorized/student callers are denied. Cross-school review remains impossible because the service scopes the lookup by `school_id`.

## Regression summary
| ID | STATUS |
|---|---|
| SEC-01 | FIXED (metadata vector); production Auth signup setting is a separate, documented dependency |
| SEC-02 | FIXED |
| SEC-03 | FIXED |
| SEC-04 | FIXED (and SEC-06 incidentally closed) |
| SEC-05 | FIXED |

Not declared fixed on code inspection alone — each was re-reproduced against the isolated staging project and now fails, while the corresponding legitimate operation still succeeds.
