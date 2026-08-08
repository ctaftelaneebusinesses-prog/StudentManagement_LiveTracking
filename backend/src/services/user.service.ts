import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { provisionUser } from "../utils/provisionUser";
import { generateDefaultPassword } from "../utils/defaultPassword";

interface ListUsersFilters {
  role?: string;
  search?: string;
  status?: "active" | "inactive";
  page: number;
  pageSize: number;
}

export async function listUsers(schoolId: string, filters: ListUsersFilters) {
  let query = supabaseAdmin
    .from("users")
    // roles!inner is required (not just roles(name)) for the `.eq("roles.name", ...)`
    // filter below to actually apply — PostgREST only filters on embedded
    // resources that are inner-joined.
    .select(
      "id, full_name, email, phone, is_active, avatar_url, role_id, designation, roles!inner(name), created_at",
      { count: "exact" }
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }
  if (filters.role) {
    query = query.eq("roles.name", filters.role);
  }
  if (filters.status) {
    query = query.eq("is_active", filters.status === "active");
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
    .select(
      "id, full_name, email, phone, is_active, avatar_url, role_id, designation, roles(name), school_id, created_at"
    )
    .eq("id", userId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("User not found");
  return data;
}

/**
 * Provisions a new user directly with an admin-supplied (or generated)
 * password — Supabase creates the auth.users row immediately (which fires
 * handle_new_auth_user to populate public.users/user_roles) and the account
 * is usable right away. No invite email is sent.
 */
export async function createUser(
  schoolId: string,
  input: {
    email: string;
    full_name: string;
    phone?: string;
    password?: string;
    role_id: number;
    designation?: string;
  }
) {
  const password = input.password || generateDefaultPassword(input.full_name, input.phone);
  const provisioned = await provisionUser({
    email: input.email,
    password,
    full_name: input.full_name,
    role_id: input.role_id,
    school_id: schoolId,
  });

  if (input.phone || input.designation) {
    await supabaseAdmin
      .from("users")
      .update({ phone: input.phone, designation: input.designation })
      .eq("id", provisioned.id);
  }

  return getUser(schoolId, provisioned.id);
}

export async function updateUser(
  schoolId: string,
  userId: string,
  patch: { full_name?: string; phone?: string; is_active?: boolean; designation?: string }
) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", userId)
    .eq("school_id", schoolId)
    .select("id, full_name, email, phone, is_active, avatar_url, role_id, designation, roles(name)")
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

/**
 * Directly sets a user's password via the Supabase admin API — no email is
 * sent, mirroring the "no invite, share it directly" pattern already used by
 * createUser/provisionUser. The admin already knows the new value (typed it
 * or generated it client-side before calling this), so nothing needs to be
 * returned beyond confirming the target user.
 */
export async function resetPassword(schoolId: string, userId: string, password: string) {
  await getUser(schoolId, userId); // 404s if the user isn't in this school

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) throw ApiError.internal(error.message);
}

/**
 * Bulk activate/deactivate — same soft is_active toggle as updateUser, just
 * applied to many rows at once for the Users Module's bulk-action bar.
 */
export async function bulkSetActive(schoolId: string, userIds: string[], isActive: boolean) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ is_active: isActive })
    .in("id", userIds)
    .eq("school_id", schoolId)
    .select("id");
  if (error) throw ApiError.internal(error.message);
  return { updatedCount: data?.length ?? 0 };
}

interface BulkCreateUserInput {
  email: string;
  full_name: string;
  phone?: string;
  password?: string;
  role_id: number;
  designation?: string;
}

/** Same per-row independent try/catch as bulkCreateStudents — one bad row shouldn't abort the whole batch. */
export async function bulkCreateUsers(schoolId: string, rows: BulkCreateUserInput[]) {
  const created: Awaited<ReturnType<typeof createUser>>[] = [];
  const failed: { index: number; email?: string; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      created.push(await createUser(schoolId, row));
    } catch (err) {
      failed.push({
        index: i,
        email: row.email,
        message: err instanceof ApiError ? err.message : "Unexpected error while creating this row",
      });
    }
  }

  return { created, failed, totalRequested: rows.length };
}

/** Hard-deletes users — cascades through public.users -> role-specific tables (students/teachers/parents/...) per schema.sql's `on delete cascade` chain, same mechanism as permanentlyDeleteStudent. */
export async function bulkDeleteUsers(schoolId: string, userIds: string[]) {
  const { data: matching, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", userIds);
  if (error) throw ApiError.internal(error.message);

  const results = await Promise.allSettled(
    (matching ?? []).map((u) => supabaseAdmin.auth.admin.deleteUser(u.id as string))
  );
  const deletedCount = results.filter((r) => r.status === "fulfilled").length;
  return { deletedCount, requestedCount: userIds.length };
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
