import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

interface ListUsersFilters {
  role?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listUsers(schoolId: string, filters: ListUsersFilters) {
  let query = supabaseAdmin
    .from("users")
    // roles!inner is required (not just roles(name)) for the `.eq("roles.name", ...)`
    // filter below to actually apply — PostgREST only filters on embedded
    // resources that are inner-joined.
    .select("id, full_name, email, phone, is_active, avatar_url, role_id, roles!inner(name), created_at", {
      count: "exact",
    })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }
  if (filters.role) {
    query = query.eq("roles.name", filters.role);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);

  return { items: data, total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

export async function getUser(schoolId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, full_name, email, phone, is_active, avatar_url, role_id, roles(name), school_id, created_at")
    .eq("id", userId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("User not found");
  return data;
}

/**
 * Provisions a new user by inviting them via email rather than assigning a
 * password directly — Supabase creates the auth.users row immediately (which
 * fires handle_new_auth_user to populate public.users/user_roles) and emails
 * a link the person uses to set their own password. No plaintext password
 * ever passes through our API.
 */
export async function inviteUser(
  schoolId: string,
  input: { email: string; full_name: string; phone?: string; role_id: number }
) {
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${env.FRONTEND_URL}/reset-password`,
    data: {
      full_name: input.full_name,
      role_id: input.role_id,
      school_id: schoolId,
    },
  });

  if (error) {
    if (error.status === 422) throw ApiError.conflict("A user with this email already exists");
    throw ApiError.internal(error.message);
  }

  if (input.phone) {
    await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", data.user.id);
  }

  return getUser(schoolId, data.user.id);
}

export async function updateUser(
  schoolId: string,
  userId: string,
  patch: { full_name?: string; phone?: string; is_active?: boolean }
) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", userId)
    .eq("school_id", schoolId)
    .select("id, full_name, email, phone, is_active, avatar_url, role_id, roles(name)")
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("User not found");
  return data;
}

/**
 * Soft-deletes a user (is_active = false) rather than hard-deleting the row.
 * Preserves referential/audit history (a deactivated teacher's past class
 * assignments, a deactivated student's academic record) instead of cascading
 * deletes through the schema.
 */
export async function deactivateUser(schoolId: string, userId: string) {
  return updateUser(schoolId, userId, { is_active: false });
}

export async function assignRole(schoolId: string, userId: string, roleId: number) {
  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role_id: roleId, school_id: schoolId }, { onConflict: "user_id,role_id,school_id" });
  if (error) throw ApiError.internal(error.message);
  return listUserRoles(userId);
}

export async function revokeRole(userId: string, roleId: number, schoolId: string) {
  const remaining = await listUserRoles(userId);
  if (remaining.length <= 1) {
    throw ApiError.badRequest("Cannot remove a user's only remaining role");
  }

  const { error } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", roleId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return listUserRoles(userId);
}

export async function listUserRoles(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role_id, roles(name)")
    .eq("user_id", userId);
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}
