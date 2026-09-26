# 03 — API / Backend Findings

## Inventory
- 415 route registrations were parsed from `backend/src/routes/*.routes.ts`, including helper aliases. Full table: `audit/evidence/api/endpoint-guard-inventory.tsv`, with columns: module, method, path, auth, route-level guards, handler.
- **Public:** `/health`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/record-login-attempt`, `/auth/register/meta`, `/auth/register/{6 roles}`, `/schools/lookup`.
- **116 authenticated endpoints have no route-level role or permission guard.** Each was traced into its controller:
  - `/students/:id/*` (35): all call `assertStudentAccess`, `assertStudentFeeAccess` or `requireStudentManageAccess`. ✔ (fee access: see SEC-06)
  - `/tracking/students/:id/*`: `assertStudentAccess`. ✔ `/tracking/trips/:tripId/eta` is school-scoped only; any user in the school can read any trip's ETA (INFO).
  - `/extracurricular-portal/*` (18): scoped to `req.user.id` through `assertStaffOwns*` plus foreign keys to `extracurricular_staff`. ✔ It has no explicit role guard (hardening).
  - `/teacher-portal/*` (18): reads are scoped to `req.user.id` or `assertTeacherOwns*`. **Leave application has no teacher check (SEC-16).**
  - `/registration-requests/:id` PATCH: **no check (SEC-05).**
  - `/notifications/me`, `/push/*`, `/schools/me*`, `/schools/assigned`: self-scoped. ✔ Push: see SEC-14.
  - `/website-knowledge/*` user endpoints: self-scoped. Admin endpoints are guarded through aliased `requirePermission`. ✔

## Findings

| ID | Severity | Status | Finding |
|---|---|---|---|
| API-01 | HIGH | see SEC-03 | `POST/DELETE /users/:id/roles` has no tenant membership check |
| API-02 | HIGH | see SEC-04 | School-wide `/fees/*` reads are open to the student role |
| API-03 | HIGH | see SEC-05 | `PATCH /registration-requests/:id` has no authorization |
| API-04 | MEDIUM | see SEC-07/08 | `/notifications`, `/announcements` return data regardless of audience |
| API-05 | MEDIUM | see SEC-09 | Announcement attachment operations aren't scoped to the announcement or school |
| API-06 | MEDIUM | CONFIRMED (code) | Guards use permission *codes* as role proxies, and grants drifted (student `fees.view`, teacher `students.manage`) |
| API-07 | LOW | CONFIRMED (code) | Staff bypass in `isStaff()` has no school check |
| API-08 | LOW | see SEC-15 / FN-03 | Unescaped `.or()` in user search |
| API-09 | LOW | CONFIRMED (code) | Delete endpoints return 200 when nothing was deleted (announcements; likely others) |
| API-10 | INFO | CONFIRMED | Validation / error shape is consistent |

### API-06 — Permission-code guards drifted from role intent
Several guards assume "holding permission X means you are staff":
- `assertStudentFeeAccess` checks `fees.view`.
- `requireStudentWriteAccess` checks `students.manage`.
- `assertStudentAccess` checks `students.view`.

Later migrations granted those codes to students (016) and teachers (002, 057), which silently widened access. **Recommendation:** make staff-only shortcuts check roles, or add distinct permission codes (for example `fees.view_all` vs `fees.view_own`). Add an automated test that loads the replayed role→permission matrix and asserts the expected per-role access to the sensitive endpoints.

### API-07 — `isStaff()` bypass
`utils/teacherAccess.ts` `assertTeacherOwnsClass`, `assertOwnHomeworkOrStaff` and similar return immediately for principal, school_admin or super_admin with no school check. Today they are safe *only because* each downstream service query also filters `.eq('school_id', schoolId)`. A future service that forgets that filter becomes a cross-tenant hole. **Recommendation:** pass `schoolId` into the guards and verify `classId` belongs to it (`assertClassInSchool`).

### API-10 — Positive observations
- Zod validation on every mutating route.
- Centralized error handler: no stack traces, consistent `{success, message, details}` shape.
- 1 MB JSON body limit.
- `helmet`, `compression` and CORS with an explicit origin list.
- Global limiter (3000 per 15 min per IP).
- Pagination is present on the list endpoints reviewed (`page`/`pageSize`). The `pageSize` upper bounds were not audited exhaustively (NOT TESTED).

## Not tested (BLOCKED)
- Runtime status codes and error bodies.
- Pagination caps.
- Rate-limit behaviour.
- CORS preflight results.
- Security headers on live responses.
- Large payloads.
- Concurrency (double approval, double payment).
