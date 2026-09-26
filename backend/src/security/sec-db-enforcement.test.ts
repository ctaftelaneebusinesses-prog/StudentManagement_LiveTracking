import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootSchema } from "../test-support/pgliteSchema";

/**
 * Database-level security regression tests. These exercise the actual Postgres
 * triggers and grants the fixes rely on — enforcement a mocked Supabase client
 * cannot cover — by replaying the real schema + migrations into an in-process
 * Postgres (PGlite). Covers:
 *   SEC-01  signup trigger never trusts client metadata for role/school
 *   SEC-02  BEFORE UPDATE trigger blocks a client role changing authz columns
 *   SEC-04  the 'student' role has no fees.view grant (finance roles keep it)
 */
const SCHOOL_B = "bbbbbbbb-0000-4000-8000-0000000000b2"; // arbitrary; the trigger must ignore it

let db: PGlite;

/** Insert an auth user (fires handle_new_auth_user) with attacker-chosen metadata. */
async function signup(id: string, email: string, meta: Record<string, unknown>) {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
    [id, email, JSON.stringify(meta)]
  );
}
async function profile(id: string) {
  const r = await db.query<{ role_id: number; school_id: string | null; status: string }>(
    `select role_id, school_id, status from public.users where id = $1`,
    [id]
  );
  return r.rows[0];
}
async function roleNames(id: string) {
  const r = await db.query<{ name: string }>(
    `select rr.name from public.user_roles ur join public.roles rr on rr.id = ur.role_id where ur.user_id = $1 order by 1`,
    [id]
  );
  return r.rows.map((x) => x.name);
}
/** Attempt an UPDATE on public.users acting as the 'authenticated' role for `asUid`. Returns the error code, or null if it succeeded. */
async function updateAsAuthenticated(asUid: string, setSql: string, whereId: string): Promise<string | null> {
  await db.exec("begin");
  try {
    await db.exec("set local role authenticated");
    await db.exec(`set local request.jwt.claim.sub = '${asUid}'`);
    await db.query(`update public.users set ${setSql} where id = $1`, [whereId]);
    await db.exec("rollback");
    return null; // allowed
  } catch (e) {
    await db.exec("rollback");
    return (e as { code?: string }).code ?? (e as Error).message;
  }
}

beforeAll(async () => {
  db = await bootSchema();
}, 180000);

afterAll(async () => {
  await db?.close();
});

describe("SEC-01 — signup trigger cannot escalate via client metadata", () => {
  it("malicious signup metadata cannot create a privileged role", async () => {
    const id = "00000000-0000-4000-8000-000000000101";
    await signup(id, "sec01-role@test.local", { role_id: 7, full_name: "Attacker" });
    const p = await profile(id);
    expect(p.role_id).toBe(5); // student, not 7 (super_admin)
    expect(await roleNames(id)).toEqual(["student"]);
    expect(await roleNames(id)).not.toContain("super_admin");
  });

  it("malicious school_id cannot establish unauthorized school membership", async () => {
    const id = "00000000-0000-4000-8000-000000000102";
    await signup(id, "sec01-school@test.local", { role_id: 1, school_id: SCHOOL_B });
    const p = await profile(id);
    expect(p.school_id).toBeNull();
    const r = await db.query<{ n: number }>(
      `select count(*)::int n from public.user_roles where user_id = $1 and school_id is not null`,
      [id]
    );
    expect(r.rows[0].n).toBe(0);
  });

  it("a new signup receives the intended safe default state (student, no school)", async () => {
    const id = "00000000-0000-4000-8000-000000000103";
    await signup(id, "sec01-default@test.local", {});
    const p = await profile(id);
    expect(p.role_id).toBe(5);
    expect(p.school_id).toBeNull();
    expect(await roleNames(id)).toEqual(["student"]);
  });
});

describe("SEC-02 — authenticated user cannot change authorization columns on their own row", () => {
  const uid = "00000000-0000-4000-8000-000000000201";
  beforeAll(async () => {
    await signup(uid, "sec02-self@test.local", {});
  });

  it("student cannot modify role_id", async () => {
    expect(await updateAsAuthenticated(uid, "role_id = 7", uid)).toBe("42501");
  });
  it("student cannot modify status", async () => {
    // use a value that differs from the current 'approved' so the change is real
    expect(await updateAsAuthenticated(uid, "status = 'rejected'", uid)).toBe("42501");
  });
  it("student cannot modify is_active", async () => {
    expect(await updateAsAuthenticated(uid, "is_active = false", uid)).toBe("42501");
  });
  it("student cannot modify school_id", async () => {
    expect(await updateAsAuthenticated(uid, `school_id = '${SCHOOL_B}'`, uid)).toBe("42501");
  });
  it("legitimate profile fields (full_name) remain editable", async () => {
    expect(await updateAsAuthenticated(uid, "full_name = 'New Name'", uid)).toBeNull();
  });
});

describe("SEC-04 — student role has no school-wide fee permission", () => {
  async function hasFeesView(roleName: string) {
    const r = await db.query<{ n: number }>(
      `select count(*)::int n from public.role_permissions rp
         join public.roles r on r.id = rp.role_id
         join public.permissions p on p.id = rp.permission_id
        where r.name = $1 and p.code = 'fees.view'`,
      [roleName]
    );
    return r.rows[0].n > 0;
  }
  it("student cannot hold fees.view (school-wide fee endpoints are gated on it)", async () => {
    expect(await hasFeesView("student")).toBe(false);
  });
  it("authorized finance/admin roles still hold fees.view", async () => {
    expect(await hasFeesView("accountant")).toBe(true);
    expect(await hasFeesView("school_admin")).toBe(true);
  });
});
