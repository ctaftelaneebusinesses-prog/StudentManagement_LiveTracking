# 05 — Performance / Reliability Findings

Sources are the static code review and the production build output (00-baseline §8). No load testing was done.

| ID | Severity | Status | Finding |
|---|---|---|---|
| PERF-01 | MEDIUM | CONFIRMED | `country-state-city` chunk is **8.37 MB** (`frontend/src/utils/indianRegions.ts`) |
| PERF-02 | MEDIUM | CONFIRMED (code) | `requireAuth` makes 4–5 sequential Supabase round-trips on **every** request, with no caching |
| PERF-03 | LOW | LIKELY | N+1 queries in `listAnnouncements` |
| PERF-04 | MEDIUM | CONFIRMED (code) | In-process `setInterval` schedulers are unsafe with more than one backend instance |
| PERF-05 | LOW | LIKELY | `myVehicles` embeds every trip ever run on the vehicle |
| PERF-06 | LOW | CONFIRMED | Other large chunks: `PortalLearningGamesPage` 868 KB, `index` 736 KB, `RichTextEditor` 372 KB |
| PERF-07 | LOW | CONFIRMED (code) | The frontend Axios interceptor calls `supabase.auth.getSession()` before every request |

## PERF-01 — Oversized region data
The whole world dataset is bundled for what looks like a list of Indian states and cities.
- **Fix:** ship a trimmed JSON of Indian states and districts, or lazy-load per state.

## PERF-02 — Auth middleware cost
**Where:** `middleware/auth.middleware.ts` runs these calls one after another:
1. `auth.getUser` (an HTTP call to GoTrue)
2. `users` join
3. `user_roles`
4. `school_admin_schools`
5. `role_permissions`

That adds roughly 5× the Supabase round-trip latency to every API call, and dashboards fire many calls in parallel.

**Fix:**
- Verify the JWT locally using the JWT secret or JWKS instead of `getUser`.
- Collapse the profile, role and permission loading into a single RPC or view.
- Optionally cache per token for about 30 s. The deactivation-takes-effect-immediately requirement must be weighed against this.

## PERF-03 — Announcements N+1
`announcement.service.ts:~265-275` runs per-announcement `count` and audience queries inside `Promise.all` over the page. That is 3–4 extra queries per row.

## PERF-04 — Schedulers
`announcementScheduler` and `teacherAttendanceScheduler` start inside every server process (`server.ts`). With more than one replica (autoscaling on Render or Cloud Run), each instance publishes the same due announcements, which duplicates notifications and push messages. Announcements use `notified_at`, but there is no atomic claim step.
- **Fix:** make publishing atomic (`update … set notified_at = now() where id = ? and notified_at is null returning *`), or move the job to a single cron worker.

## PERF-05 — Unbounded embed
`tracking.service.ts` `myVehicles` embeds `trips(...)` for the vehicle with no filter or limit, so the payload grows forever with trip history. Filter to `status = in_progress` or the latest trip.

## PERF-07 — Session read per request
`getSession()` is mostly served from memory, but on expiry it serializes through the SDK lock. That's acceptable; noted only for awareness.

## Not tested
- Real query plans and indexes against production data volumes.
- API latency.
- Memory use under load.
- Lighthouse / Web Vitals.
