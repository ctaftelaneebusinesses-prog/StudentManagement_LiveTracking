import { supabaseAdmin } from "../config/supabase";
import { ROLE_ID } from "../config/roles";
import { ApiError } from "../utils/ApiError";
import { escapeOrFilterValue } from "../utils/searchFilter";
import { assertClassInSchool } from "../utils/scopeGuards";
import { provisionUser } from "../utils/provisionUser";
import { generateDefaultPassword } from "../utils/defaultPassword";
import * as notificationService from "./notification.service";

const STAFF_SELECT =
  "id, staff_code, staff_type_activity_id, gender, date_of_birth, address, joining_date, qualification, " +
  "experience_years, bio, created_at, updated_at, users(full_name, email, phone, avatar_url, is_active), " +
  "staff_type_activity:staff_type_activity_id(id, name, staff_title, category)";

// The aliased embed above (`staff_type_activity:staff_type_activity_id(...)`) is
// not parsed by supabase-js's schema-less select-type inference and collapses
// the whole row type to GenericStringError — define the real shape and cast
// immediately after the query (see homework.service.ts's HomeworkRow for the
// same established pattern).
interface StaffRow {
  id: string;
  staff_code: string;
  staff_type_activity_id: string;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  joining_date: string;
  qualification: string | null;
  experience_years: number | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
  staff_type_activity: { id: string; name: string; staff_title: string; category: string | null } | null;
}

const BATCH_SELECT =
  "id, school_id, staff_id, activity_id, academic_year_id, class_id, scope, name, created_at, updated_at, " +
  "activities(name, staff_title), classes(name, section), academic_years(name)";

const SLOT_SELECT =
  "id, school_id, batch_id, staff_id, day_of_week, start_time, end_time, venue, created_at, " +
  "extracurricular_batches(name, activity_id, class_id, activities(name), classes(name, section))";

// ---------------------------------------------------------------------------
// Tenant/ownership guards
// ---------------------------------------------------------------------------
export async function assertStaffInSchool(schoolId: string, staffId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff")
    .select("id")
    .eq("id", staffId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Extracurricular staff not found");
}

async function assertActivityInSchool(schoolId: string, activityId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("activities")
    .select("id, school_id")
    .eq("id", activityId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data || (data.school_id !== null && data.school_id !== schoolId)) {
    throw ApiError.notFound("Activity not found");
  }
}

async function assertAcademicYearInSchool(schoolId: string, academicYearId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .select("id")
    .eq("id", academicYearId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Academic year not found");
}

async function assertStudentsInClass(schoolId: string, classId: string, studentIds: string[]): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .in("id", studentIds);
  if (error) throw ApiError.internal(error.message);
  if ((data ?? []).length !== new Set(studentIds).size) {
    throw ApiError.badRequest("One or more students do not belong to this batch's class");
  }
}

// ---------------------------------------------------------------------------
// Staff CRUD
// ---------------------------------------------------------------------------
interface ListStaffFilters {
  search?: string;
  staff_type_activity_id?: string;
  activity_id?: string;
  status?: "active" | "inactive";
  class_id?: string;
  page: number;
  pageSize: number;
}

export async function listStaff(schoolId: string, filters: ListStaffFilters) {
  // `status` filters on the joined `users.is_active` column, which PostgREST
  // can't filter server-side alongside an embedded select in the same query
  // as pagination — resolved via a separate id lookup first, same approach
  // as teacher.service.ts::listTeachers.
  let statusUserIds: string[] | null = null;
  if (filters.status) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .eq("role_id", ROLE_ID.EXTRACURRICULAR_STAFF)
      .eq("is_active", filters.status === "active");
    if (error) throw ApiError.internal(error.message);
    statusUserIds = (data ?? []).map((u) => u.id as string);
    if (statusUserIds.length === 0) return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }

  let activityStaffIds: string[] | null = null;
  if (filters.activity_id) {
    const { data, error } = await supabaseAdmin
      .from("extracurricular_staff_activities")
      .select("staff_id")
      .eq("school_id", schoolId)
      .eq("activity_id", filters.activity_id);
    if (error) throw ApiError.internal(error.message);
    activityStaffIds = Array.from(new Set((data ?? []).map((r) => r.staff_id as string)));
    if (activityStaffIds.length === 0) return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }

  let classStaffIds: string[] | null = null;
  if (filters.class_id) {
    const { data, error } = await supabaseAdmin
      .from("extracurricular_batches")
      .select("staff_id")
      .eq("school_id", schoolId)
      .eq("class_id", filters.class_id);
    if (error) throw ApiError.internal(error.message);
    classStaffIds = Array.from(new Set((data ?? []).map((r) => r.staff_id as string)));
    if (classStaffIds.length === 0) return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }

  let query = supabaseAdmin
    .from("extracurricular_staff")
    .select(STAFF_SELECT, { count: "exact" })
    .eq("school_id", schoolId)
    .order("staff_code");

  if (filters.staff_type_activity_id) query = query.eq("staff_type_activity_id", filters.staff_type_activity_id);
  if (statusUserIds) query = query.in("id", statusUserIds);
  if (activityStaffIds) query = query.in("id", activityStaffIds);
  if (classStaffIds) query = query.in("id", classStaffIds);

  if (filters.search) {
    const pattern = escapeOrFilterValue(`%${filters.search}%`);

    // staff_code lives on `extracurricular_staff`; name/email live on the
    // joined `users` row — same two-step resolve-then-OR approach as
    // teacher.service.ts::listTeachers.
    const { data: matchingUsers, error: userSearchError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("school_id", schoolId)
      .eq("role_id", ROLE_ID.EXTRACURRICULAR_STAFF)
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
    if (userSearchError) throw ApiError.internal(userSearchError.message);

    const matchingIds = (matchingUsers ?? []).map((u) => u.id);
    const idFilter = matchingIds.length > 0 ? `,id.in.(${matchingIds.join(",")})` : "";
    query = query.or(`staff_code.ilike.${pattern}${idFilter}`);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);

  return { items: data ?? [], total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

/** Distinct students across a set of this staff member's batches — entire_class batches count everyone in the class, selected_students batches count only the hand-picked roster. */
async function countDistinctStudentsForBatches(
  schoolId: string,
  batches: { id: string; scope: string; class_id: string }[]
): Promise<number> {
  const studentIds = new Set<string>();

  const entireClassIds = Array.from(new Set(batches.filter((b) => b.scope === "entire_class").map((b) => b.class_id)));
  if (entireClassIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .in("class_id", entireClassIds);
    if (error) throw ApiError.internal(error.message);
    for (const row of data ?? []) studentIds.add(row.id as string);
  }

  const selectedBatchIds = batches.filter((b) => b.scope === "selected_students").map((b) => b.id);
  if (selectedBatchIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("extracurricular_batch_students")
      .select("student_id")
      .in("batch_id", selectedBatchIds);
    if (error) throw ApiError.internal(error.message);
    for (const row of data ?? []) studentIds.add(row.student_id as string);
  }

  return studentIds.size;
}

/** Last-30-days summary: distinct session dates run + average present-rate across all attendance rows this staff member has marked. */
async function getAttendanceSummary(schoolId: string, staffId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("extracurricular_attendance")
    .select("session_date, status")
    .eq("school_id", schoolId)
    .eq("staff_id", staffId)
    .gte("session_date", sinceDate);
  if (error) throw ApiError.internal(error.message);

  const rows = data ?? [];
  const sessionDates = new Set(rows.map((r) => r.session_date as string));
  const presentCount = rows.filter((r) => r.status === "present").length;
  const presentRate = rows.length > 0 ? Math.round((presentCount / rows.length) * 1000) / 10 : 0;

  return { sessionsRun: sessionDates.size, presentRate };
}

export async function getStaff(schoolId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff")
    .select(STAFF_SELECT)
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Extracurricular staff not found");

  const { data: activityRows, error: activityError } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select("id, staff_id, activity_id, status, assigned_at, completed_at, activities(id, name, staff_title, category)")
    .eq("staff_id", id)
    .eq("school_id", schoolId);
  if (activityError) throw ApiError.internal(activityError.message);

  const { data: batchRows, error: batchError } = await supabaseAdmin
    .from("extracurricular_batches")
    .select(BATCH_SELECT)
    .eq("staff_id", id)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (batchError) throw ApiError.internal(batchError.message);

  const batches = (batchRows ?? []) as unknown as { id: string; scope: string; class_id: string }[];
  const [studentCount, attendanceSummary] = await Promise.all([
    countDistinctStudentsForBatches(schoolId, batches),
    getAttendanceSummary(schoolId, id),
  ]);

  const staffRow = data as unknown as StaffRow;

  return {
    ...staffRow,
    assignedActivities: activityRows ?? [],
    batches: batchRows ?? [],
    studentCount,
    attendanceSummary,
  };
}

interface CreateStaffInput {
  email: string;
  full_name: string;
  phone?: string;
  password?: string;
  gender?: "male" | "female" | "other";
  date_of_birth?: string;
  address?: string;
  staff_type_activity_id: string;
  qualification?: string;
  experience_years?: number;
  bio?: string;
  joining_date?: string;
}

export async function createStaff(schoolId: string, input: CreateStaffInput) {
  const { data: staffCode, error: codeError } = await supabaseAdmin.rpc("next_extracurricular_staff_code", {
    p_school_id: schoolId,
  });
  if (codeError) throw ApiError.internal(codeError.message);

  const password = input.password || generateDefaultPassword(input.full_name, staffCode as string);
  const provisioned = await provisionUser({
    email: input.email,
    password,
    full_name: input.full_name,
    role_id: ROLE_ID.EXTRACURRICULAR_STAFF,
    school_id: schoolId,
  });

  if (input.phone) {
    await supabaseAdmin.from("users").update({ phone: input.phone }).eq("id", provisioned.id);
  }

  const { error: staffError } = await supabaseAdmin.from("extracurricular_staff").insert({
    id: provisioned.id,
    school_id: schoolId,
    staff_code: staffCode,
    staff_type_activity_id: input.staff_type_activity_id,
    gender: input.gender,
    date_of_birth: input.date_of_birth,
    address: input.address,
    qualification: input.qualification,
    experience_years: input.experience_years,
    bio: input.bio,
    joining_date: input.joining_date,
  });

  if (staffError) {
    await supabaseAdmin.auth.admin.deleteUser(provisioned.id);
    if (staffError.code === "23505") {
      throw ApiError.conflict("An extracurricular staff member with this staff code already exists");
    }
    throw ApiError.internal(staffError.message);
  }

  return getStaff(schoolId, provisioned.id);
}

export async function updateStaff(schoolId: string, id: string, patch: Record<string, unknown>) {
  const {
    full_name,
    phone,
    avatar_url,
    gender,
    date_of_birth,
    address,
    staff_type_activity_id,
    qualification,
    experience_years,
    bio,
  } = patch as {
    full_name?: string;
    phone?: string;
    avatar_url?: string | null;
    gender?: string;
    date_of_birth?: string;
    address?: string;
    staff_type_activity_id?: string;
    qualification?: string;
    experience_years?: number | null;
    bio?: string;
  };

  if (full_name !== undefined || phone !== undefined || avatar_url !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (full_name !== undefined) userPatch.full_name = full_name;
    if (phone !== undefined) userPatch.phone = phone;
    if (avatar_url !== undefined) userPatch.avatar_url = avatar_url;

    const { error } = await supabaseAdmin.from("users").update(userPatch).eq("id", id).eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  const staffPatch: Record<string, unknown> = {};
  if (gender !== undefined) staffPatch.gender = gender;
  if (date_of_birth !== undefined) staffPatch.date_of_birth = date_of_birth;
  if (address !== undefined) staffPatch.address = address;
  if (staff_type_activity_id !== undefined) staffPatch.staff_type_activity_id = staff_type_activity_id;
  if (qualification !== undefined) staffPatch.qualification = qualification;
  if (experience_years !== undefined) staffPatch.experience_years = experience_years;
  if (bio !== undefined) staffPatch.bio = bio;

  if (Object.keys(staffPatch).length > 0) {
    staffPatch.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("extracurricular_staff")
      .update(staffPatch)
      .eq("id", id)
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  return getStaff(schoolId, id);
}

export async function deactivateStaff(schoolId: string, id: string, isActive: boolean) {
  const { error } = await supabaseAdmin
    .from("users")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return getStaff(schoolId, id);
}

// ---------------------------------------------------------------------------
// Activity assignment
// ---------------------------------------------------------------------------
export async function assignActivities(schoolId: string, staffId: string, activityIds: string[], actorId: string) {
  await assertStaffInSchool(schoolId, staffId);

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select("id, activity_id")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId);
  if (existingError) throw ApiError.internal(existingError.message);

  const existing = existingRows ?? [];
  const newIds = new Set(activityIds);
  const toRemove = existing.filter((r) => !newIds.has(r.activity_id as string)).map((r) => r.id as string);
  const existingActivityIds = new Set(existing.map((r) => r.activity_id as string));
  const toAdd = activityIds.filter((activityId) => !existingActivityIds.has(activityId));

  if (toRemove.length > 0) {
    const { error } = await supabaseAdmin.from("extracurricular_staff_activities").delete().in("id", toRemove);
    if (error) throw ApiError.internal(error.message);
  }

  if (toAdd.length > 0) {
    const rows = toAdd.map((activityId) => ({
      school_id: schoolId,
      staff_id: staffId,
      activity_id: activityId,
      assigned_by: actorId,
    }));
    const { error } = await supabaseAdmin.from("extracurricular_staff_activities").insert(rows);
    if (error) throw ApiError.internal(error.message);

    await notifyNewlyAssignedStaff(schoolId, actorId, [staffId], toAdd);
  }

  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select("activity_id, assigned_at, activities(id, name, staff_title, category)")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/**
 * Notifies each of `staffIds` that they've been assigned to `activityIds` —
 * shared by both assignment entry points (assignActivities, staff-centric,
 * and assignStaffToActivity, activity-centric below), since both write the
 * same extracurricular_staff_activities join table and should behave
 * identically from the assignee's point of view. Fire-and-forget: a
 * notification failure must never fail the assignment itself.
 */
async function notifyNewlyAssignedStaff(schoolId: string, actorId: string, staffIds: string[], activityIds: string[]): Promise<void> {
  const { data: activities, error } = await supabaseAdmin.from("activities").select("name").in("id", activityIds);
  if (error) throw ApiError.internal(error.message);

  const names = (activities ?? []).map((a) => a.name as string);
  const activityLabel = names.length > 0 ? names.join(", ") : "a new activity";

  await notificationService.notifyUsers(schoolId, actorId, staffIds, {
    title: "New activity assigned",
    message: `You've been assigned to: ${activityLabel}`,
    type: "activity_assigned",
    metadata: { activityIds },
  });
}

/**
 * Activity-centric mirror of assignActivities above — given one activity,
 * full-replaces the set of staff assigned to it (diffed by staff_id instead
 * of by activity_id). Used when a principal/admin assigns teacher(s) to an
 * activity directly from the Activities page, rather than from a staff
 * member's own profile.
 */
export async function assignStaffToActivity(schoolId: string, activityId: string, staffIds: string[], actorId: string) {
  for (const staffId of staffIds) {
    await assertStaffInSchool(schoolId, staffId);
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select("id, staff_id")
    .eq("activity_id", activityId)
    .eq("school_id", schoolId);
  if (existingError) throw ApiError.internal(existingError.message);

  const existing = existingRows ?? [];
  const newIds = new Set(staffIds);
  const toRemove = existing.filter((r) => !newIds.has(r.staff_id as string)).map((r) => r.id as string);
  const existingStaffIds = new Set(existing.map((r) => r.staff_id as string));
  const toAdd = staffIds.filter((staffId) => !existingStaffIds.has(staffId));

  if (toRemove.length > 0) {
    const { error } = await supabaseAdmin.from("extracurricular_staff_activities").delete().in("id", toRemove);
    if (error) throw ApiError.internal(error.message);
  }

  if (toAdd.length > 0) {
    const rows = toAdd.map((staffId) => ({
      school_id: schoolId,
      staff_id: staffId,
      activity_id: activityId,
      assigned_by: actorId,
    }));
    const { error } = await supabaseAdmin.from("extracurricular_staff_activities").insert(rows);
    if (error) throw ApiError.internal(error.message);

    await notifyNewlyAssignedStaff(schoolId, actorId, toAdd, [activityId]);
  }

  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select("staff_id, assigned_at")
    .eq("activity_id", activityId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

// The aliased embed below (`extracurricular_staff:staff_id(...)`) is not
// parsed by supabase-js's schema-less select-type inference and collapses
// the whole row type to GenericStringError — define the real shape and cast
// immediately after the query (see homework.service.ts's HomeworkRow for the
// same established pattern).
interface ActivityAssignmentRow {
  id: string;
  staff_id: string;
  status: "assigned" | "completed";
  assigned_at: string;
  completed_at: string | null;
  extracurricular_staff: { staff_code: string; users: { full_name: string } | null } | null;
}

/**
 * Who's assigned to `activityId` and their completion status — the detail
 * view behind the Activities page's "Assignment" column (aggregate counts
 * only) so a principal/admin can see exactly which staff have marked their
 * assignment complete vs. which are still pending.
 */
export async function listActivityAssignments(schoolId: string, activityId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select("id, staff_id, status, assigned_at, completed_at, extracurricular_staff:staff_id(staff_code, users(full_name))")
    .eq("activity_id", activityId)
    .eq("school_id", schoolId)
    .order("assigned_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  const rows = (data ?? []) as unknown as ActivityAssignmentRow[];
  return rows.map((r) => ({
    id: r.id,
    staff_id: r.staff_id,
    staff_code: r.extracurricular_staff?.staff_code ?? "",
    full_name: r.extracurricular_staff?.users?.full_name ?? "",
    status: r.status,
    assigned_at: r.assigned_at,
    completed_at: r.completed_at,
  }));
}

// ---------------------------------------------------------------------------
// Batches ("Assign Classes")
// ---------------------------------------------------------------------------
async function getBatch(schoolId: string, batchId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_batches")
    .select(BATCH_SELECT)
    .eq("id", batchId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Batch not found");
  return data as unknown as { id: string; scope: string; class_id: string; staff_id: string; [key: string]: unknown };
}

export async function listBatches(schoolId: string, staffId?: string) {
  let query = supabaseAdmin
    .from("extracurricular_batches")
    .select(BATCH_SELECT)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (staffId) query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

interface CreateBatchInput {
  activity_id: string;
  academic_year_id: string;
  class_id: string;
  scope: "entire_class" | "selected_students";
  name?: string;
  student_ids?: string[];
}

export async function createBatch(schoolId: string, staffId: string, actorId: string, input: CreateBatchInput) {
  await assertStaffInSchool(schoolId, staffId);
  await assertActivityInSchool(schoolId, input.activity_id);
  await assertAcademicYearInSchool(schoolId, input.academic_year_id);
  await assertClassInSchool(schoolId, input.class_id);

  if (input.scope === "selected_students") {
    await assertStudentsInClass(schoolId, input.class_id, input.student_ids ?? []);
  }

  const { data: batch, error } = await supabaseAdmin
    .from("extracurricular_batches")
    .insert({
      school_id: schoolId,
      staff_id: staffId,
      activity_id: input.activity_id,
      academic_year_id: input.academic_year_id,
      class_id: input.class_id,
      scope: input.scope,
      name: input.name,
      created_by: actorId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw ApiError.conflict("This staff member already has a batch for this activity/class/academic year");
    }
    throw ApiError.internal(error.message);
  }

  if (input.scope === "selected_students" && input.student_ids && input.student_ids.length > 0) {
    const rows = input.student_ids.map((studentId) => ({ batch_id: batch.id, student_id: studentId }));
    const { error: studentsError } = await supabaseAdmin.from("extracurricular_batch_students").insert(rows);
    if (studentsError) throw ApiError.internal(studentsError.message);
  }

  return getBatch(schoolId, batch.id);
}

export async function updateBatch(schoolId: string, batchId: string, patch: { name?: string | null }) {
  await getBatch(schoolId, batchId);
  const { error } = await supabaseAdmin
    .from("extracurricular_batches")
    .update({ name: patch.name, updated_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
  return getBatch(schoolId, batchId);
}

export async function deleteBatch(schoolId: string, batchId: string) {
  await getBatch(schoolId, batchId);
  const { error } = await supabaseAdmin.from("extracurricular_batches").delete().eq("id", batchId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

export async function addBatchStudents(schoolId: string, batchId: string, studentIds: string[]) {
  const batch = await getBatch(schoolId, batchId);
  if (batch.scope !== "selected_students") {
    throw ApiError.badRequest("Students can only be added to a batch with scope 'selected_students'");
  }
  await assertStudentsInClass(schoolId, batch.class_id, studentIds);

  const rows = studentIds.map((studentId) => ({ batch_id: batchId, student_id: studentId }));
  const { error } = await supabaseAdmin
    .from("extracurricular_batch_students")
    .upsert(rows, { onConflict: "batch_id,student_id" });
  if (error) throw ApiError.internal(error.message);

  return getBatch(schoolId, batchId);
}

export async function removeBatchStudent(schoolId: string, batchId: string, studentId: string) {
  const batch = await getBatch(schoolId, batchId);
  if (batch.scope !== "selected_students") {
    throw ApiError.badRequest("Students can only be removed from a batch with scope 'selected_students'");
  }
  const { error } = await supabaseAdmin
    .from("extracurricular_batch_students")
    .delete()
    .eq("batch_id", batchId)
    .eq("student_id", studentId);
  if (error) throw ApiError.internal(error.message);
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Resolves the roster of a single batch — entire_class means every student in its class, selected_students means its hand-picked rows. */
async function resolveBatchStudentIds(schoolId: string, batch: { id: string; scope: string; class_id: string }): Promise<string[]> {
  if (batch.scope === "entire_class") {
    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", batch.class_id);
    if (error) throw ApiError.internal(error.message);
    return (data ?? []).map((r) => r.id as string);
  }

  const { data, error } = await supabaseAdmin.from("extracurricular_batch_students").select("student_id").eq("batch_id", batch.id);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((r) => r.student_id as string);
}

// ---------------------------------------------------------------------------
// Weekly schedule
// ---------------------------------------------------------------------------
export async function listScheduleSlots(schoolId: string, staffId?: string, batchId?: string) {
  let query = supabaseAdmin
    .from("extracurricular_schedule_slots")
    .select(SLOT_SELECT)
    .eq("school_id", schoolId)
    .order("day_of_week")
    .order("start_time");
  if (staffId) query = query.eq("staff_id", staffId);
  if (batchId) query = query.eq("batch_id", batchId);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

interface ScheduleSlotInput {
  batch_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue?: string;
}

/**
 * Inserts a new weekly recurring slot for the batch's staff member. Named
 * "upsert" per spec, but there's no natural key to upsert on besides `id`
 * (not part of the request body) — this is effectively insert-only, with an
 * application-level overlap check standing in for a DB exclusion constraint,
 * same approach as timetable.service.ts::assertNoSchedulingConflict.
 */
export async function upsertScheduleSlot(schoolId: string, input: ScheduleSlotInput) {
  const batch = await getBatch(schoolId, input.batch_id);

  const { data: conflictRows, error: conflictError } = await supabaseAdmin
    .from("extracurricular_schedule_slots")
    .select("id")
    .eq("school_id", schoolId)
    .eq("staff_id", batch.staff_id)
    .eq("day_of_week", input.day_of_week)
    .lt("start_time", input.end_time)
    .gt("end_time", input.start_time)
    .limit(1);
  if (conflictError) throw ApiError.internal(conflictError.message);
  if ((conflictRows ?? []).length > 0) {
    throw ApiError.conflict("Schedule slot overlaps with an existing slot");
  }

  const { data, error } = await supabaseAdmin
    .from("extracurricular_schedule_slots")
    .insert({
      school_id: schoolId,
      batch_id: input.batch_id,
      staff_id: batch.staff_id,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      venue: input.venue,
    })
    .select(SLOT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  const newSlot = data as unknown as { id: string };
  const studentIds = await resolveBatchStudentIds(schoolId, batch);
  const activityName = (batch as unknown as { activities?: { name: string } | null }).activities?.name ?? "Activity";
  await notificationService.notifyStudents(schoolId, batch.staff_id, studentIds, {
    title: `🏃 ${activityName} practice scheduled`,
    message: `Every ${DAY_NAMES[input.day_of_week]} at ${input.start_time.slice(0, 5)}${input.venue ? ` in ${input.venue}` : ""}.`,
    type: "activity_practice_scheduled",
    metadata: { slotId: newSlot.id, batchId: input.batch_id },
  });

  return data;
}

export async function deleteScheduleSlot(schoolId: string, slotId: string) {
  const { data, error: fetchError } = await supabaseAdmin
    .from("extracurricular_schedule_slots")
    .select("id, batch_id, day_of_week")
    .eq("id", slotId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!data) throw ApiError.notFound("Schedule slot not found");

  const { error } = await supabaseAdmin.from("extracurricular_schedule_slots").delete().eq("id", slotId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  const batch = await getBatch(schoolId, data.batch_id as string);
  const studentIds = await resolveBatchStudentIds(schoolId, batch);
  const activityName = (batch as unknown as { activities?: { name: string } | null }).activities?.name ?? "Activity";
  await notificationService.notifyStudents(schoolId, batch.staff_id, studentIds, {
    title: `🔔 ${activityName} schedule updated`,
    message: `Your ${DAY_NAMES[data.day_of_week as number]} practice slot has been removed.`,
    type: "activity_schedule_updated",
  });
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------
async function getStaffCounts(schoolId: string): Promise<{ totalStaff: number; activeStaff: number }> {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff")
    .select("id, users!inner(is_active)")
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  const rows = (data ?? []) as unknown as { id: string; users: { is_active: boolean } | null }[];
  return {
    totalStaff: rows.length,
    activeStaff: rows.filter((r) => r.users?.is_active).length,
  };
}

/** Today's JS day-of-week (0 = Sunday), matching the `day_of_week smallint` column. */
async function countStudentsTrainingToday(schoolId: string): Promise<number> {
  const todayDow = new Date().getDay();

  const { data: slots, error: slotsError } = await supabaseAdmin
    .from("extracurricular_schedule_slots")
    .select("batch_id, extracurricular_batches(id, scope, class_id)")
    .eq("school_id", schoolId)
    .eq("day_of_week", todayDow);
  if (slotsError) throw ApiError.internal(slotsError.message);

  const batches = (slots ?? [])
    .map((s) => s.extracurricular_batches as unknown as { id: string; scope: string; class_id: string } | null)
    .filter((b): b is { id: string; scope: string; class_id: string } => !!b);
  const uniqueBatches = Array.from(new Map(batches.map((b) => [b.id, b])).values());

  return countDistinctStudentsForBatches(schoolId, uniqueBatches);
}

export async function getDashboardStats(schoolId: string) {
  const [{ totalStaff, activeStaff }, activityAssignedRes, studentsTrainingToday] = await Promise.all([
    getStaffCounts(schoolId),
    supabaseAdmin.from("extracurricular_staff_activities").select("activity_id").eq("school_id", schoolId),
    countStudentsTrainingToday(schoolId),
  ]);
  if (activityAssignedRes.error) throw ApiError.internal(activityAssignedRes.error.message);

  const activitiesAssignedCount = new Set((activityAssignedRes.data ?? []).map((r) => r.activity_id as string)).size;

  return { totalStaff, activeStaff, activitiesAssignedCount, studentsTrainingToday };
}
