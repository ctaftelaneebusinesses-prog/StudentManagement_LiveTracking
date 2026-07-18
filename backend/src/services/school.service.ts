import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

// ---------------------------------------------------------------------------
// Schools (platform-level, super_admin only for create/list-all)
// ---------------------------------------------------------------------------
export async function listAllSchools() {
  const { data, error } = await supabaseAdmin.from("schools").select("*").order("created_at");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createSchool(input: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
}) {
  const { data, error } = await supabaseAdmin.from("schools").insert(input).select().single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("A school with this code already exists");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function getSchool(schoolId: string) {
  const { data, error } = await supabaseAdmin.from("schools").select("*").eq("id", schoolId).single();
  if (error) throw ApiError.notFound("School not found");
  return data;
}

export async function updateSchool(schoolId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .update(patch)
    .eq("id", schoolId)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------
export async function listAcademicYears(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .select("*")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createAcademicYear(
  schoolId: string,
  input: { name: string; start_date: string; end_date: string }
) {
  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .insert({ ...input, school_id: schoolId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("An academic year with this name already exists");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateAcademicYear(
  schoolId: string,
  academicYearId: string,
  patch: Record<string, unknown>
) {
  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .update(patch)
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Academic year not found");
  return data;
}

/** Marks one academic year as current, unsetting any previous one atomically. */
export async function setCurrentAcademicYear(schoolId: string, academicYearId: string) {
  const { error: unsetError } = await supabaseAdmin
    .from("academic_years")
    .update({ is_current: false })
    .eq("school_id", schoolId)
    .eq("is_current", true);
  if (unsetError) throw ApiError.internal(unsetError.message);

  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .update({ is_current: true })
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Academic year not found");
  return data;
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------
export async function listBranches(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createBranch(
  schoolId: string,
  input: { name: string; address?: string; is_main?: boolean }
) {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .insert({ ...input, school_id: schoolId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("A branch with this name already exists");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateBranch(schoolId: string, branchId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .update(patch)
    .eq("id", branchId)
    .eq("school_id", schoolId)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Branch not found");
  return data;
}

export async function deactivateBranch(schoolId: string, branchId: string) {
  return updateBranch(schoolId, branchId, { is_active: false });
}
