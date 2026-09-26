# 11 — Security Regression Validation (SEC-07/08/09/10/11/13/14)

- **Date:** 2026-09-26. **Scope:** staging only (`ruseufindaxkwgajkuev.supabase.co`), backend on `.env.staging`. **No production contact. No code modified this phase.** All synthetic data reverted; staging re-verified at baseline (2 schools, 17 accounts, 0 residual rows).
- **Method:** original exploit techniques re-run at the **API / database boundary** (bearer-token API calls + direct Supabase Storage/REST), not the frontend. Each finding tested for (a) attack now fails, (b) legitimate operation still works.
- **Static suite:** backend typecheck ✅, lint ✅ (exit 0), tests ✅ 146, build ✅; frontend typecheck ✅, lint ✅ (exit 0), tests ✅ 14, build ✅.
- **Targeted automated security tests:** backend 72 passed (10 files: sec-db-enforcement, sanitizeHtml, pushEndpoint, push.service, defaultPassword, scopeGuards, studentAccess, teacherAccess, registration.service, provisionUser); frontend 8 passed (sanitizeHtml, password).

## Per-finding results

### SEC-07 — notification audience bypass — CLOSED
- **Original exploit:** student `GET /api/v1/notifications` returned the school-wide notification log, including a notification addressed only to a teacher.
- **Expected secure:** non-staff cannot read the school-wide log; users see only their own via `/notifications/me`.
- **Actual (staging):** seeded a `audience_scope=user` notification for teacher.a; student.a `GET /notifications` → **403**. Legit: admin → **200**, student `/notifications/me` → **200**.
- **Boundary:** route guard `requirePermission("notifications.manage")` (students lack it).
- **Regression test:** `backend/src/routes/notification.routes.ts` (guard); manual staging (this doc). Automated: role-matrix covered by RBAC replay in `sec-db-enforcement.test.ts` context.

### SEC-08 — announcement audience bypass — CLOSED
- **Original exploit:** student `GET /announcements` (and `/:id`) saw a `teachers`-audience announcement.
- **Expected secure:** the announcement management list/detail is staff-only; students receive announcements via the audience-scoped notification fan-out.
- **Actual (staging):** teacher-only announcement created by admin.a; student.a list → **403**, detail → **403**; admin.a list → **200**.
- **Boundary:** `requirePermission("announcements.manage")` on `GET /announcements` and `/:id`.

### SEC-09 — attachment / storage authorization — CLOSED
Full storage lifecycle (all at the storage/API boundary):
| Sub-test | Result |
|---|---|
| upload to bucket | 200 (private bucket) |
| **public bucket exposure** (`/object/public/...`) | **400 — blocked** |
| read → signed URL generation | signed URL with `token=` |
| download via signed URL | **200**, correct bytes |
| anon direct object read (no session) | **400 — blocked** |
| ownership manipulation (cross-school attachment path) | **400 — rejected** |
| cross-school delete (non-owned announcement id) | **404 — no silent success** |
| legitimate delete of own homework | **200** |
- **Boundary:** buckets set `public=false` (migration 081); backend signs paths on read; folder-prefix guard (`{schoolId}/...`); delete verifies school ownership first.
- **Regression test:** `services/homework.service.ts` (signing + prefix guard), `services/announcement.service.ts` (delete/attachment scope), migrations 081; manual staging (this doc).

### SEC-10 — teacher modifying students outside scope — CLOSED
- **Original exploit:** teacher.a (holds `students.manage`) `PATCH /students/<student not in their class>` succeeded (200, field changed).
- **Expected secure:** a teacher may only modify students in a class they teach.
- **Actual (staging):** teacher.a (owns no class) `PATCH /students/<student.a>` → **403**, no DB change. Legit: admin edit → **200**; (own-class teacher edit → 200, prior rounds).
- **Boundary:** `requireStudentWriteAccess` bypass restricted to `isStaff` roles; teachers fall to the per-class ownership check.
- **Regression test:** `backend/src/utils/teacherAccess.test.ts` (SEC-10 cases).

### SEC-11 — stored XSS in exam content — CLOSED
- **Original exploit:** exam-document `content` stored raw and served to students, rendered via `dangerouslySetInnerHTML`.
- **Payload classes tested (stored via API, inspected in DB):** `<script>`, `onerror` handler, `javascript:` URL, `<svg onload>`, `<svg><script>`, `<iframe javascript:>`, HTML-entity-encoded handler — **all neutralized (inert)** on write.
- **Legit:** `<h2>/<strong>/<em>/<ul>/<ol>/<li>` formatting **preserved**; served-to-student content inert.
- **Boundary:** server-side allowlist sanitize on write (`sanitize-html` in `addExamDocument`) + DOMPurify on render (defense in depth).
- **Regression test:** `backend/src/utils/sanitizeHtml.test.ts`, `frontend/src/utils/sanitizeHtml.test.ts`.

### SEC-13 — predictable default password — CLOSED
- **Original exploit:** default password = first-5-of-name + phone/id, guessable.
- **Actual (staging):** provisioned a user with no password; login attempts with `first5(name)+phone`, `email-localpart+phone` → all **400 (invalid)**. Legit setup/reset: admin reset-password → new credential logs in **200**.
- **Boundary:** `generateDefaultPassword` (backend + frontend "Generate") now CSPRNG; never logged.
- **Regression test:** `backend/src/utils/defaultPassword.test.ts`, `frontend/src/utils/password.test.ts`.

### SEC-14 — SSRF / cross-user push takeover — CLOSED
- **SSRF matrix (all `POST /push/subscribe` → 400):** `localhost`, `127.0.0.1`, `10.0.0.0/8`, `192.168/16`, `172.16/12`, link-local `169.254.169.254` (metadata), IPv6 loopback `[::1]`, IPv6 ULA `[fc00::1]`, non-https `http://fcm...`, arbitrary host, suffix-spoof `fcm.googleapis.com.evil.com`, malformed URL.
- **Legit:** real provider endpoint (Mozilla autopush) → **201**.
- **Ownership:** second user re-subscribing another user's endpoint → **403**, owner unchanged; cross-user unsubscribe → owner sub **not deleted**; owner unsubscribe → removed.
- **Boundary:** server-side HTTPS + push-provider allowlist (`utils/pushEndpoint.ts`); ownership guard on subscribe; user-scoped unsubscribe.
- **Regression test:** `backend/src/utils/pushEndpoint.test.ts`, `backend/src/services/push.service.test.ts`.

## Summary table

| Finding | Original Status | Current Status | Exploit Reproduced? | Regression Test | Evidence |
|---|---|---|---|---|---|
| SEC-07 | CONFIRMED (High-ish MED) | **CLOSED** | No (403) | notification.routes.ts guard | student `/notifications` 403; `/me` 200 |
| SEC-08 | CONFIRMED MED | **CLOSED** | No (403) | announcement.routes.ts guard | student list+detail 403; admin 200 |
| SEC-09 | CONFIRMED MED | **CLOSED** | No | homework.service + announcement.service + mig 081 | public URL 400, signed URL 200, cross-school 400, delete 404 |
| SEC-10 | CONFIRMED MED | **CLOSED** | No (403) | teacherAccess.test.ts | teacher out-of-class PATCH 403, no change |
| SEC-11 | CONFIRMED MED | **CLOSED** | No | sanitizeHtml.test.ts (be+fe) | 7 payload classes inert; formatting kept |
| SEC-13 | CONFIRMED MED | **CLOSED** | No | defaultPassword/password .test.ts | predicted pw 400; admin reset 200 |
| SEC-14 | CONFIRMED MED | **CLOSED** | No | pushEndpoint/push.service .test.ts | 12 SSRF vectors 400; takeover 403 |

## Remaining findings (unchanged; NOT in this phase)
- **HIGH:** none open. (SEC-01, SEC-02 were CRITICAL — fixed earlier; SEC-03/04/05 HIGH — fixed earlier.)
- **MEDIUM (open):** SEC-12 (self-registration provisioned-then-marked-pending window; partially mitigated by 077), PERF-01 (8.2 MB region chunk), PERF-02 (auth-middleware round-trips), PERF-04 (in-process schedulers not multi-instance safe), plus the two deferred dependency highs `@tiptap/core` and `vite` (breaking-major upgrades).
- **LOW (open):** SEC-25 (teacher permission breadth — policy), PERF-03/05/06/07, REL-01 (provisioning not transactional), FN-05 residual (single-timezone assumption), UI warnings (33 eslint react-hooks/react-refresh).
- **Newly discovered issues:** none during this regression.
- **False positives:** none reclassified.
- **Requires manual verification (BLOCKED / not runtime-testable here):**
  - **SEC-09** direct-storage cross-tenant read under the *live Supabase Storage RLS policies* (I verified app-layer + anon/public blocked; the storage.objects SELECT policies themselves should be reviewed in the Supabase dashboard).
  - **SEC-23** CSP/HSTS — applied at the Vercel edge; needs a browser smoke-test (Google Translate/Supabase/Leaflet) before prod.
  - **SEC-18** `/auth/refresh` rate limit — wired, not load-tested.
  - **SEC-26** `forgot-password` redirect allow-list — depends on Supabase Auth URL config (production setting).
  - **SEC-01** end-to-end public-signup exploitability — depends on the production Auth "allow sign-ups" setting.
  - **FN-09** transient-error → 503 — code-verified; inducing a real GoTrue outage on staging isn't feasible.

## Deployment reminders (unchanged)
Migrations 077–081 must be applied to production; disable public sign-up in production Supabase Auth; rotate the staging DB password (exposed in-session); all fixes remain uncommitted (`HEAD` 1252957).
