import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/supabase", () => ({
  supabaseAdmin: { auth: { admin: { createUser: vi.fn() } }, from: vi.fn() },
}));

import { supabaseAdmin } from "../config/supabase";
import { provisionUser } from "./provisionUser";

const admin = supabaseAdmin as unknown as {
  auth: { admin: { createUser: ReturnType<typeof vi.fn> } };
  from: ReturnType<typeof vi.fn>;
};

let usersUpdatePatch: Record<string, unknown> | undefined;
let usersUpdateEqArgs: unknown[] | undefined;
let userRolesInsertArg: Record<string, unknown> | undefined;
let userRolesDeleteEqArgs: unknown[] | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  usersUpdatePatch = usersUpdateEqArgs = userRolesInsertArg = userRolesDeleteEqArgs = undefined;
  admin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });
  admin.from.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        update: (patch: Record<string, unknown>) => {
          usersUpdatePatch = patch;
          return { eq: (...args: unknown[]) => { usersUpdateEqArgs = args; return Promise.resolve({ error: null }); } };
        },
      };
    }
    if (table === "user_roles") {
      return {
        delete: () => ({ eq: (...args: unknown[]) => { userRolesDeleteEqArgs = args; return Promise.resolve({ error: null }); } }),
        insert: (arg: Record<string, unknown>) => { userRolesInsertArg = arg; return Promise.resolve({ error: null }); },
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
});

/** SEC-01: the provisioning path must never forward client-controllable metadata for privileged fields, and must set role/school authoritatively server-side. */
describe("provisionUser — SEC-01: privileged fields set server-side, not from metadata", () => {
  it("does not send role_id/school_id (or app_metadata) to auth.admin.createUser", async () => {
    await provisionUser({ email: "t@school.local", password: "pw", full_name: "T", role_id: 3, school_id: "school-1" });

    expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(1);
    const arg = admin.auth.admin.createUser.mock.calls[0][0];
    expect(arg.user_metadata).toEqual({ full_name: "T" }); // only full_name (non-privileged)
    expect(arg.app_metadata).toBeUndefined();
    expect(JSON.stringify(arg)).not.toContain("role_id");
    expect(JSON.stringify(arg)).not.toContain("school_id");
  });

  it("assigns role_id/school_id authoritatively and replaces the default membership after creation", async () => {
    await provisionUser({ email: "t@school.local", password: "pw", full_name: "T", role_id: 3, school_id: "school-1" });

    expect(usersUpdatePatch).toEqual({ role_id: 3, school_id: "school-1" });
    expect(usersUpdateEqArgs).toEqual(["id", "new-user-1"]);
    expect(userRolesDeleteEqArgs).toEqual(["user_id", "new-user-1"]);
    expect(userRolesInsertArg).toEqual({ user_id: "new-user-1", role_id: 3, school_id: "school-1" });
  });
});
