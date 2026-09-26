# 07 — Fix Plan (prioritized)

## P0 — DONE (implemented + regression-tested against staging, 2026-09-25)
All five P0 fixes are implemented and verified. Details/BEFORE-FIX-AFTER: `audit/09-security-reproduction.md` §11; regression run: `audit/08-regression-results.md`.

| # | Finding | Status | What shipped |
|---|---|---|---|
| 1 | SEC-01 | ✅ FIXED (code) | Migration `077`: signup trigger no longer trusts client metadata for role/school (safe default student/none); `provisionUser` assigns role/school authoritatively via service role. **Owner action still recommended:** disable public sign-up in production Auth (documented dependency). |
| 2 | SEC-02 | ✅ FIXED | Migration `078`: `BEFORE UPDATE` trigger blocks `authenticated`/`anon` from changing `role_id/status/is_active/school_id`; service role unaffected. |
| 3 | SEC-03 | ✅ FIXED | `assertUserInSchool(resolveSchoolId(req), targetId)` added to `assignRole`/`revokeRole`/`listUserRoles` in `user.controller.ts`. |
| 4 | SEC-04 (+SEC-06) | ✅ FIXED | Migration `079`: removed `fees.view` from the student role. Own-fee page unaffected; finance/admin retain access. |
| 5 | SEC-05 | ✅ FIXED | `registration.service.review` authorizes reviewer vs `reviewer_type` (mirrors `listQueue`); controller passes `req.user`; regression tests added. |

Files changed: `database/migrations/077,078,079`, `backend/src/utils/provisionUser.ts`,
`backend/src/controllers/user.controller.ts`, `backend/src/services/registration.service.ts`,
`backend/src/controllers/registration.controller.ts`, `backend/src/services/registration.service.test.ts`.
No unrelated findings were modified.

### Deferred hardening (related but not required for the P0 fix; not yet done)
- SEC-04: also add an explicit `requireRole('school_admin','principal','accountant','super_admin')` on the school-wide `/fees/*` reads, and make the `assertStudentFeeAccess` staff shortcut role-gated, as defense-in-depth in case `fees.view` is ever re-granted.
- SEC-03: optionally scope `requireAuth`'s `user_roles`/permission load to accessible schools (deeper defense).
- SEC-01: set `users.status` default to `'pending'` and provision self-registrations atomically (overlaps SEC-12).

---

## Original P0 spec (for reference)
| # | Finding | Change | Files | Regression test |
|---|---|---|---|---|
| 1 | SEC-01 | Disable public sign-ups in Supabase Auth now (dashboard, no code). Then change the trigger to ignore `raw_user_meta_data` role and school (or read `raw_app_meta_data`), and default `status` to `'pending'` | new migration; Supabase settings | SQL test: metadata `role_id=7` gives no super_admin role |
| 2 | SEC-02 | Revoke table-wide UPDATE on `users` from `authenticated`/`anon` and grant only safe columns, or add a guard trigger | new migration | RLS test: self-update of `status`/`school_id` is rejected |
| 3 | SEC-03 | Call `assertUserInSchool` in assign, revoke and list roles; filter `user_roles` by accessible schools in `requireAuth` | `services/user.service.ts`, `controllers/user.controller.ts`, `middleware/auth.middleware.ts` | Unit test: cross-school assign returns 404 |
| 4 | SEC-04/06 | Remove `fees.view` from student, or add staff `requireRole` on `/fees/*` reads, and make the `assertStudentFeeAccess` shortcut staff-only | new migration and/or `routes/fees.routes.ts`, `utils/studentAccess.ts` | Student token gets 403 on `/fees/students`, `/fees/payments` and another student's `/fees/summary` |
| 5 | SEC-05 | Add reviewer authorization to `review` (mirror `listQueue`, and check `assigned_reviewer_id` for teachers) | `controllers/registration.controller.ts`, `services/registration.service.ts` | Student token gets 403; the assigned teacher gets 200 |

## P1
| # | Finding | Change |
|---|---|---|
| 6 | SEC-12 | Provision self-registrations as `pending` atomically; roll back on failure |
| 7 | SEC-09 | Scope attachment delete, remove and path validation to the announcement and school |
| 8 | SEC-10 | `requireStudentWriteAccess`: short-circuit only for staff roles, not `students.manage` |
| 9 | SEC-07/08 | Audience-filter `/announcements`; restrict `/notifications` (the school list) to staff |
| 10 | SEC-11 | Sanitize HTML on write and render (DOMPurify); add a CSP |
| 11 | SEC-13 | Random initial passwords plus a forced change on first login |
| 12 | SEC-14 | Allow-list push endpoints; scope subscriptions to `user_id` |
| 13 | FN-01 | Replace `maybeSingle()` in the `class_subjects` ownership checks |
| 14 | FN-02 | Use `canTargetSchool` in the student access guards |
| 15 | SEC-24 | Replace `xlsx@0.18.5`; `npm audit fix` (nodemailer, vite, tiptap) |

## P2
- SEC-15/FN-03: escape the user search.
- SEC-16: role guard on the teacher portal.
- SEC-17: login history recorded server-side.
- SEC-18: rate limits.
- SEC-19: generic registration errors.
- SEC-20: make homework buckets private.
- SEC-21: RLS on the code sequence table.
- SEC-22: scope `listUserRoles`.
- SEC-23: CSP and HSTS.
- FN-04: `SMTP_SECURE` parsing.
- FN-05: school timezone.
- PERF-01: trim the region data.
- PERF-02: cheaper auth middleware.
- PERF-04: atomic announcement claim or a single worker.
- FN-07: restore lint (add eslint to the backend; add configs to both packages).

## Verification environment needed
To move the LIKELY items to CONFIRMED and run the regression tests:
1. A **separate** Supabase project (not `hffi…`) with `schema.sql`, `rls_policies.sql` and all migrations applied.
2. Synthetic users for each role across two schools.
3. Backend started against that project. The schedulers are harmless there.

`audit/evidence/db/replay-migrations.mjs` shows how to apply the SQL locally for database-level tests.

---

## P1 — DONE (implemented + re-tested against staging, 2026-09-25)
Authorized batch SEC-07/08/09/10/11/13/14. Details: `08-regression-results.md` (Round 4), `10-remaining-findings-validation.md` (Post-fix). All uncommitted; `HEAD` still `1252957`.

| ID | Root cause | Fix (server/DB boundary) | Verified |
|---|---|---|---|
| SEC-07 | `GET /notifications` (school-wide log) gated on `notifications.view`, which students hold; `listForSchool` unfiltered via service role | Re-gate route to `notifications.manage` (staff). Per-user feeds (`/me`, `/students/:id/notifications`) unchanged | student 403, admin 200 |
| SEC-08 | `GET /announcements` list+detail gated on `announcements.view` (students hold); `listAnnouncements` unfiltered | Re-gate to `announcements.manage` (staff console). Students get announcements via the audience-scoped notification fan-out | student 403, admin 200 |
| SEC-09 | `deleteAnnouncement` removed storage before the school-scoped row delete; `remove_attachment_ids` deleted by id only; attachment `storage_path` not prefix-validated | Verify announcement in school first; scope attachment removal to the announcement; require `storage_path` under `{schoolId}/{announcementId}/` | 404 on non-owned; 400 on bad path; cross-announcement removal blocked |
| SEC-10 | `requireStudentWriteAccess` short-circuited on `students.manage`, which teachers hold (mig 057) | Bypass only for `isStaff` roles; teachers fall through to the per-class ownership check | teacher out-of-class 403; own-class 200 |
| SEC-11 | Exam/question-paper `content` stored raw and rendered via `dangerouslySetInnerHTML` | Sanitize on write (`sanitize-html`, allowlist) in `addExamDocument`; sanitize on render (`DOMPurify`) at both sites | payloads stripped, formatting kept |
| SEC-13 | Default password = first-5-of-name + phone/id (predictable) | `generateDefaultPassword` now returns a CSPRNG value; never logged | old predictable pw rejected; provisioning still works |
| SEC-14 | Push `endpoint` accepted any URL (SSRF); upsert/delete keyed on endpoint globally (takeover) | Server-side HTTPS + push-provider allowlist (rejects IP/internal); ownership guard on subscribe; user-scoped unsubscribe | internal/arbitrary 400; takeover 403; unsubscribe isolated |

### Still deferred (not in this batch)
SEC-12, SEC-15, SEC-16, SEC-17, SEC-18, SEC-19, SEC-20, SEC-21, SEC-23, SEC-24, SEC-25/26, FN-01…FN-09 (minus none fixed here), PERF-*, REL-01, UI-* remain open (see `10-remaining-findings-validation.md`). SEC-09 cross-school storage-object read still needs fixtures/config to fully validate.

---

## P2 — DONE (2026-09-26): SEC-15/16/17/18/19/20/21/23/24
Implemented + regression-tested (`08-regression-results.md` Round 7; `10-remaining-findings-validation.md` post-fix 2). New migrations 080 (seq RLS), 081 (private homework buckets). Dependency: `xlsx` pinned to vendored SheetJS 0.20.3 (`frontend/vendor/xlsx-0.20.3.tgz` — commit it); `npm audit fix` cleared nodemailer/browserslist/js-yaml. Deferred (breaking majors): `@tiptap/core`, `vite`. FN-03 fixed incidentally (SEC-15).

---

## P3 — DONE (2026-09-26): FN-01…FN-09
FN-01 (maybeSingle→limit), FN-02 (canTargetSchool), FN-04 (SMTP_SECURE), FN-05 (scheduler tz Asia/Kolkata), FN-08 (README corrected+UTF-8), FN-09 (auth 503 vs 401). FN-03/FN-06 already fixed (SEC-15/SEC-09). FN-07: eslint configs added, `npm run lint` green both packages. See 08-regression-results.md Round 8.
