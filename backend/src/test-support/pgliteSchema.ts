import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

// contrib extensions are exposed only via package subpath exports, which this
// project's `moduleResolution: node` cannot type-resolve — require them.
/* eslint-disable @typescript-eslint/no-var-requires */
const { uuid_ossp } = require("@electric-sql/pglite/contrib/uuid_ossp");
const { pgcrypto } = require("@electric-sql/pglite/contrib/pgcrypto");
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * Boots an in-process Postgres (PGlite, WASM — no Docker, no network) with the
 * project's real schema and every migration applied, plus the minimal Supabase
 * shims (auth/storage schemas, auth.uid()/auth.role(), the anon/authenticated/
 * service_role roles). Used by the DB-level security regression tests to
 * exercise the actual triggers / grants the fixes rely on — behaviour that a
 * mocked Supabase client cannot cover.
 *
 * The shims mirror how Supabase/PostgREST run a request: default privileges
 * grant table access to anon/authenticated (RLS is the boundary), and a caller
 * is simulated with `set local role authenticated` + a request.jwt sub claim.
 */
const REPO_DB = path.resolve(__dirname, "../../../database");

const SHIMS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

/** Applies schema.sql, rls_policies.sql, then every migration in numeric order (skipping the documented stray 009_attendance_system.sql). */
export async function bootSchema(): Promise<PGlite> {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(SHIMS);

  const files = [path.join(REPO_DB, "schema.sql"), path.join(REPO_DB, "rls_policies.sql")];
  for (const m of fs.readdirSync(path.join(REPO_DB, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    if (m === "009_attendance_system.sql") continue; // documented stray draft (README §4.2)
    files.push(path.join(REPO_DB, "migrations", m));
  }
  for (const f of files) {
    await db.exec(fs.readFileSync(f, "utf8"));
  }
  return db;
}
