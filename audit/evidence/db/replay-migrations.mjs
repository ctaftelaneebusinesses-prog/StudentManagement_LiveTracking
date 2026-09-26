// Replays database/schema.sql + rls_policies.sql + migrations/*.sql into an
// in-memory PGlite instance with minimal Supabase shims, then dumps the
// effective role->permission matrix and RLS status. Read-only w.r.t. the repo.
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

const DB = process.argv[2];
const OUT = process.argv[3];
const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });

const shims = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;
await db.exec(shims);

const files = ["schema.sql", "rls_policies.sql"].map((f) => path.join(DB, f));
const migs = fs.readdirSync(path.join(DB, "migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const m of migs) {
  if (m === "009_attendance_system.sql") continue; // documented stray draft (README §4.2)
  files.push(path.join(DB, "migrations", m));
}

const results = [];
for (const f of files) {
  const sql = fs.readFileSync(f, "utf8");
  try {
    await db.exec(sql);
    results.push({ file: path.basename(f), ok: true });
  } catch (e) {
    results.push({ file: path.basename(f), ok: false, error: String(e.message).slice(0, 300) });
  }
}

const q = async (s) => (await db.query(s)).rows;
const matrix = await q(`
  select r.id as role_id, r.name as role, coalesce(string_agg(p.code, ', ' order by p.code), '') as permissions
  from public.roles r left join public.role_permissions rp on rp.role_id = r.id left join public.permissions p on p.id = rp.permission_id
  group by r.id, r.name order by r.id`);
const noRls = await q(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`);
const rlsNoPolicy = await q(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid) order by 1`);
const buckets = await q(`select id, public from storage.buckets order by id`);
const secdef = await q(`
  select p.proname, pg_get_function_identity_arguments(p.oid) as args,
         coalesce(array_to_string(p.proconfig, ','), '') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef order by 1`);
const userCols = await q(`select column_name, column_default from information_schema.columns where table_schema='public' and table_name='users' and column_name in ('status','is_active')`);
const anonPolicies = await q(`
  select tablename, policyname, roles::text, cmd from pg_policies
  where schemaname in ('public','storage') and (roles::text like '%public%' or roles::text like '%anon%') order by 1,2`);

fs.writeFileSync(OUT, JSON.stringify({ results, matrix, noRls, rlsNoPolicy, buckets, secdef, userCols, anonPolicies }, null, 2));
console.log(`applied ${results.filter((r) => r.ok).length}/${results.length} files`);
for (const r of results.filter((r) => !r.ok)) console.log("FAIL", r.file, "::", r.error);
