import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertStudentInSchool } from "../utils/scopeGuards";
import { escapeOrFilterValue } from "../utils/searchFilter";

const SIBLING_SELECT = "id, admission_no, roll_no, classes(name, section), users(full_name, avatar_url)";

export async function listSiblings(schoolId: string, studentId: string) {
  await assertStudentInSchool(schoolId, studentId);

  const { data, error } = await supabaseAdmin
    .from("student_siblings")
    .select(`sibling_id, students!student_siblings_sibling_id_fkey(${SIBLING_SELECT})`)
    .eq("school_id", schoolId)
    .eq("student_id", studentId);
  if (error) throw ApiError.internal(error.message);

  return (data ?? []).map((row) => row.students);
}

/** Students in the same school, excluding self and already-linked siblings, for the "Link sibling" search. */
export async function searchSiblingCandidates(schoolId: string, studentId: string, search?: string) {
  await assertStudentInSchool(schoolId, studentId);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("student_siblings")
    .select("sibling_id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId);
  if (existingError) throw ApiError.internal(existingError.message);

  const excludeIds = new Set([studentId, ...(existing ?? []).map((r) => r.sibling_id)]);

  let query = supabaseAdmin
    .from("students")
    .select(SIBLING_SELECT)
    .eq("school_id", schoolId)
    .not("id", "in", `(${Array.from(excludeIds).join(",")})`)
    .order("admission_no")
    .limit(20);

  if (search) {
    const pattern = escapeOrFilterValue(`%${search}%`);
    const { data: matchingUsers, error: userSearchError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .ilike("full_name", pattern);
    if (userSearchError) throw ApiError.internal(userSearchError.message);

    const matchingIds = (matchingUsers ?? []).map((u) => u.id);
    const idFilter = matchingIds.length > 0 ? `,id.in.(${matchingIds.join(",")})` : "";
    query = query.or(`admission_no.ilike.${pattern}${idFilter}`);
  }

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Links two students as siblings — stored bidirectionally so a lookup from either side works with a single filter. */
export async function linkSibling(schoolId: string, studentId: string, siblingStudentId: string) {
  await assertStudentInSchool(schoolId, studentId);
  await assertStudentInSchool(schoolId, siblingStudentId);

  if (studentId === siblingStudentId) {
    throw ApiError.badRequest("A student cannot be linked as their own sibling");
  }

  const { error } = await supabaseAdmin.from("student_siblings").upsert(
    [
      { student_id: studentId, sibling_id: siblingStudentId, school_id: schoolId },
      { student_id: siblingStudentId, sibling_id: studentId, school_id: schoolId },
    ],
    { onConflict: "student_id,sibling_id" }
  );
  if (error) throw ApiError.internal(error.message);

  return listSiblings(schoolId, studentId);
}

export async function unlinkSibling(schoolId: string, studentId: string, siblingStudentId: string) {
  await assertStudentInSchool(schoolId, studentId);

  const { error } = await supabaseAdmin
    .from("student_siblings")
    .delete()
    .eq("school_id", schoolId)
    .or(
      `and(student_id.eq.${studentId},sibling_id.eq.${siblingStudentId}),and(student_id.eq.${siblingStudentId},sibling_id.eq.${studentId})`
    );
  if (error) throw ApiError.internal(error.message);

  return listSiblings(schoolId, studentId);
}
