# Deployment Guide

Production preparation and deployment instructions for the Smart School Management System — a Vite/React frontend, an Express/TypeScript backend, and a Supabase (Postgres + Auth + Storage) database.

## Contents

1. [What Phase 14 changed](#1-what-phase-14-changed)
2. [Architecture](#2-architecture)
3. [Supabase production project](#3-supabase-production-project)
4. [Backend: cloud hosting](#4-backend-cloud-hosting)
5. [Frontend: Vercel](#5-frontend-vercel)
6. [Domain and SSL](#6-domain-and-ssl)
7. [Environment variables reference](#7-environment-variables-reference)
8. [Backup strategy](#8-backup-strategy)
9. [Post-deployment checklist](#9-post-deployment-checklist)
10. [Rollback plan](#10-rollback-plan)
11. [Ongoing maintenance](#11-ongoing-maintenance)
12. [Known follow-ups](#12-known-follow-ups)

---

## 1. What Phase 14 changed

**Security**
- Added rate limiting (`express-rate-limit`): 20 requests/15min on `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`; 600 requests/15min globally.
- Added `compression` (gzip) and `app.set("trust proxy", 1)` so the app works correctly behind Vercel/Render/Railway/Fly's reverse proxy (real client IPs for rate limiting and logs, not the proxy's).
- `CORS_ORIGIN` now accepts a comma-separated list (apex domain + `www` + preview URLs) instead of a single origin.
- Upgraded `nodemailer` (6.9.15 → 9.x) — the old version had several high-severity advisories (SMTP command injection, SSRF via crafted messages). `npm audit` is clean.
- Fixed a real bug found while auditing: `backend/src/types/express/attendance.types.ts` was at the wrong path — `attendance.service.ts` imports from `../types/attendance.types`, which didn't exist, so **the entire attendance module failed to compile**. Moved to the correct path (`backend/src/types/attendance.types.ts`).
- Fixed a second, more serious bug uncovered by the above: once the module resolved, several attendance functions turned out to query columns/tables/views (`attendance_date`, `updated_by`, `attendance_history`, `vw_attendance_*`) that don't exist in the applied schema (which uses a `date` column and no history table/views) — meaning **every attendance endpoint would 500 against a real database**. Fixed in `backend/src/services/attendance.service.ts` (now reads the real `date` column) plus a new migration (`015_attendance_reporting.sql`) that adds the missing `updated_by`/`updated_at` columns, the `attendance_history` audit table + trigger, and the four reporting views, all under the actual uuid schema. Run this migration before relying on attendance reports.

**Performance**
- Every page in `frontend/src/routes/AppRoutes.tsx` is now `React.lazy`-loaded behind one `<Suspense>` boundary — a given role's first login only downloads the JS for portals it can reach, not the other six roles' pages.
- PDF/Excel export libraries (`jspdf`, `jspdf-autotable`, `xlsx` — ~1MB combined) are dynamically `import()`ed inside `utils/export.ts` only when a user actually clicks "Export", not bundled into the report pages themselves.
- React Query default `staleTime` raised from 0 to 30s, so switching between pages that share a query key doesn't refetch on every mount.
- Added `compression` middleware on the API (gzip responses).
- Database: added `idx_attendance_school_date` (the one composite index the new Phase 13 Reports Dashboard's school-wide attendance queries actually benefit from — see `014_production_indexes.sql` for the full index audit notes).

**Error handling / loading states**
- Added a top-level React `ErrorBoundary` (`frontend/src/components/ErrorBoundary.tsx`) so one broken page can't blank the whole app.
- Every route now has an implicit loading state via the `Suspense` fallback (on top of the per-page `isLoading`/`Spinner` handling already in place from earlier phases).
- Backend's centralized error handler (`error.middleware.ts`) was already solid — no changes needed there.

**Responsive design**
- The sidebar was `hidden md:flex` with **no mobile equivalent at all** — on a phone-width screen there was no way to navigate. Added a hamburger button in the navbar (`md:hidden`) that opens a slide-in drawer version of the same nav (`Sidebar.tsx`, `Navbar.tsx`, `DashboardLayout.tsx`).
- Tightened header/content padding at small breakpoints.

**SEO basics**
- `index.html`: meta description, `theme-color`, Open Graph tags, and a real favicon (previously none of these existed).
- Because this is an authenticated internal application with nothing that should appear in search results, `robots.txt` and a `<meta name="robots">` tag both **disallow indexing** — that is the correct "SEO basic" for this kind of app, not a sitemap.

**Deployment artifacts added**
- `frontend/vercel.json` — SPA rewrite + security headers + static asset caching.
- `backend/Dockerfile` + `.dockerignore` — multi-stage build, non-root user, container `HEALTHCHECK` against `/api/v1/health`.
- `database/migrations/014_production_indexes.sql`, `015_attendance_reporting.sql`.
- This file.

---

## 2. Architecture

```
                         ┌─────────────────────┐
   Browser  ───HTTPS───▶ │   Vercel (frontend)  │
                         │  Vite/React SPA      │
                         └──────────┬───────────┘
                                    │ HTTPS (VITE_API_BASE_URL)
                                    ▼
                         ┌─────────────────────┐
                         │  Cloud host (backend)│
                         │  Express API, Docker │
                         └──────────┬───────────┘
                                    │ service-role key (server-only)
                                    ▼
                         ┌─────────────────────┐
                         │  Supabase project    │
                         │  Postgres + Auth +   │
                         │  Storage             │
                         └─────────────────────┘
                                    ▲
                                    │ anon key + user JWT (RLS-scoped)
   Browser  ─────────────direct─────┘
   (file uploads to Storage, session refresh)
```

The frontend talks to **two** backends directly: your Express API (`VITE_API_BASE_URL`) for business logic, and Supabase directly (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) for auth session management and file uploads to Storage buckets — both already wired in `frontend/src/lib/axios.ts` and `frontend/src/lib/supabaseClient.ts`. The service-role key is backend-only and must never reach the browser.

---

## 3. Supabase production project

1. **Create the project**: [supabase.com/dashboard](https://supabase.com/dashboard) → New Project. Pick a region close to your users and to wherever you deploy the backend (same region = lower latency between API and DB). Save the generated database password somewhere safe (a password manager, not chat/email).
2. **Run the schema, in order**: Project → SQL Editor. Run `database/schema.sql`, then `database/rls_policies.sql` (if not already folded into schema.sql), then every file in `database/migrations/` **in numeric order** (002 → 015). Each migration is idempotent (`create table if not exists`, `on conflict do nothing`, etc.) so re-running one that partially applied is safe.
   - Do **not** run `database/migrations/009_attendance_system.sql` — it's a stray/incompatible draft (integer IDs against a uuid schema) that predates `009_transport_module.sql` claiming the same number. It isn't referenced by any application code; only `009_transport_module.sql` is the real migration 009.
3. **Auth → URL Configuration**: set Site URL to your production frontend domain, and add both the production domain and (temporarily) your local dev URL to Redirect URLs — the invite/reset-password emails link back through this list (see `backend/src/config/env.ts`'s `FRONTEND_URL`).
4. **Auth → Providers**: confirm Email is enabled; disable sign-ups if accounts should only be provisioned by an admin (this app invites users via `supabaseAdmin.auth.admin.inviteUserByEmail`, it doesn't have public self-registration).
5. **Storage**: buckets (`avatars`, `homework-attachments`, `homework-submissions`, `student-documents`, etc.) are created by the migrations themselves — verify under Storage that they exist and their public/private flag matches what each migration set.
6. **Get your keys**: Project Settings → API → `Project URL`, `anon public` key, `service_role secret` key. The service-role key is as powerful as root DB access — store it only in the backend host's secret manager, never in the frontend, never in git.
7. **Connection pooling**: if your backend host is serverless/autoscaling (many short-lived instances), use Supabase's pooled connection string (Supavisor, "Transaction" mode) rather than the direct connection — this backend only talks to Postgres through `@supabase/supabase-js` over HTTPS (PostgREST), not a raw `pg` connection, so this mostly matters if you ever add a direct DB client later.
8. **Point-in-time recovery / backups**: see [§8](#8-backup-strategy).

---

## 4. Backend: cloud hosting

The backend ships as a standard multi-stage `Dockerfile` (Node 20 Alpine), so it runs on **any** container host — Render, Railway, Fly.io, AWS ECS/App Runner, Google Cloud Run, Azure Container Apps, a plain VPS with `docker run`, etc. Steps are the same shape everywhere:

1. **Build & verify locally first** (catches config problems before a cloud build queue does):
   ```bash
   cd backend
   npm ci
   npm run build     # tsc -p tsconfig.json → dist/
   npm test          # vitest
   docker build -t sms-backend .
   ```
2. **Push the repo** (or connect the host to your GitHub repo — most of the hosts above will build the `Dockerfile` directly on push).
3. **Set environment variables** on the host (see [§7](#7-environment-variables-reference) for the full list) — at minimum `NODE_ENV=production`, `CORS_ORIGIN` (your frontend's real domain(s)), `FRONTEND_URL`, and the three `SUPABASE_*` keys.
4. **Expose port 4000** (or override via the `PORT` env var — the app reads `process.env.PORT`, most hosts inject their own).
5. **Health check**: point the host's health check at `GET /api/v1/health` (already used by the Dockerfile's own `HEALTHCHECK`). It returns `{ "success": true, "data": { "status": "ok" } }`.
6. **Logs**: the app logs structured JSON via `pino` in production (pretty-printed only in `NODE_ENV=development`) — pipe stdout to whatever your host's log viewer is; the request logger already redacts the `Authorization` header.

Example — **Render** (one of the simpler options if you don't already have a preferred host):
- New → Web Service → connect the repo → Root Directory: `backend` → Environment: Docker (it will auto-detect the `Dockerfile`) → set env vars from §7 → Health Check Path: `/api/v1/health`.

Example — **Railway**:
- New Project → Deploy from GitHub repo → set Root Directory to `backend` → Railway auto-detects the `Dockerfile` → add env vars → it assigns a public domain automatically (custom domain in §6).

Whichever host you pick, **Node ≥ 20** is required (`backend/package.json`'s `engines` field) — this repo's own dev sandbox was on Node 18, which is fine for local iteration but do not deploy on anything older than 20.

---

## 5. Frontend: Vercel

1. **Import the project**: [vercel.com/new](https://vercel.com/new) → import the GitHub repo → set **Root Directory** to `frontend`.
2. **Framework preset**: Vite (auto-detected). Build command `npm run build`, output directory `dist` (defaults — no change needed).
3. **Environment variables** (Project Settings → Environment Variables — see §7): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (your deployed backend's URL + `/api/v1`), `VITE_SOCKET_URL` (your deployed backend's origin, no path). Set these for both the **Production** and **Preview** environments (preview deploys will otherwise hit your local dev API).
4. **`vercel.json`** (already in `frontend/`) handles the SPA fallback (so `/dashboard/...` deep links don't 404 on refresh) and adds baseline security headers + long-lived caching for hashed static assets — no extra configuration needed in the dashboard.
5. Deploy. Vercel gives you a `*.vercel.app` URL immediately; add your real domain in §6.

---

## 6. Domain and SSL

**Frontend (Vercel)**: Project → Settings → Domains → add your domain (e.g. `app.yourschool.com`). Vercel gives you a CNAME (or A/ALIAS for an apex domain) to add at your DNS registrar. Vercel provisions and renews the SSL certificate automatically (Let's Encrypt) — nothing else to configure.

**Backend (your chosen host)**: most hosts (Render, Railway, Fly, Cloud Run) work the same way — add a custom domain in their dashboard, add the CNAME they give you, and they auto-provision SSL the same way Vercel does. If you're running on a bare VPS instead, put Caddy or Nginx + Certbot in front of the container for automatic Let's Encrypt certificates — don't terminate TLS in the Node process itself.

**After both domains are live**, update:
- Backend's `CORS_ORIGIN` to the frontend's real domain (comma-separated if you also keep the `*.vercel.app` preview domain, e.g. `https://app.yourschool.com,https://your-project.vercel.app`).
- Backend's `FRONTEND_URL` to the frontend's real domain (used to build invite/reset-password links).
- Frontend's `VITE_API_BASE_URL`/`VITE_SOCKET_URL` to the backend's real domain.
- Supabase Auth → URL Configuration, Site URL and Redirect URLs, to the frontend's real domain.

---

## 7. Environment variables reference

### Backend (`backend/.env` — see `backend/.env.example`)

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` on every deployed environment |
| `PORT` | no | defaults to 4000; most hosts inject their own |
| `CORS_ORIGIN` | yes | comma-separated allowed origins, no spaces |
| `FRONTEND_URL` | yes | used to build invite/reset-password redirect links; must be allow-listed in Supabase Auth |
| `SUPABASE_URL` | yes | Project Settings → API |
| `SUPABASE_ANON_KEY` | yes | Project Settings → API — same value the frontend uses |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Project Settings → API — **backend only, never expose** |
| `LOG_LEVEL` | no | `info` in production; `debug` temporarily while diagnosing an issue |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` / `SMTP_SECURE` | no | notification emails are silently skipped (with a logged warning) if unset |

### Frontend (`frontend/.env` — see `frontend/.env.example`)

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | same project as the backend |
| `VITE_SUPABASE_ANON_KEY` | yes | the **anon** key — safe to expose, RLS is the real boundary |
| `VITE_API_BASE_URL` | yes | your backend's public URL + `/api/v1` |
| `VITE_SOCKET_URL` | yes | your backend's public URL (no path) — used for live GPS/notification sockets |

Never put `SUPABASE_SERVICE_ROLE_KEY` in any `VITE_`-prefixed variable — anything with that prefix ships to every visitor's browser.

---

## 8. Backup strategy

**Supabase-managed (do this first, it's built in)**:
- Every paid Supabase plan takes **automatic daily backups**, retained on a schedule that scales with your plan (7 days on Pro, longer on Team/Enterprise). Verify under Project Settings → Database → Backups once the project is created.
- Upgrade to a plan with **Point-in-Time Recovery (PITR)** before go-live if RPO of "up to 24h" isn't acceptable — PITR lets you restore to any second within its retention window, not just the last nightly snapshot.
- Test a restore at least once before go-live (Supabase supports restoring to a new project so you can verify without touching production) — a backup you've never restored from is a hope, not a plan.

**Supplementary manual backup** (cheap insurance, especially if you're on the Free tier without PITR): a nightly `pg_dump` via GitHub Actions or any cron runner, uploaded to your own storage.

```yaml
# .github/workflows/db-backup.yml (example — adjust secrets/bucket to your setup)
name: Nightly DB backup
on:
  schedule:
    - cron: "0 3 * * *"   # 03:00 UTC daily
  workflow_dispatch: {}
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Dump database
        run: |
          pg_dump "${{ secrets.SUPABASE_DB_URL }}" --format=custom --file=backup-$(date +%F).dump
      - name: Upload to storage
        run: |
          # e.g. aws s3 cp backup-*.dump s3://your-backup-bucket/  (configure AWS creds as secrets)
          echo "upload backup-*.dump to your chosen off-site storage"
```

`SUPABASE_DB_URL` is the direct (non-pooled) connection string from Project Settings → Database → Connection string — store it as a repo/organization secret, never commit it.

**What to back up besides the database**: Storage bucket contents (avatars, homework attachments/submissions, student documents) aren't included in a `pg_dump` — Supabase Storage itself is backed up as part of the project on paid plans, but if you need an independent copy, sync buckets with the Supabase CLI (`supabase storage`) or the S3-compatible API on the same schedule.

---

## 9. Post-deployment checklist

- [ ] All migrations 002–015 applied to the production Supabase project, in order (skip 009_attendance_system.sql).
- [ ] `GET https://your-backend/api/v1/health` returns `200`.
- [ ] Login works end-to-end from the production frontend domain (confirms CORS_ORIGIN, Supabase Auth redirect URLs, and API connectivity are all correct together).
- [ ] A teacher can mark attendance and it appears on the student/parent dashboards (exercises the attendance module fixed in this phase).
- [ ] File upload works (e.g. a homework attachment or avatar) — confirms Storage bucket policies are correctly applied.
- [ ] Rate limiting doesn't block legitimate use — 20 login attempts/15min is generous for a real user, but load-test if you expect a shared-IP scenario (a school's single NAT'd internet connection).
- [ ] Mobile nav (hamburger menu) works on an actual phone, not just a resized desktop browser window.
- [ ] `npm audit` clean on both `frontend` and `backend` (re-check periodically, not just at launch).
- [ ] Confirm a Supabase backup has been taken and, ideally, restored once as a test.

---

## 10. Rollback plan

- **Frontend**: Vercel keeps every deployment — Project → Deployments → pick the previous good one → "Promote to Production". Instant, no rebuild needed.
- **Backend**: redeploy the previous Docker image/commit through your host's dashboard (Render/Railway keep deployment history the same way Vercel does) — the Dockerfile's multi-stage build means old images are reproducible from any prior commit.
- **Database**: migrations in this project are additive (`create table if not exists`, `add column if not exists`) — there is no down-migration story. If a migration needs to be undone, write and run an explicit reverting SQL script by hand rather than assuming an automatic rollback exists; test it against a Supabase branch/staging project first if the change touches existing data.

---

## 11. Ongoing maintenance

- **Dependency updates**: run `npm audit` on both apps on a schedule (monthly at minimum) — `nodemailer` alone had eight high-severity advisories fixed by one version bump this phase, so this isn't hypothetical.
- **Index tuning**: enable `pg_stat_statements` in the Supabase dashboard (Database → Extensions) and periodically check for slow queries with `EXPLAIN ANALYZE` rather than guessing at new indexes — every index also costs write throughput, so add them only when a real query needs one (see the audit notes in `014_production_indexes.sql`).
- **Log review**: `pino` logs every request at `warn` (4xx) or `error` (5xx) — watch for a spike in either after a deploy.
- **Table growth**: `attendance` and `exam_marks` grow one row per student per day/exam indefinitely — nothing in this codebase archives old rows. Not urgent at typical single-school scale, but worth planning for (partitioning by academic year, or an archive table) if this ever serves many schools over many years.

---

## 12. Known follow-ups

Found during this pass but intentionally left alone because fixing them either changes application behavior beyond "prepare for production" or needs a product decision, not just an engineering one:

- **`AttendanceStatus` includes `'excused'`** (`backend/src/types/attendance.types.ts`) but the database `CHECK` constraint on `attendance.status` only allows `present/absent/late/half_day/leave` — if any UI path ever lets a teacher choose "excused", the insert will fail with a constraint violation. Either add `'excused'` to the check constraint (a migration) or remove it from the type/UI — needs a product decision on whether "excused" is a real status this school system should support.
- **Two unrelated, unwired "attendance" implementations exist side by side** in `frontend/src/pages/{parent/ViewAttendance,teacher/DailyAttendance,teacher/MarkAttendance,teacher/EditAttendance,admin/AttendanceAnalytics,principal/AttendanceReports}.tsx` and `frontend/src/api/attendanceApi.ts` / `frontend/src/components/attendance/AttendanceChart.tsx` — none of these are imported from `AppRoutes.tsx`, and they call a different (also-unapplied) draft schema. They don't affect the running app, but they're dead weight in the repo; safe to delete once you've confirmed you don't want to resurrect that version of the UI instead of the currently-wired `TeacherAttendancePage.tsx`.
- **`backend/src/services/exam.service.ts`** and a couple of other service files rely on `as unknown as T[]` casts around Supabase's `.select()` results (the query builder can't statically type joined-relation shapes without generated `Database` types) — functionally correct, but generating and wiring up Supabase's typed client (`supabase gen types typescript`) would remove the need for manual casts and catch a whole class of "wrong field name" bugs like the attendance one at compile time instead of at 3am in production.
- **Main frontend JS chunk is ~490KB** (gzip ~148KB) after this phase's route-level code-splitting — further reduction would need `manualChunks` tuning to separate vendor libraries (React, Supabase client, react-query) from application code; not done here since it's a diminishing-returns optimization compared to the route-splitting already in place.
