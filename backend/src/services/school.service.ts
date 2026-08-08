import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";

// ---------------------------------------------------------------------------
// Schools (platform-level, super_admin only for create/list-all)
// ---------------------------------------------------------------------------

/** Seeded into every new school's subject list; principal/admin can rename/add more afterward via subject management. */
const DEFAULT_SUBJECTS = [
  { name: "Telugu", code: "TEL" },
  { name: "Hindi", code: "HIN" },
  { name: "English", code: "ENG" },
  { name: "Math", code: "MAT" },
  { name: "Science", code: "SCI" },
  { name: "Social", code: "SOC" },
];
export async function listAllSchools() {
  const { data, error } = await supabaseAdmin.from("schools").select("*").order("created_at");
  if (error) throw ApiError.internal(error.message);
  return data;
}

/**
 * The schools one caller may actually switch between — their own school plus
 * any school_admin_schools assignments (066_super_admin_multi_school.sql).
 * This is what powers the school selector for a school_admin now that they no
 * longer hold platform.manage_schools and must never see the full list.
 *
 * A super_admin passes their unbounded reach in as `allSchools: true` rather
 * than having an assignment row per school.
 */
export async function listAccessibleSchools(schoolIds: string[], allSchools: boolean) {
  if (allSchools) return listAllSchools();
  if (schoolIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("*")
    .in("id", schoolIds)
    .order("name");
  if (error) throw ApiError.internal(error.message);
  return data;
}

/**
 * Public, unauthenticated lookup by school code — the self-registration page
 * (POST /auth/register) needs to resolve a school_id before any account
 * exists, so it can't use resolveSchoolId (which requires req.user). Returns
 * only non-sensitive identifying fields, never the full school row.
 */
export async function lookupSchoolByCode(code: string) {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("id, name, code")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("No active school found with that code");
  return data;
}

/** Deterministic-enough short code from a school name when the admin doesn't supply one. */
function generateSchoolCode(name: string): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "SCH";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`.slice(0, 20);
}

export async function createSchool(input: {
  name: string;
  code?: string;
  branch_name?: string;
  principal_name?: string;
  address?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  city?: string;
  district?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  logo_url?: string;
  is_active?: boolean;
  academic_year?: { name: string; start_date: string; end_date: string };
}) {
  const { academic_year: academicYear, ...schoolFields } = input;
  const code = schoolFields.code ?? generateSchoolCode(schoolFields.name);

  const { data, error } = await supabaseAdmin
    .from("schools")
    .insert({ ...schoolFields, code })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("A school with this code already exists");
    throw ApiError.internal(error.message);
  }

  if (academicYear) {
    await createAcademicYear(data.id, { ...academicYear, is_current: true });
  }

  const { error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .insert(DEFAULT_SUBJECTS.map((subject) => ({ ...subject, school_id: data.id })));
  if (subjectsError) logger.error({ err: subjectsError, schoolId: data.id }, "Failed to seed default subjects");

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

/**
 * Deletes a school outright only when it has zero linked users (the
 * `users.school_id -> schools.id` FK is `on delete restrict`, so a hard
 * delete would fail anyway once any user references it). Otherwise falls
 * back to deactivating the school. When `force` is false, active students
 * or teachers block the operation entirely so the caller can confirm first.
 */
export async function deleteSchoolSafely(schoolId: string, force: boolean) {
  await getSchool(schoolId);

  if (!force) {
    const [
      { count: activeStudents, error: studentsError },
      { count: activeTeachers, error: teachersError },
    ] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, users!inner(is_active)", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("users.is_active", true),
      supabaseAdmin
        .from("teachers")
        .select("id, users!inner(is_active)", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("users.is_active", true),
    ]);
    if (studentsError) throw ApiError.internal(studentsError.message);
    if (teachersError) throw ApiError.internal(teachersError.message);

    if ((activeStudents ?? 0) > 0 || (activeTeachers ?? 0) > 0) {
      throw ApiError.conflict("This school still has active students or teachers", {
        activeStudents: activeStudents ?? 0,
        activeTeachers: activeTeachers ?? 0,
      });
    }
  }

  const { count: userCount, error: userCountError } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);
  if (userCountError) throw ApiError.internal(userCountError.message);

  if ((userCount ?? 0) === 0) {
    const { error } = await supabaseAdmin.from("schools").delete().eq("id", schoolId);
    if (error) throw ApiError.internal(error.message);
    return { action: "deleted" as const };
  }

  const { error } = await supabaseAdmin.from("schools").update({ is_active: false }).eq("id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return { action: "deactivated" as const };
}

/** Platform-wide totals across every school — no school_id filter. */
export async function getPlatformStats() {
  const [
    { count: totalSchools, error: schoolsError },
    { count: activeSchools, error: activeError },
    { count: inactiveSchools, error: inactiveError },
    { count: totalStudents, error: studentsError },
    { count: totalTeachers, error: teachersError },
  ] = await Promise.all([
    supabaseAdmin.from("schools").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("schools").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabaseAdmin.from("schools").select("id", { count: "exact", head: true }).eq("is_active", false),
    supabaseAdmin.from("students").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("teachers").select("id", { count: "exact", head: true }),
  ]);
  if (schoolsError) throw ApiError.internal(schoolsError.message);
  if (activeError) throw ApiError.internal(activeError.message);
  if (inactiveError) throw ApiError.internal(inactiveError.message);
  if (studentsError) throw ApiError.internal(studentsError.message);
  if (teachersError) throw ApiError.internal(teachersError.message);

  return {
    totalSchools: totalSchools ?? 0,
    activeSchools: activeSchools ?? 0,
    inactiveSchools: inactiveSchools ?? 0,
    totalStudents: totalStudents ?? 0,
    totalTeachers: totalTeachers ?? 0,
  };
}

/** Per-school profile stats — "Sections" is the raw classes row count, "Classes" is distinct class names (mirrors ClassesPage's distinctClassNames logic). */
export async function getSchoolProfileStats(schoolId: string) {
  const [
    { count: totalStudents, error: studentsError },
    { count: totalTeachers, error: teachersError },
    { count: totalDrivers, error: driversError },
    { count: totalSections, error: sectionsError },
    { data: classRows, error: classesError },
  ] = await Promise.all([
    supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("drivers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabaseAdmin.from("classes").select("name").eq("school_id", schoolId),
  ]);
  if (studentsError) throw ApiError.internal(studentsError.message);
  if (teachersError) throw ApiError.internal(teachersError.message);
  if (driversError) throw ApiError.internal(driversError.message);
  if (sectionsError) throw ApiError.internal(sectionsError.message);
  if (classesError) throw ApiError.internal(classesError.message);

  return {
    totalStudents: totalStudents ?? 0,
    totalTeachers: totalTeachers ?? 0,
    totalDrivers: totalDrivers ?? 0,
    totalClasses: new Set((classRows ?? []).map((c) => c.name)).size,
    totalSections: totalSections ?? 0,
  };
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

/** Rejects date ranges that overlap any other academic year for this school (optionally excluding one row, for updates). */
async function assertNoDateOverlap(
  schoolId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): Promise<void> {
  let query = supabaseAdmin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .lt("start_date", endDate)
    .gt("end_date", startDate);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.limit(1);
  if (error) throw ApiError.internal(error.message);
  if (data && data.length > 0) {
    throw ApiError.conflict("This date range overlaps with an existing academic year");
  }
}

async function unsetCurrentAcademicYear(schoolId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("academic_years")
    .update({ is_current: false })
    .eq("school_id", schoolId)
    .eq("is_current", true);
  if (error) throw ApiError.internal(error.message);
}

export async function createAcademicYear(
  schoolId: string,
  input: { name: string; start_date: string; end_date: string; is_current?: boolean }
) {
  await assertNoDateOverlap(schoolId, input.start_date, input.end_date);
  if (input.is_current) await unsetCurrentAcademicYear(schoolId);

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
  if (patch.start_date || patch.end_date) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from("academic_years")
      .select("start_date, end_date")
      .eq("id", academicYearId)
      .eq("school_id", schoolId)
      .single();
    if (currentError || !current) throw ApiError.notFound("Academic year not found");

    await assertNoDateOverlap(
      schoolId,
      (patch.start_date as string) ?? current.start_date,
      (patch.end_date as string) ?? current.end_date,
      academicYearId
    );
  }

  if (patch.is_current === true) await unsetCurrentAcademicYear(schoolId);

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
  await unsetCurrentAcademicYear(schoolId);

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

// ---------------------------------------------------------------------------
// School settings (jsonb) — namespaced keys (email/notifications/backup/
// workingDays), read-merge-write so one key's update can't clobber another's.
// ---------------------------------------------------------------------------
const SETTINGS_KEYS = ["email", "notifications", "backup", "workingDays", "leavePolicy", "attendance"] as const;
export type SchoolSettingsKey = (typeof SETTINGS_KEYS)[number];

export function isSchoolSettingsKey(key: string): key is SchoolSettingsKey {
  return (SETTINGS_KEYS as readonly string[]).includes(key);
}

export async function updateSchoolSettings(schoolId: string, key: SchoolSettingsKey, value: unknown) {
  const school = await getSchool(schoolId);
  const settings = { ...(school.settings as Record<string, unknown>), [key]: value };
  return updateSchool(schoolId, { settings });
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
const DEPARTMENT_SELECT = "id, name, description, head_teacher_id, teachers:head_teacher_id(users(full_name)), created_at";

export async function listDepartments(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select(DEPARTMENT_SELECT)
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createDepartment(
  schoolId: string,
  input: { name: string; description?: string; head_teacher_id?: string }
) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .insert({ ...input, school_id: schoolId })
    .select(DEPARTMENT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("A department with this name already exists");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateDepartment(schoolId: string, departmentId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .update(patch)
    .eq("id", departmentId)
    .eq("school_id", schoolId)
    .select(DEPARTMENT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Department not found");
  return data;
}

export async function deleteDepartment(schoolId: string, departmentId: string) {
  const { error } = await supabaseAdmin.from("departments").delete().eq("id", departmentId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------
const HOLIDAY_SELECT = "id, name, date, is_recurring_yearly, academic_year_id, academic_years(name)";

export async function listHolidays(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("holidays")
    .select(HOLIDAY_SELECT)
    .eq("school_id", schoolId)
    .order("date");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createHoliday(
  schoolId: string,
  input: { name: string; date: string; is_recurring_yearly?: boolean; academic_year_id?: string }
) {
  const { data, error } = await supabaseAdmin
    .from("holidays")
    .insert({ ...input, school_id: schoolId })
    .select(HOLIDAY_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function updateHoliday(schoolId: string, holidayId: string, patch: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("holidays")
    .update(patch)
    .eq("id", holidayId)
    .eq("school_id", schoolId)
    .select(HOLIDAY_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Holiday not found");
  return data;
}

export async function deleteHoliday(schoolId: string, holidayId: string) {
  const { error } = await supabaseAdmin.from("holidays").delete().eq("id", holidayId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}
