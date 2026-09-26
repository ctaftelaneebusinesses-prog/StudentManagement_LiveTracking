# 01 — Architecture Map

This page supplements `00-baseline.md` §1–7.

## Request path
```
SPA (React) --Bearer JWT--> Express /api/v1
  requireAuth (auth.middleware.ts): GoTrue getUser -> users(+role,+school) -> user_roles -> school_admin_schools -> role_permissions
  requireRole / requirePermission (route level, optional)
  controller: resolveSchoolId(req) + row guards (studentAccess, teacherAccess, userAccess, scopeGuards, extracurricularAccess)
  service: supabaseAdmin (SERVICE ROLE, bypasses RLS) with .eq('school_id', ...)
SPA --anon key + JWT--> Supabase directly: auth (login, refresh), Storage uploads (RLS on storage.objects)
```

The authorization boundary is the backend guard layer. RLS only protects direct browser-to-Supabase access, which covers auth, storage **and any table the anon key can reach with default grants** (see SEC-01 and SEC-02).

## Effective role → permission matrix
Taken from replaying all migrations (`audit/evidence/db/migration-replay-state.json`).

| Role | Permissions (summary) |
|---|---|
| super_admin | everything, including `platform.*` and `assessment.*` |
| school_admin | all school-level permissions, including `users.manage`, `roles.manage`, `fees.*`, `schools.view_assigned` |
| principal | same as school_admin, plus `registration.review`, minus `schools.view_assigned` and `schools.request_creation` |
| teacher | students.view/manage, marks.*, homework.*, attendance.*, announcements.*, notifications.*, transport.*, academic_years.manage, departments.manage, activities.manage, evaluated_papers.manage |
| student | announcements.view, attendance.view, **fees.view**, homework.view/submit, marks.view, notifications.view, timetable.view, profile.edit_self |
| accountant | fees.view/manage, reports.view, profile.edit_self |
| driver, support_staff, extracurricular_staff | profile.edit_self (these portals rely on `requireRole` and ownership checks) |

## Data layer
- 86 tables (85 with RLS), 11 storage buckets (4 public), and 14 `SECURITY DEFINER` functions, all with `search_path=public`.
- All 83 SQL files apply cleanly in alphabetical order.
- An `auth.users` insert trigger provisions `users` and `user_roles` from **user metadata** (SEC-01).

## Integrations
- Supabase (DB, Auth, Storage).
- Web push (VAPID). The server POSTs to user-supplied endpoints (SEC-14).
- SMTP (optional).
- Google Translate widget.
- No payment provider and no LLM.

## Uploads
The browser uploads directly to Supabase Storage (RLS policies on `storage.objects`), then registers the `storage_path` with the API. The API re-checks the path prefix in most modules; announcements are the exception (SEC-09). Downloads use short-lived signed URLs from the service role.

## Background jobs
Two in-process 60-second pollers run in `server.ts`: announcement publishing and the teacher auto-absent job (PERF-04, FN-05).
