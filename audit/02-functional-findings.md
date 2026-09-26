# 02 — Functional Findings

**Dynamic functional QA was BLOCKED.** It needs a running backend with synthetic data in an approved environment. `backend/.env` points at a hosted Supabase project of unknown environment, and starting the server runs schedulers that write to it (00-baseline §8.1). The findings below come from code review, plus confirmed library behaviour where stated.

| ID | Severity | Status | Title |
|---|---|---|---|
| FN-01 | MEDIUM | CONFIRMED (library behaviour + schema) | A teacher who teaches 2+ subjects in a class (and isn't its class teacher) gets 500 or 403 |
| FN-02 | MEDIUM | LIKELY | A multi-school school_admin gets 403 on student records of their *assigned* schools |
| FN-03 | LOW | LIKELY | User search containing `,` `(` `)` returns 500 |
| FN-04 | LOW | CONFIRMED | `SMTP_SECURE=false` is parsed as `true` |
| FN-05 | LOW | LIKELY | Teacher auto-absent cutoff uses the server's clock timezone |
| FN-06 | LOW | CONFIRMED (code) | Deleting a non-existent or other-school announcement returns success |
| FN-07 | LOW | CONFIRMED | Lint broken in both packages |
| FN-08 | INFO | CONFIRMED | Documentation drift |

## FN-01 — `maybeSingle()` on a query that can return several rows
- **Where:**
  - `backend/src/utils/teacherAccess.ts` `assertTeacherOwnsClass` queries `class_subjects` filtered only by `teacher_id` and `class_id`, then calls `.maybeSingle()`.
  - `backend/src/utils/studentAccess.ts` `assertStudentAccess` runs the same query.
- **Why it fails:** `class_subjects` is unique on `(class_id, subject_id)` (`database/schema.sql:96-102`), so one teacher can have several rows per class. `@supabase/postgrest-js@2.78.0` returns an error (`PGRST116`, "multiple (or no) rows returned") when `maybeSingle()` receives more than one row (`dist/cjs/PostgrestBuilder.js:100-107`).
- **Actual behaviour:**
  - `assertTeacherOwnsClass` throws `ApiError.internal`, so the endpoint returns **500**. Affected endpoints include `/teacher-portal/classes/:classId/students`, `/teacher-portal/students?classId=`, `/homework`, `/exams` and `/reports` class views.
  - In `assertStudentAccess` the error is ignored and `data` is null. The branch falls through to **403** (hidden today by SEC-10/25, because teachers also hold `students.view`).
- **Expected:** access granted.
- **Reproduction (to run in a test env):** assign teacher T to Math *and* Science in class C, don't make T class teacher of C, then as T call `GET /teacher-portal/classes/C/students`.
- **Fix:** replace `.maybeSingle()` with `.limit(1)` and check `data.length`.
- **Regression test:** add a case in `teacherAccess.test.ts` where the mocked chain returns two rows.

## FN-02 — Multi-school admins are blocked from students in assigned schools
- **Where:** `assertStudentAccess` / `assertStudentFeeAccess` compare `student.school_id === user.schoolId`, which is the *home* school. They don't use `canTargetSchool(user, …)` or `accessibleSchoolIds`, which is what `resolveSchoolId` supports.
- **Effect:** a school_admin switched to an assigned school B would get 403 on `/students/:id` and everything under it for B's students.
- **Fix:** use `canTargetSchool(user, student.school_id)`.

## FN-03 — User search crashes on punctuation
- `user.service.ts:28` builds a raw `.or()` string (see SEC-15). A name like `Rao, K` produces malformed filter syntax, and PostgREST returns 400, which the service reports as a 500.

## FN-04 — `SMTP_SECURE` parsing
- `config/env.ts:21` uses `z.coerce.boolean()`. Verified: `"false" ⇒ true` and `"0" ⇒ true`. Once SMTP is configured on port 587 with `SMTP_SECURE=false`, nodemailer would try implicit TLS and fail.
- **Fix:** `z.enum(["true","false"]).transform(v => v === "true")`.

## FN-05 — Scheduler timezone
- **Where:** `services/teacherAttendanceScheduler.ts:14-25`. `currentHHMM()` uses the server's local time, while `today` is the UTC date. The school's `teacherCheckinCutoff` is presumably local school time.
- **Effect:** in a UTC container (the Docker default), a 09:30 cutoff fires at 15:00 IST.
- **Fix:** store a timezone per school (or use `Asia/Kolkata`) and compute both values in it.

## FN-06 — Silent success on delete
- `deleteAnnouncement` never checks that a row was deleted, so it returns `{message: "Announcement deleted"}` for any UUID. See SEC-09 for the security side of this.

## FN-07 — Lint
- The backend has no `eslint` dependency; the frontend has no config. See 00-baseline §8.

## FN-08 — Documentation drift
- The README (stored as UTF-16) says "no public signup" and lists the parent role. Public self-registration exists, and the parent role was removed in migration 064.
- The README says `socket.io` is unused, which is correct.

## Functional areas NOT TESTED (BLOCKED)
- Login, logout and session refresh.
- Password reset.
- The registration → approval flow for each role.
- CRUD for students, teachers, classes, fees, exams, homework and attendance.
- Driver trip lifecycle and live map.
- Leave workflows.
- Announcement scheduling.
- Bulk import.
- Exports.
- Duplicate submissions and concurrency.
- Pagination limits at runtime.
- Refresh and back-button behaviour.

## FN-09 — Network failure reported as "Invalid or expired session" (found 2026-09-24, staging)
- **Severity:** LOW. **Status:** CONFIRMED (observed on staging).
- **Where:** `backend/src/middleware/auth.middleware.ts`. `supabaseAdmin.auth.getUser(token)` errors are all mapped to `401 "Invalid or expired session"`, including network errors. The profile-load step right after it already distinguishes transient failures (500) from real auth failures.
- **Observed:** the backend's Supabase host was unreachable (DNS returned `106.51.255.28`; `fetch failed` / `UND_ERR_CONNECT_TIMEOUT` in the server log, 90 occurrences). A freshly logged-in super_admin got "Invalid or expired session" on POST `/super-admin/schools`.
- **Impact:** outages look like authentication problems. Users are told their session expired, and operators are misled.
- **Fix:** if `authError` is a network or fetch error (no `status`, or `status >= 500`), throw `ApiError.internal`/503 instead of 401.
