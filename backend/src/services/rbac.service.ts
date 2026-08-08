import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

/** The fixed 7-role RBAC system (see config/roles.ts) — read-only reference data. */
export async function listRoles() {
  const { data, error } = await supabaseAdmin.from("roles").select("id, name").order("id");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function listPermissions() {
  const { data, error } = await supabaseAdmin.from("permissions").select("id, code, description").order("code");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/** Every (role_id, permission_id) pair — small enough to ship whole so the frontend can render a full matrix without N+1 calls. */
export async function listRolePermissionMatrix() {
  const { data, error } = await supabaseAdmin.from("role_permissions").select("role_id, permission_id");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}
