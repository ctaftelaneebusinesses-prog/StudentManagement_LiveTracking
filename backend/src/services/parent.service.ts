import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";
import { assertStudentInSchool } from "../utils/scopeGuards";

const PARENT_SELECT = "id, occupation, address, users(full_name, email, phone, avatar_url, is_active)";

const LINKED_PARENT_SELECT = `relation, parents(${PARENT_SELECT})`;

/** Strips characters with special meaning in a PostgREST `.or()` filter string (comma, parens). */
function sanitizeForOrFilter(value: string): string {
  return value.replace(/[,()]/g, "");
}

/** Search parents already registered in the school — used to link an existing guardian to another child. */
export async function searchParents(schoolId: string, search?: string) {
  let query = supabaseAdmin
    .from("parents")
    .select(PARENT_SELECT)
    .eq("school_id", schoolId)
    .order("id")
    .limit(20);

  if (search) {
    const safeSearch = sanitizeForOrFilter(search);
    const { data: matchingUsers, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .eq("role_id", ROLE_ID.PARENT)
      .or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
    if (userError) throw ApiError.internal(userError.message);
    const ids = (matchingUsers ?? []).map((u) => u.id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listParentsForStudent(schoolId: string, studentId: string) {
  await assertStudentInSchool(schoolId, studentId);

  const { data, error } = await supabaseAdmin
    .from("student_parents")
    .select(LINKED_PARENT_SELECT)
    .eq("student_id", studentId);
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Creates a brand-new parent account (invite flow) and links it to the student in one step. */
export async function createAndLinkParent(
  schoolId: string,
  studentId: string,
  input: {
    email: string;
    full_name: string;
    phone?: string;
    occupation?: string;
    address?: string;
    relation: "father" | "mother" | "guardian";
  }
) {
  await assertStudentInSchool(schoolId, studentId);

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo: `${env.FRONTEND_URL}/reset-password`,
      data: { full_name: input.full_name, role_id: ROLE_ID.PARENT, school_id: schoolId },
    }
  );

  if (inviteError) {
    if (inviteError.status === 422) throw ApiError.conflict("A user with this email already exists");
    throw ApiError.internal(inviteError.message);
  }

  if (input.phone) {
    await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", invited.user.id);
  }

  const { error: parentError } = await supabaseAdmin.from("parents").insert({
    id: invited.user.id,
    school_id: schoolId,
    occupation: input.occupation,
    address: input.address,
  });

  if (parentError) {
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
    throw ApiError.internal(parentError.message);
  }

  const { error: linkError } = await supabaseAdmin.from("student_parents").insert({
    student_id: studentId,
    parent_id: invited.user.id,
    relation: input.relation,
  });

  if (linkError) {
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
    throw ApiError.internal(linkError.message);
  }

  return listParentsForStudent(schoolId, studentId);
}

/** Links an already-existing parent (e.g. a sibling's guardian) to this student. */
export async function linkExistingParent(
  schoolId: string,
  studentId: string,
  parentId: string,
  relation: "father" | "mother" | "guardian"
) {
  await assertStudentInSchool(schoolId, studentId);

  const { data: parent, error: parentError } = await supabaseAdmin
    .from("parents")
    .select("id")
    .eq("id", parentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (parentError) throw ApiError.internal(parentError.message);
  if (!parent) throw ApiError.notFound("Parent not found");

  const { error } = await supabaseAdmin
    .from("student_parents")
    .upsert({ student_id: studentId, parent_id: parentId, relation }, { onConflict: "student_id,parent_id" });
  if (error) throw ApiError.internal(error.message);

  return listParentsForStudent(schoolId, studentId);
}

export async function updateLinkedParent(
  schoolId: string,
  studentId: string,
  parentId: string,
  patch: {
    relation?: "father" | "mother" | "guardian";
    full_name?: string;
    phone?: string;
    occupation?: string;
    address?: string;
  }
) {
  await assertStudentInSchool(schoolId, studentId);

  const { relation, full_name, phone, occupation, address } = patch;

  if (relation !== undefined) {
    const { error } = await supabaseAdmin
      .from("student_parents")
      .update({ relation })
      .eq("student_id", studentId)
      .eq("parent_id", parentId);
    if (error) throw ApiError.internal(error.message);
  }

  if (full_name !== undefined || phone !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (phone !== undefined) userPatch.phone = phone;
    const { error } = await supabaseAdmin
      .from("users")
      .update(userPatch)
      .eq("id", parentId)
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  if (occupation !== undefined || address !== undefined) {
    const parentPatch: Record<string, unknown> = {};
    if (occupation !== undefined) parentPatch.occupation = occupation;
    if (address !== undefined) parentPatch.address = address;
    const { error } = await supabaseAdmin
      .from("parents")
      .update(parentPatch)
      .eq("id", parentId)
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  return listParentsForStudent(schoolId, studentId);
}

/** Unlinks a parent from this student. The parent's account is left intact (may be linked to siblings). */
export async function unlinkParent(schoolId: string, studentId: string, parentId: string) {
  await assertStudentInSchool(schoolId, studentId);

  const { error } = await supabaseAdmin
    .from("student_parents")
    .delete()
    .eq("student_id", studentId)
    .eq("parent_id", parentId);
  if (error) throw ApiError.internal(error.message);
  return listParentsForStudent(schoolId, studentId);
}
