import { Request } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "./ApiError";
import { ROLE_ID } from "../config/roles";

const ADMIN_TIER_ROLES = ["principal", "school_admin", "super_admin"];

/**
 * True only for a caller whose sole admin-tier role is principal — a user who
 * ALSO holds school_admin/super_admin is unrestricted, same as a plain
 * school_admin.
 */
function isPrincipalOnlyActor(req: Request): boolean {
  const roles = req.user?.roles ?? [];
  return roles.includes("principal") && !roles.includes("school_admin") && !roles.includes("super_admin");
}

/**
 * Only a super_admin may create, grant, or revoke the super_admin role, or
 * act on an account that already holds it (§15: "A School Admin CANNOT create
 * Super Admins / modify Super Admin").
 *
 * This closes a privilege-escalation path opened by
 * 066_super_admin_multi_school.sql re-tiering the two roles: super_admin is in
 * user.validator.ts's ASSIGNABLE_ROLE_IDS and a school_admin holds both
 * users.manage and roles.manage, so without these checks they could mint
 * themselves a super_admin account and reach every school on the platform.
 * Harmless while the two roles were equal (027_equalize_admin_roles.sql); a
 * full tenancy bypass now that they aren't.
 *
 * Folded into the two exported guards below rather than exported separately,
 * so every existing call site is covered without having to remember to add a
 * second call next to each one.
 */
function assertMayTouchSuperAdminRole(req: Request, roleId: number): void {
  if (roleId !== ROLE_ID.SUPER_ADMIN) return;
  if (req.user?.roles.includes("super_admin")) return;
  throw ApiError.forbidden("Only a Super Admin can create or assign the Super Admin role");
}

/**
 * Guards management of one existing account. Two independent rules:
 *
 *  1. Super Admin tier — nobody except a super_admin may update, deactivate,
 *     reset the password of, or re-role an account holding super_admin.
 *  2. Principal Management restriction — a principal-only actor may not do any
 *     of the above to a user who holds ANY admin-tier role (principal/
 *     school_admin/super_admin). No-op for school_admin/super_admin actors.
 */
export async function assertPrincipalMayManageUser(req: Request, targetUserId: string): Promise<void> {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  const { data: rows, error } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", targetUserId);
  if (error) throw ApiError.internal(error.message);

  const names = (rows ?? []).map((row) => (row as unknown as { roles: { name: string } }).roles.name);

  if (names.includes("super_admin") && !user.roles.includes("super_admin")) {
    throw ApiError.forbidden("Only a Super Admin can manage a Super Admin account");
  }

  if (!isPrincipalOnlyActor(req)) return;

  if (names.some((name) => ADMIN_TIER_ROLES.includes(name))) {
    throw ApiError.forbidden("Only a School Admin can manage a Principal or Admin account");
  }
}

/**
 * Guards which role may be assigned/revoked/created. Two independent rules:
 *
 *  1. Only a super_admin may hand out (or take away) super_admin.
 *  2. A principal-only actor may not assign or revoke any admin-tier role
 *     (principal/school_admin/super_admin) to/from anyone, including themself.
 */
export async function assertPrincipalMayAssignRole(req: Request, roleId: number): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();

  assertMayTouchSuperAdminRole(req, roleId);

  if (!isPrincipalOnlyActor(req)) return;

  const { data: role, error } = await supabaseAdmin.from("roles").select("name").eq("id", roleId).maybeSingle();
  if (error) throw ApiError.internal(error.message);

  if (role && ADMIN_TIER_ROLES.includes(role.name)) {
    throw ApiError.forbidden("Only a School Admin can assign or remove an admin-tier role");
  }
}
