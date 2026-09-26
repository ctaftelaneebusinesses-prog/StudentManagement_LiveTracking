# Staging / Test Environment Setup

- **Purpose:** a disposable environment for dynamically verifying SEC-01 to SEC-05 and running functional, API and E2E tests without touching production.
- **Status (2026-09-23):** ❌ **No safe environment exists yet.** The only database configured anywhere in this repository is the hosted Supabase project `https://hffi…supabase.co` (`backend/.env`, `frontend/.env`), and it may be production.

---

## 1. What the app needs

| Service | Why | Can plain Postgres replace it? |
|---|---|---|
| **Supabase Postgres** | all data; the schema references the `auth.users` and `storage.*` schemas | No, the migrations need Supabase's `auth` and `storage` schemas |
| **Supabase Auth (GoTrue)** | the backend calls `auth.getUser(token)` on every request; the frontend logs in directly; users are created through `auth.admin.createUser` | No |
| **PostgREST** | every backend query goes through `@supabase/supabase-js` (there is no ORM and no direct `pg` connection) | No |
| **Supabase Storage** | uploads and signed URLs | Only needed for upload tests |
| Node ≥ 20, npm | backend and frontend | – |
| SMTP | optional: emails are skipped if unset | leave unset in staging |
| VAPID keys | optional: push is skipped if unset | leave unset, or generate a **new** staging pair |

So staging needs a **full Supabase stack**, provided by one of these:

- **Option A (recommended): a new hosted Supabase project**, for example "sms-staging" on the free tier, under a name that can't be confused with production.
- **Option B: a local Supabase stack** (`supabase start`). This needs Docker and the Supabase CLI. **It's currently blocked on this machine:** the user `prajith` isn't in the `docker` group (`permission denied … /var/run/docker.sock`) and the Supabase CLI isn't installed. The owner would need to run `sudo usermod -aG docker prajith` (then log in again) and install the CLI.

## 2. Environment variables

### Backend
Validated at boot by `backend/src/config/env.ts`; a missing required variable exits the process.

| Variable | Required | Staging value |
|---|---|---|
| `NODE_ENV` | no (default `development`) | `development` |
| `PORT` | no (4000) | `4000` |
| `CORS_ORIGIN` | **yes** | `http://localhost:5173` |
| `FRONTEND_URL` | **yes** (URL) | `http://localhost:5173` |
| `SUPABASE_URL` | **yes** | **staging** project URL |
| `SUPABASE_ANON_KEY` | **yes** | **staging** anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | **staging** service-role key |
| `LOG_LEVEL` | no | `debug` while testing |
| `SMTP_*` | no | **leave unset** |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | no | unset, or a **new** staging pair (never reuse production keys) |

### Frontend
Only `VITE_` variables reach the browser.

| Variable | Required | Staging value |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | staging URL |
| `VITE_SUPABASE_ANON_KEY` | yes | staging anon key |
| `VITE_API_BASE_URL` | yes | `http://localhost:4000/api/v1` |
| `VITE_SOCKET_URL` | yes (unused) | `http://localhost:4000` |
| `VITE_VAPID_PUBLIC_KEY` | no | staging public key, or empty |
| `VITE_DEMO_MODE` | no | **unset**. Note that `import.meta.env.DEV` also enables a client-side demo login (`frontend/src/services/auth.service.ts:34`); the backend still rejects it |

### ⚠️ Env-file pitfalls that could silently point at production
- **Backend:** `env.ts` imports `dotenv/config`, which loads `./.env` (the production file) from the working directory. Variables already set in the process take priority, so **any variable you forget to set falls back to production**. **Use `DOTENV_CONFIG_PATH`** so that *only* the staging file is read:
  ```bash
  cd backend && DOTENV_CONFIG_PATH=.env.staging npm run dev
  ```
- **Frontend:** `vite --mode staging` loads `.env.staging` **on top of** `.env`, so any `VITE_*` key missing from `.env.staging` inherits the production value. **Define every `VITE_` variable in `frontend/.env.staging`**, or temporarily move `frontend/.env` aside (owner action).
- **Safest option:** while staging tests run, the owner renames `backend/.env` and `frontend/.env` to `*.prod-DO-NOT-USE`, then restores them afterwards.

## 3. Background jobs
`backend/src/server.ts` **always** starts two 60-second in-process pollers. There is **no environment flag to disable them**.

| Job | Writes |
|---|---|
| `startAnnouncementScheduler` (`services/announcementScheduler.ts`) | publishes due scheduled announcements, and fans out notifications, push and email |
| `startTeacherAttendanceScheduler` (`services/teacherAttendanceScheduler.ts`) | inserts `absent` rows for teachers after each school's cutoff |

- **Against a confirmed staging database these are harmless**, and they should run so real behaviour gets tested.
- **To start the API without them** (for example for a read-only smoke test), use `createApp()` from `backend/dist/app.js` in a separate launcher instead of `dist/server.js`. `app.ts` doesn't start the schedulers.
- **Recommended code change (not made, needs approval):** a `DISABLE_SCHEDULERS=true` guard in `server.ts`.

## 4. Migrations (staging database only)
There is no migration runner. Apply in this order:
1. `database/schema.sql`
2. `database/rls_policies.sql`
3. `database/migrations/*.sql` in ascending order, **skipping `009_attendance_system.sql`**

All 83 files applied cleanly in a local PGlite replay using alphabetical order for duplicate numbers (`audit/evidence/db/`).

With the staging connection string (Supabase → Project Settings → Database → Connection string):
```bash
# REFUSES to run unless the URL contains the staging ref you pass explicitly.
STAGING_REF=<staging-project-ref>          # e.g. abcd1234 — NOT hffi…
STAGING_DB_URL='postgresql://postgres:<pw>@db.<staging-ref>.supabase.co:5432/postgres'
case "$STAGING_DB_URL" in *hffi*) echo "REFUSING: production ref"; exit 1;; esac
case "$STAGING_DB_URL" in *"$STAGING_REF"*) ;; *) echo "REFUSING: ref mismatch"; exit 1;; esac
cd database
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f schema.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f rls_policies.sql
for f in $(ls migrations/*.sql | sort); do
  [ "$(basename $f)" = "009_attendance_system.sql" ] && continue
  echo ">> $f"; psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

**Auth settings:** set the staging project's Auth → Providers → Email options ("Allow new users to sign up", "Confirm email") to **the same values as production**, so SEC-01 is tested under production conditions. The owner should record those production values from the dashboard; I will not read them from production myself.

## 5. Test schools and accounts (synthetic only)
Use the reserved `.test` TLD, for example `admin.a@sms-staging.test`, and generated passwords kept in a local, gitignored `audit/test-data/accounts.local.md`.

**Schools:**
- **School A** (`STG-A`)
- **School B** (`STG-B`)

**Accounts:**

| Account | School | Purpose |
|---|---|---|
| super_admin | – | bootstrap; creates the schools and admins |
| school_admin A | A | SEC-03 actor |
| school_admin B | B | SEC-03 victim-side verification |
| principal A | A | approvals |
| class teacher A1 | A | class teacher of class A1 |
| subject teacher A2 | A | **two subjects in class A1, not its class teacher** (FN-01) |
| student A1, student A2 | A, class A1 | SEC-04/06 (A2 has fee structures and payments) |
| student B1 | B | SEC-03 target |
| driver A, accountant A, extracurricular staff A | A | permission-matrix coverage |
| pending registrations in A | A | principal-, teacher- and student-routed, for SEC-05 |

**Data:**
- Class A1 with 2 subjects.
- A fee structure and 2 payments for student A2, with synthetic parent names and phone numbers such as `+91-00000-00001`.
- One teacher-only announcement.
- One notification addressed to student A2.

**Bootstrap:**
1. Create the super_admin user in the **staging** Supabase Auth dashboard.
2. In the **staging** SQL editor:
   ```sql
   insert into user_roles(user_id, role_id, school_id) values ('<uid>', 7, null);
   ```
3. Create everything else through the API as super_admin and school_admin, which exercises the real code paths.

## 6. Preflight — what must be verified before anything starts
I will only start the backend or frontend after **all** of these pass:
1. The owner states in writing the staging project ref, and that it is disposable.
2. The ref in `SUPABASE_URL` and `VITE_SUPABASE_URL` equals that ref and **does not start with `hffi`**.
3. The `ref` claim inside the staging anon and service-role JWTs (decoded locally, values never printed) equals the same ref.
4. The backend is launched with `DOTENV_CONFIG_PATH=.env.staging`. Startup logs are checked, and a `GET /api/v1/health` succeeds.
5. A read-only count of `schools` and `users` in staging shows only the synthetic seed (for example, exactly 2 schools named `STG-*`).
6. The frontend `.env.staging` defines every `VITE_` variable, so nothing is inherited from `.env`.

## 7. Startup commands (staging only, after preflight)
```bash
cd backend  && npm ci && npm run build && DOTENV_CONFIG_PATH=.env.staging npm start   # or: npm run dev
cd frontend && npm ci && npx vite --mode staging                                         # http://localhost:5173
curl -s http://localhost:4000/api/v1/health
```

## 8. Safe teardown
1. Stop the backend and frontend processes.
2. Delete the staging project (Supabase dashboard → Settings → General → Delete project), or run `supabase stop --no-backup` for a local stack.
3. Delete `backend/.env.staging`, `frontend/.env.staging` and `audit/test-data/accounts.local.md`.
4. Restore any renamed production `.env` files.
5. If staging VAPID keys were created, discard them.

## 9. Commands that MUST NOT be run against production (`hffi…`)
| Command / action | Why |
|---|---|
| `npm run dev` / `npm start` / `node dist/server.js` in `backend/` with the default `.env` | starts both schedulers, which write attendance rows and send notifications, push and email to real users |
| `node backend/scripts/emergency-restore.js …` | **upserts every table** from a backup directory |
| `node backend/scripts/emergency-export.js` | dumps every table (all personal data) to local disk |
| Re-applying `schema.sql`, `rls_policies.sql` or migrations | schema changes; some migrations delete rows (for example `064` deletes role grants) |
| `supabase db reset`, `supabase db push`, `supabase link` to the production ref | destructive or schema-changing |
| Any POST, PATCH or DELETE through the API or Supabase REST: registration submits, approvals, `/users/*/roles`, `/students/bulk-delete`, `/students/:id/permanent`, `/users/bulk-delete`, announcement delete, fee payments | creates or modifies real data |
| Security reproduction steps from `09-security-reproduction.md` | would alter real accounts |
| Playwright/E2E runs with `frontend/.env` | the frontend points at production Supabase |
| `vitest` without isolation | currently safe (everything is mocked), but run the suites under `unshare -rn` as recorded in `audit/evidence/staging-validation/` |
