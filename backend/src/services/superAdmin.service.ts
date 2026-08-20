import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { provisionUser } from "../utils/provisionUser";
import { ROLE_ID } from "../config/roles";

/**
 * Platform-tier operations available only to a super_admin
 * (066_super_admin_multi_school.sql).
 *
 * The cascade rules implemented here are the heart of this module, so they're
 * stated once up front:
 *
 *  - Deactivation NEVER deletes anything. Students, teachers, attendance,
 *    fees, exams, transport history, homework, syllabus and announcements all
 *    stay exactly as they are; only `is_active` flags move.
 *  - Deactivating a school switches off every account inside it. Deactivating
 *    a school_admin switches off every school they manage, and transitively
 *    those schools' accounts.
 *  - Reactivation restores ONLY the rows a cascade switched off — tracked by
 *    the `cascade_suspended` flag. An account an admin suspended individually
 *    stays suspended, which is what §12 of the spec asks for.
 *  - super_admin accounts are never touched by a cascade. A platform operator
 *    whose home school gets deactivated must still be able to log in and undo
 *    it, otherwise the system can lock out its own administrator.
 */

/** Roles counted individually on the platform dashboard. */
const ROLE_STATS = [
  "school_admin",
  "principal",
  "teacher",
  "student",
  "accountant",
  "driver",
  "extracurricular_staff",
  "support_staff",
] as const;
type StatRole = (typeof ROLE_STATS)[number];

/** Numeric role id backing each stat, for roles with no dedicated profile table. */
const ROLE_ID_BY_STAT: Record<StatRole, number> = {
  school_admin: ROLE_ID.SCHOOL_ADMIN,
  principal: ROLE_ID.PRINCIPAL,
  teacher: ROLE_ID.TEACHER,
  student: ROLE_ID.STUDENT,
  accountant: ROLE_ID.ACCOUNTANT,
  driver: ROLE_ID.DRIVER,
  extracurricular_staff: ROLE_ID.EXTRACURRICULAR_STAFF,
  support_staff: ROLE_ID.SUPPORT_STAFF,
};

/**
 * Roles that have their own profile table — the source of truth for who's
 * actually enrolled/employed. `user_roles` is only populated by a DB trigger
 * on auth-user creation and can drift out of sync (e.g. a bulk import that
 * inserts straight into `students` without going through that trigger), so
 * counts for these roles must come from the profile table, not `user_roles`.
 */
const ROLE_TABLE_BY_STAT: Partial<Record<StatRole, string>> = {
  teacher: "teachers",
  student: "students",
  driver: "drivers",
  extracurricular_staff: "extracurricular_staff",
};

/** ids of every account holding super_admin — excluded from all cascades. */
async function getSuperAdminUserIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role_id", ROLE_ID.SUPER_ADMIN);
  if (error) throw ApiError.internal(error.message);
  return Array.from(new Set((data ?? []).map((row) => row.user_id)));
}

/** Counts a role platform-wide, optionally restricted to a school. */
async function countUsersWithRole(
  role: StatRole,
  { activeOnly = false, schoolId }: { activeOnly?: boolean; schoolId?: string } = {}
): Promise<number> {
  const table = ROLE_TABLE_BY_STAT[role];
  if (table) {
    let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
    if (schoolId) query = query.eq("school_id", schoolId);
    const { count, error } = await query;
    if (error) throw ApiError.internal(error.message);
    return count ?? 0;
  }

  let query = supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role_id", ROLE_ID_BY_STAT[role]);
  if (activeOnly) query = query.eq("is_active", true);
  if (schoolId) query = query.eq("school_id", schoolId);

  const { count, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Platform-wide statistics and chart series for the Super Admin dashboard.
 *
 * Deliberately aggregate-only — no student-level rows are returned here (§4).
 *
 * Note on "parents": migration 064_remove_parent_role.sql removed the parent
 * role entirely (parents sign in through their child's student account), so
 * there is no parent account to count. `parentContacts` is therefore the
 * number of distinct guardian contacts recorded on student profiles, which is
 * the closest real figure the schema actually holds.
 */
export async function getPlatformDashboard() {
  const [
    { count: totalSchools, error: schoolsErr },
    { count: activeSchools, error: activeErr },
    { data: schoolRows, error: schoolListErr },
  ] = await Promise.all([
    supabaseAdmin.from("schools").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("schools").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabaseAdmin.from("schools").select("id, name, is_active, created_at").order("created_at"),
  ]);
  if (schoolsErr) throw ApiError.internal(schoolsErr.message);
  if (activeErr) throw ApiError.internal(activeErr.message);
  if (schoolListErr) throw ApiError.internal(schoolListErr.message);

  const roleTotals = {} as Record<StatRole, number>;
  await Promise.all(
    ROLE_STATS.map(async (role) => {
      roleTotals[role] = await countUsersWithRole(role);
    })
  );
  const activeSchoolAdmins = await countUsersWithRole("school_admin", { activeOnly: true });

  // Students per school — one head-count per school keeps this O(schools)
  // instead of pulling every student row back just to group them.
  const schools = schoolRows ?? [];
  const studentsBySchool = await Promise.all(
    schools.map(async (school) => {
      const { count, error } = await supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", school.id);
      if (error) throw ApiError.internal(error.message);
      return { schoolId: school.id, schoolName: school.name, students: count ?? 0 };
    })
  );

  const { data: guardianRows, error: guardianErr } = await supabaseAdmin
    .from("students")
    .select("father_phone, mother_phone");
  if (guardianErr) throw ApiError.internal(guardianErr.message);
  const parentContacts = new Set(
    (guardianRows ?? []).flatMap((row) =>
      [row.father_phone, row.mother_phone].filter((p): p is string => Boolean(p))
    )
  ).size;

  const { data: userCreatedRows, error: userCreatedErr } = await supabaseAdmin
    .from("users")
    .select("created_at")
    .order("created_at");
  if (userCreatedErr) throw ApiError.internal(userCreatedErr.message);

  return {
    totals: {
      totalSchools: totalSchools ?? 0,
      activeSchools: activeSchools ?? 0,
      inactiveSchools: (totalSchools ?? 0) - (activeSchools ?? 0),
      totalSchoolAdmins: roleTotals.school_admin,
      activeSchoolAdmins,
      totalPrincipals: roleTotals.principal,
      totalTeachers: roleTotals.teacher,
      totalStudents: roleTotals.student,
      totalAccountants: roleTotals.accountant,
      totalDrivers: roleTotals.driver,
      totalExtracurricularStaff: roleTotals.extracurricular_staff,
      totalSupportStaff: roleTotals.support_staff,
      parentContacts,
    },
    charts: {
      schoolsByStatus: [
        { name: "Active", value: activeSchools ?? 0 },
        { name: "Inactive", value: (totalSchools ?? 0) - (activeSchools ?? 0) },
      ],
      usersByRole: ROLE_STATS.map((role) => ({ role, count: roleTotals[role] })).filter(
        (entry) => entry.count > 0
      ),
      studentsBySchool: studentsBySchool.sort((a, b) => b.students - a.students),
      schoolGrowth: cumulativeByMonth(schools.map((s) => s.created_at as string)),
      userGrowth: cumulativeByMonth((userCreatedRows ?? []).map((u) => u.created_at as string)),
    },
  };
}

/** Groups ISO timestamps into YYYY-MM buckets with a running cumulative total. */
function cumulativeByMonth(timestamps: string[]): { month: string; added: number; total: number }[] {
  const perMonth = new Map<string, number>();
  for (const ts of timestamps) {
    if (!ts) continue;
    const month = ts.slice(0, 7);
    perMonth.set(month, (perMonth.get(month) ?? 0) + 1);
  }
  let running = 0;
  return Array.from(perMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, added]) => {
      running += added;
      return { month, added, total: running };
    });
}

// ---------------------------------------------------------------------------
// Schools — platform view
// ---------------------------------------------------------------------------

interface SchoolAdminSummary {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

/** Every school with its assigned admins, principal and headline counts. */
export async function listSchoolsWithDetail() {
  const { data: schools, error } = await supabaseAdmin
    .from("schools")
    .select(
      "id, name, code, logo_url, city, district, state, country, pin_code, address, phone, email, principal_name, is_active, cascade_suspended, created_at"
    )
    .order("name");
  if (error) throw ApiError.internal(error.message);

  const schoolIds = (schools ?? []).map((s) => s.id);
  if (schoolIds.length === 0) return [];

  const [assignments, counts] = await Promise.all([
    loadAssignmentsBySchool(schoolIds),
    Promise.all(schoolIds.map((id) => getSchoolCounts(id))),
  ]);

  return (schools ?? []).map((school, index) => ({
    ...school,
    admins: assignments.get(school.id) ?? [],
    counts: counts[index],
  }));
}

async function loadAssignmentsBySchool(schoolIds: string[]): Promise<Map<string, SchoolAdminSummary[]>> {
  const { data, error } = await supabaseAdmin
    .from("school_admin_schools")
    .select("school_id, users!school_admin_schools_user_id_fkey(id, full_name, email, is_active)")
    .in("school_id", schoolIds);
  if (error) throw ApiError.internal(error.message);

  const rows = data as unknown as { school_id: string; users: SchoolAdminSummary | null }[];
  const map = new Map<string, SchoolAdminSummary[]>();
  for (const row of rows ?? []) {
    if (!row.users) continue;
    const list = map.get(row.school_id) ?? [];
    list.push(row.users);
    map.set(row.school_id, list);
  }
  return map;
}

/** Per-school headcounts used on both the Schools list and the school overview. */
export async function getSchoolCounts(schoolId: string) {
  const [students, teachers, principals, accountants, drivers, ecStaff, classRows, totalUsers] =
    await Promise.all([
      countUsersWithRole("student", { schoolId }),
      countUsersWithRole("teacher", { schoolId }),
      countUsersWithRole("principal", { schoolId }),
      countUsersWithRole("accountant", { schoolId }),
      countUsersWithRole("driver", { schoolId }),
      countUsersWithRole("extracurricular_staff", { schoolId }),
      supabaseAdmin.from("classes").select("name").eq("school_id", schoolId),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    ]);

  if (classRows.error) throw ApiError.internal(classRows.error.message);
  if (totalUsers.error) throw ApiError.internal(totalUsers.error.message);

  return {
    students,
    teachers,
    principals,
    accountants,
    drivers,
    extracurricularStaff: ecStaff,
    classes: new Set((classRows.data ?? []).map((c) => c.name)).size,
    sections: (classRows.data ?? []).length,
    totalUsers: totalUsers.count ?? 0,
  };
}

/** Full detail for the Super Admin's school overview screen (§20). */
export async function getSchoolOverview(schoolId: string) {
  const { data: school, error } = await supabaseAdmin
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!school) throw ApiError.notFound("School not found");

  const [counts, assignments, principal] = await Promise.all([
    getSchoolCounts(schoolId),
    loadAssignmentsBySchool([schoolId]),
    supabaseAdmin
      .from("users")
      .select("id, full_name, email, phone, is_active, avatar_url")
      .eq("school_id", schoolId)
      .eq("role_id", ROLE_ID.PRINCIPAL)
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    school,
    counts,
    admins: assignments.get(schoolId) ?? [],
    principal: principal.data ?? null,
  };
}

// ---------------------------------------------------------------------------
// School admins
// ---------------------------------------------------------------------------

interface SchoolAdminRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  designation: string | null;
  is_active: boolean;
  cascade_suspended: boolean;
  school_id: string | null;
  created_at: string;
}

export async function listSchoolAdmins(filters: {
  search?: string;
  status?: "active" | "inactive";
  schoolId?: string;
}) {
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role_id", ROLE_ID.SCHOOL_ADMIN);
  if (roleError) throw ApiError.internal(roleError.message);

  const adminIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
  if (adminIds.length === 0) return [];

  let query = supabaseAdmin
    .from("users")
    .select(
      "id, full_name, email, phone, avatar_url, designation, is_active, cascade_suspended, school_id, created_at"
    )
    .in("id", adminIds)
    .order("full_name");

  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, "");
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  if (filters.status) query = query.eq("is_active", filters.status === "active");

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);

  const admins = (data ?? []) as unknown as SchoolAdminRow[];
  const assignments = await loadAssignmentsByAdmin(admins.map((a) => a.id));

  const withSchools = admins.map((admin) => ({
    ...admin,
    schools: assignments.get(admin.id) ?? [],
  }));

  // Filtering by school is applied after the join so the caller gets "admins
  // who manage this school", not "admins whose home school_id is this".
  return filters.schoolId
    ? withSchools.filter((a) => a.schools.some((s) => s.id === filters.schoolId))
    : withSchools;
}

interface AssignedSchool {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  logo_url: string | null;
}

async function loadAssignmentsByAdmin(userIds: string[]): Promise<Map<string, AssignedSchool[]>> {
  const map = new Map<string, AssignedSchool[]>();
  if (userIds.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("school_admin_schools")
    .select("user_id, schools(id, name, code, is_active, logo_url)")
    .in("user_id", userIds);
  if (error) throw ApiError.internal(error.message);

  const rows = data as unknown as { user_id: string; schools: AssignedSchool | null }[];
  for (const row of rows ?? []) {
    if (!row.schools) continue;
    const list = map.get(row.user_id) ?? [];
    list.push(row.schools);
    map.set(row.user_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

/** Confirms the target really is a school_admin before any platform action touches it. */
async function assertIsSchoolAdmin(userId: string): Promise<SchoolAdminRow> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, full_name, email, phone, avatar_url, designation, is_active, cascade_suspended, school_id, created_at"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("School Admin not found");

  const { data: roles, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);
  if (roleError) throw ApiError.internal(roleError.message);

  if (!(roles ?? []).some((r) => r.role_id === ROLE_ID.SCHOOL_ADMIN)) {
    throw ApiError.badRequest("This account is not a School Admin");
  }
  return data as unknown as SchoolAdminRow;
}

export async function getSchoolAdmin(userId: string) {
  const admin = await assertIsSchoolAdmin(userId);
  const assignments = await loadAssignmentsByAdmin([userId]);
  return { ...admin, schools: assignments.get(userId) ?? [] };
}

export async function createSchoolAdmin(input: {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  avatar_url?: string;
  designation?: string;
  school_ids: string[];
}) {
  await assertSchoolsExist(input.school_ids);

  // users.school_id remains the account's "home" school (it drives the
  // default selection in the school switcher and every legacy single-school
  // query); the full set of managed schools lives in school_admin_schools.
  const homeSchoolId = input.school_ids[0];

  const provisioned = await provisionUser({
    email: input.email,
    password: input.password,
    full_name: input.full_name,
    role_id: ROLE_ID.SCHOOL_ADMIN,
    school_id: homeSchoolId,
  });

  await supabaseAdmin
    .from("users")
    .update({
      phone: input.phone ?? null,
      avatar_url: input.avatar_url ?? null,
      designation: input.designation ?? null,
    })
    .eq("id", provisioned.id);

  await replaceAssignments(provisioned.id, input.school_ids, provisioned.id);
  return getSchoolAdmin(provisioned.id);
}

export async function updateSchoolAdmin(
  userId: string,
  patch: { full_name?: string; phone?: string; avatar_url?: string; designation?: string }
) {
  await assertIsSchoolAdmin(userId);
  const { error } = await supabaseAdmin.from("users").update(patch).eq("id", userId);
  if (error) throw ApiError.internal(error.message);
  return getSchoolAdmin(userId);
}

export async function resetSchoolAdminPassword(userId: string, password: string) {
  const admin = await assertIsSchoolAdmin(userId);
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) throw ApiError.internal(error.message);
  return admin;
}

async function assertSchoolsExist(schoolIds: string[]): Promise<{ id: string; name: string }[]> {
  if (schoolIds.length === 0) throw ApiError.badRequest("Assign at least one school");
  const { data, error } = await supabaseAdmin.from("schools").select("id, name").in("id", schoolIds);
  if (error) throw ApiError.internal(error.message);
  if ((data ?? []).length !== schoolIds.length) {
    throw ApiError.badRequest("One or more selected schools no longer exist");
  }
  return data ?? [];
}

/** Replaces an admin's assignment set wholesale (the Assign Schools dialog is a checkbox list). */
export async function replaceAssignments(userId: string, schoolIds: string[], assignedBy: string) {
  await assertSchoolsExist(schoolIds);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("school_admin_schools")
    .select("school_id")
    .eq("user_id", userId);
  if (existingError) throw ApiError.internal(existingError.message);

  const current = new Set((existing ?? []).map((r) => r.school_id));
  const next = new Set(schoolIds);
  const toAdd = schoolIds.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !next.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabaseAdmin
      .from("school_admin_schools")
      .insert(toAdd.map((school_id) => ({ user_id: userId, school_id, assigned_by: assignedBy })));
    if (error) throw ApiError.internal(error.message);
  }
  if (toRemove.length > 0) {
    const { error } = await supabaseAdmin
      .from("school_admin_schools")
      .delete()
      .eq("user_id", userId)
      .in("school_id", toRemove);
    if (error) throw ApiError.internal(error.message);
  }

  // Keep users.school_id pointing at a school the admin can still reach —
  // otherwise resolveSchoolId falls back to a school they no longer manage.
  const { data: user } = await supabaseAdmin.from("users").select("school_id").eq("id", userId).maybeSingle();
  if (user && (!user.school_id || !next.has(user.school_id))) {
    await supabaseAdmin.from("users").update({ school_id: schoolIds[0] }).eq("id", userId);
  }

  return { added: toAdd, removed: toRemove };
}

export async function removeAssignment(userId: string, schoolId: string) {
  const assignments = await loadAssignmentsByAdmin([userId]);
  const remaining = (assignments.get(userId) ?? []).filter((s) => s.id !== schoolId).map((s) => s.id);
  if (remaining.length === 0) {
    throw ApiError.badRequest(
      "A School Admin must manage at least one school. Assign another school first, or deactivate the account."
    );
  }
  return replaceAssignments(userId, remaining, userId);
}

// ---------------------------------------------------------------------------
// Impact previews — what a confirmation dialog shows before anything changes
// ---------------------------------------------------------------------------

/** Number of accounts a school deactivation would switch off (excludes super admins). */
async function countAffectedUsers(schoolIds: string[]): Promise<number> {
  if (schoolIds.length === 0) return 0;
  const superAdminIds = await getSuperAdminUserIds();

  let query = supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .in("school_id", schoolIds)
    .eq("is_active", true);
  if (superAdminIds.length > 0) query = query.not("id", "in", `(${superAdminIds.join(",")})`);

  const { count, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return count ?? 0;
}

export async function getSchoolsDeactivationImpact(schoolIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("id, name, code, is_active")
    .in("id", schoolIds);
  if (error) throw ApiError.internal(error.message);

  const schools = data ?? [];
  const activeSchools = schools.filter((s) => s.is_active);
  const affectedUsers = await countAffectedUsers(activeSchools.map((s) => s.id));

  return { schools, affectedSchools: activeSchools.length, affectedUsers };
}

export async function getSchoolAdminDeactivationImpact(userId: string) {
  const admin = await assertIsSchoolAdmin(userId);
  const assignments = (await loadAssignmentsByAdmin([userId])).get(userId) ?? [];
  const activeSchools = assignments.filter((s) => s.is_active);
  const affectedUsers = await countAffectedUsers(activeSchools.map((s) => s.id));

  return {
    admin: { id: admin.id, full_name: admin.full_name, email: admin.email },
    schools: assignments,
    affectedSchools: activeSchools.length,
    affectedUsers,
  };
}

// ---------------------------------------------------------------------------
// Cascades
// ---------------------------------------------------------------------------

/**
 * Switches off one school and every account in it.
 *
 * `viaCascade` records WHY the school went inactive: true when a school_admin
 * deactivation brought it down (so reactivating that admin should bring it
 * back), false when a super_admin deactivated this school directly (so it
 * must stay down until someone reactivates the school itself).
 */
async function deactivateOneSchool(schoolId: string, viaCascade: boolean) {
  const superAdminIds = await getSuperAdminUserIds();

  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .update({ is_active: false, cascade_suspended: viaCascade })
    .eq("id", schoolId)
    .eq("is_active", true)
    .select("id, name")
    .maybeSingle();
  if (schoolError) throw ApiError.internal(schoolError.message);
  if (!school) return { schoolId, usersSuspended: 0, alreadyInactive: true };

  // Only accounts that are currently active get flipped, and each one is
  // marked cascade_suspended so reactivation can tell them apart from
  // accounts that were already individually suspended.
  let query = supabaseAdmin
    .from("users")
    .update({ is_active: false, cascade_suspended: true })
    .eq("school_id", schoolId)
    .eq("is_active", true);
  if (superAdminIds.length > 0) query = query.not("id", "in", `(${superAdminIds.join(",")})`);

  const { data: suspended, error: usersError } = await query.select("id");
  if (usersError) throw ApiError.internal(usersError.message);

  return { schoolId, usersSuspended: (suspended ?? []).length, alreadyInactive: false };
}

/** Restores one school plus exactly the accounts a cascade switched off. */
async function activateOneSchool(schoolId: string) {
  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .update({ is_active: true, cascade_suspended: false })
    .eq("id", schoolId)
    .select("id, name")
    .maybeSingle();
  if (schoolError) throw ApiError.internal(schoolError.message);
  if (!school) throw ApiError.notFound("School not found");

  const { data: restored, error: usersError } = await supabaseAdmin
    .from("users")
    .update({ is_active: true, cascade_suspended: false })
    .eq("school_id", schoolId)
    .eq("cascade_suspended", true)
    .select("id");
  if (usersError) throw ApiError.internal(usersError.message);

  return { schoolId, usersRestored: (restored ?? []).length };
}

export async function setSchoolsActive(schoolIds: string[], isActive: boolean) {
  const results = [];
  for (const schoolId of schoolIds) {
    results.push(isActive ? await activateOneSchool(schoolId) : await deactivateOneSchool(schoolId, false));
  }

  return {
    schools: results,
    usersAffected: results.reduce(
      (sum, r) => sum + ("usersSuspended" in r ? r.usersSuspended : r.usersRestored),
      0
    ),
  };
}

/**
 * Deactivates a school_admin and cascades to every school they manage (§10/§11).
 * The admin's own row is NOT marked cascade_suspended — this was a direct
 * action on them, so a later school-level reactivation must not resurrect it.
 */
export async function deactivateSchoolAdmin(userId: string) {
  const admin = await assertIsSchoolAdmin(userId);
  const assignments = (await loadAssignmentsByAdmin([userId])).get(userId) ?? [];

  const { error } = await supabaseAdmin
    .from("users")
    .update({ is_active: false, cascade_suspended: false })
    .eq("id", userId);
  if (error) throw ApiError.internal(error.message);

  const cascaded = [];
  for (const school of assignments) {
    if (!school.is_active) continue; // already down for its own reasons — leave it
    cascaded.push({ ...(await deactivateOneSchool(school.id, true)), name: school.name });
  }

  return {
    admin: { id: admin.id, full_name: admin.full_name },
    schoolsDeactivated: cascaded,
    usersAffected: cascaded.reduce((sum, c) => sum + c.usersSuspended, 0),
  };
}

/**
 * Reactivates a school_admin. Only schools this admin's own deactivation took
 * down (cascade_suspended = true) come back; a school a super_admin
 * deactivated directly stays inactive until it is reactivated on its own.
 */
export async function activateSchoolAdmin(userId: string) {
  const admin = await assertIsSchoolAdmin(userId);
  const assignments = (await loadAssignmentsByAdmin([userId])).get(userId) ?? [];

  const { error } = await supabaseAdmin
    .from("users")
    .update({ is_active: true, cascade_suspended: false })
    .eq("id", userId);
  if (error) throw ApiError.internal(error.message);

  const { data: cascadedSchools, error: schoolError } = await supabaseAdmin
    .from("schools")
    .select("id, name")
    .in("id", assignments.length > 0 ? assignments.map((s) => s.id) : ["00000000-0000-0000-0000-000000000000"])
    .eq("cascade_suspended", true);
  if (schoolError) throw ApiError.internal(schoolError.message);

  const restored = [];
  for (const school of cascadedSchools ?? []) {
    restored.push({ ...(await activateOneSchool(school.id)), name: school.name });
  }

  return {
    admin: { id: admin.id, full_name: admin.full_name },
    schoolsReactivated: restored,
    usersAffected: restored.reduce((sum, r) => sum + r.usersRestored, 0),
    skippedSchools: assignments
      .filter((s) => !s.is_active && !(cascadedSchools ?? []).some((c) => c.id === s.id))
      .map((s) => ({ id: s.id, name: s.name })),
  };
}
