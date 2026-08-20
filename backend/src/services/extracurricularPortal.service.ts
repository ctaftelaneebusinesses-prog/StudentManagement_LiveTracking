import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertStaffOwnsBatch, assertStaffOwnsStudent, assertStaffOwnsActivityAssignment } from "../utils/extracurricularAccess";
import * as notificationService from "./notification.service";

/**
 * Self-service portal for a logged-in Extracurricular Staff member — every
 * query below is scoped to the calling `staffId`/`schoolId`, matching
 * teacherPortal.service.ts's convention (no RBAC gate; ownership is enforced
 * in code via extracurricularAccess.ts).
 */

interface OwnedBatchSlim {
  id: string;
  class_id: string;
  scope: "entire_class" | "selected_students";
}

/**
 * Total distinct students trained across a set of batches — for
 * `entire_class` batches every student in `class_id` counts; for
 * `selected_students` batches only the hand-picked rows in
 * `extracurricular_batch_students` count. A student in more than one batch is
 * only counted once.
 */
async function countDistinctStudents(schoolId: string, batches: OwnedBatchSlim[]): Promise<number> {
  if (batches.length === 0) return 0;
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

/** Own stats: activities assigned, batches run, total distinct students across them, and today's session count. */
export async function getDashboard(staffId: string, schoolId: string) {
  const [activitiesResult, batchesResult] = await Promise.all([
    supabaseAdmin
      .from("extracurricular_staff_activities")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", staffId)
      .eq("school_id", schoolId),
    supabaseAdmin
      .from("extracurricular_batches")
      .select("id, class_id, scope", { count: "exact" })
      .eq("staff_id", staffId)
      .eq("school_id", schoolId),
  ]);
  if (activitiesResult.error) throw ApiError.internal(activitiesResult.error.message);
  if (batchesResult.error) throw ApiError.internal(batchesResult.error.message);

  const batches = (batchesResult.data ?? []) as unknown as OwnedBatchSlim[];
  const totalStudents = await countDistinctStudents(schoolId, batches);

  const dayOfWeek = new Date().getDay(); // 0 = Sunday .. 6 = Saturday, matching extracurricular_schedule_slots.day_of_week
  const { count: todaySessionCount, error: scheduleError } = await supabaseAdmin
    .from("extracurricular_schedule_slots")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .eq("day_of_week", dayOfWeek);
  if (scheduleError) throw ApiError.internal(scheduleError.message);

  return {
    activitiesCount: activitiesResult.count ?? 0,
    batchesCount: batchesResult.count ?? 0,
    totalStudents,
    todaySessionCount: todaySessionCount ?? 0,
  };
}

interface ActivityRow {
  id: string;
  school_id: string | null;
  name: string;
  staff_title: string;
  category: string | null;
  is_custom: boolean;
  is_active: boolean;
  created_at: string;
}

interface RawStaffProfileRow {
  id: string;
  staff_code: string;
  staff_type_activity_id: string;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  bio: string | null;
  qualification: string | null;
  experience_years: number | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null } | null;
  activities: ActivityRow | null;
}

/**
 * Own profile — flattened to match `frontend/src/types/extracurricularPortal.types.ts`'s
 * `ExtracurricularPortalProfile` (a reduced, self-service view distinct from
 * the admin-side `ExtracurricularStaff` shape, which nests `users`).
 * `full_name`/`email`/`phone`/`avatar_url` live on `users`; everything else
 * on `extracurricular_staff`.
 */
export async function getProfile(staffId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff")
    .select(
      "id, staff_code, staff_type_activity_id, gender, date_of_birth, address, bio, qualification, experience_years, " +
        "users(full_name, email, phone, avatar_url), activities(id, school_id, name, staff_title, category, is_custom, is_active, created_at)"
    )
    .eq("id", staffId)
    .eq("school_id", schoolId)
    .single();
  if (error || !data) throw ApiError.notFound("Staff profile not found");
  const row = data as unknown as RawStaffProfileRow;

  return {
    id: row.id,
    staff_code: row.staff_code,
    full_name: row.users?.full_name ?? "",
    email: row.users?.email ?? "",
    phone: row.users?.phone ?? null,
    avatar_url: row.users?.avatar_url ?? null,
    gender: row.gender,
    date_of_birth: row.date_of_birth,
    address: row.address,
    bio: row.bio,
    qualification: row.qualification,
    experience_years: row.experience_years,
    staff_type_activity_id: row.staff_type_activity_id,
    activities: row.activities ?? undefined,
  };
}

/**
 * Self-service profile edit. `phone`/`avatar_url` live on `users`;
 * `address`/`bio` live on `extracurricular_staff`. `email`, `staff_code` and
 * `staff_type` are never accepted here — they stay admin-managed, matching
 * teacherPortal.service.ts::updateProfile keeping `employee_id`/qualification
 * out of the self-edit path. `avatar_url` is accepted (though the typed
 * `UpdatePortalProfileInput` on the frontend omits it) because
 * `extracurricularPortal.service.ts::uploadOwnPhoto` PATCHes it directly
 * after uploading to the shared `avatars` bucket, the same two-step flow
 * `uploadExtracurricularStaffPhoto` uses on the admin side.
 */
export async function updateProfile(
  staffId: string,
  schoolId: string,
  patch: { phone?: string | null; avatar_url?: string | null; address?: string | null; bio?: string | null }
) {
  const { phone, avatar_url, address, bio } = patch;

  if (phone !== undefined || avatar_url !== undefined) {
    const userPatch: Record<string, unknown> = {};
    if (phone !== undefined) userPatch.phone = phone;
    if (avatar_url !== undefined) userPatch.avatar_url = avatar_url;

    const { error } = await supabaseAdmin.from("users").update(userPatch).eq("id", staffId).eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  if (address !== undefined || bio !== undefined) {
    const staffPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (address !== undefined) staffPatch.address = address;
    if (bio !== undefined) staffPatch.bio = bio;

    const { error } = await supabaseAdmin
      .from("extracurricular_staff")
      .update(staffPatch)
      .eq("id", staffId)
      .eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
  }

  return getProfile(staffId, schoolId);
}

interface MyActivityRow {
  status: "assigned" | "completed";
  assigned_at: string;
  completed_at: string | null;
  assigned_by: string | null;
  activities: ActivityRow | null;
}

/**
 * Activities assigned to this staff member — either from the admin side
 * ("Assign Activities" on a staff profile) or the principal assigning
 * teacher(s) directly on the Activities page. Each row is flattened to the
 * `Activity` shape plus `status`/`assigned_at`/`completed_at`/`assigned_by_name`
 * so the portal can show a completion badge and "Mark complete" action.
 */
export async function getMyActivities(staffId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .select(
      "status, assigned_at, completed_at, assigned_by, activities(id, school_id, name, staff_title, category, is_custom, is_active, created_at)"
    )
    .eq("staff_id", staffId)
    .order("assigned_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  const rows = (data ?? []) as unknown as MyActivityRow[];
  const assignerIds = Array.from(new Set(rows.map((r) => r.assigned_by).filter((id): id is string => !!id)));

  let assignerNames = new Map<string, string>();
  if (assignerIds.length > 0) {
    const { data: assigners, error: assignerError } = await supabaseAdmin.from("users").select("id, full_name").in("id", assignerIds);
    if (assignerError) throw ApiError.internal(assignerError.message);
    assignerNames = new Map((assigners ?? []).map((u) => [u.id as string, u.full_name as string]));
  }

  return rows
    .filter((r): r is MyActivityRow & { activities: ActivityRow } => !!r.activities)
    .map((r) => ({
      ...r.activities,
      status: r.status,
      assigned_at: r.assigned_at,
      completed_at: r.completed_at,
      assigned_by_name: r.assigned_by ? (assignerNames.get(r.assigned_by) ?? null) : null,
    }));
}

/**
 * Marks this staff member's assignment to `activityId` as completed and
 * notifies whoever assigned it (typically the principal/admin who added the
 * activity) — the completion signal flows back the same way the assignment
 * notification flowed forward (`notifyUsers`), not a new mechanism.
 */
export async function markActivityCompleted(staffId: string, schoolId: string, activityId: string) {
  const assignment = await assertStaffOwnsActivityAssignment(staffId, activityId, schoolId);

  const { error } = await supabaseAdmin
    .from("extracurricular_staff_activities")
    .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: staffId })
    .eq("id", assignment.id);
  if (error) throw ApiError.internal(error.message);

  if (assignment.assigned_by) {
    const [{ data: staffUser }, { data: activity }] = await Promise.all([
      supabaseAdmin.from("users").select("full_name").eq("id", staffId).maybeSingle(),
      supabaseAdmin.from("activities").select("name").eq("id", activityId).maybeSingle(),
    ]);

    await notificationService.notifyUsers(schoolId, staffId, [assignment.assigned_by], {
      title: "Activity completed",
      message: `${staffUser?.full_name ?? "A staff member"} marked "${activity?.name ?? "an activity"}" as completed`,
      type: "activity_completed",
      metadata: { activityId },
    });
  }

  return getMyActivities(staffId).then((activities) => activities.find((a) => a.id === activityId));
}

interface BatchRow {
  id: string;
  school_id: string;
  staff_id: string;
  activity_id: string;
  academic_year_id: string;
  class_id: string;
  scope: "entire_class" | "selected_students";
  name: string | null;
  created_at: string;
  classes: { id: string; name: string; section: string } | null;
  activities: ActivityRow | null;
  academic_years: { name: string } | null;
}

/** Per-batch student count — entire_class batches count the class roster, selected_students batches count their hand-picked rows. Unlike countDistinctStudents (dashboard total), this is intentionally per-batch and not deduplicated across batches. */
async function getStudentCountsByBatch(batches: BatchRow[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  const entireClassBatches = batches.filter((b) => b.scope === "entire_class");
  const classIds = Array.from(new Set(entireClassBatches.map((b) => b.class_id)));
  if (classIds.length > 0) {
    const { data, error } = await supabaseAdmin.from("students").select("class_id").in("class_id", classIds);
    if (error) throw ApiError.internal(error.message);
    const perClass = new Map<string, number>();
    for (const row of data ?? []) {
      const classId = row.class_id as string;
      perClass.set(classId, (perClass.get(classId) ?? 0) + 1);
    }
    for (const batch of entireClassBatches) counts.set(batch.id, perClass.get(batch.class_id) ?? 0);
  }

  const selectedBatches = batches.filter((b) => b.scope === "selected_students");
  const selectedBatchIds = selectedBatches.map((b) => b.id);
  if (selectedBatchIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("extracurricular_batch_students")
      .select("batch_id")
      .in("batch_id", selectedBatchIds);
    if (error) throw ApiError.internal(error.message);
    const perBatch = new Map<string, number>();
    for (const row of data ?? []) {
      const batchId = row.batch_id as string;
      perBatch.set(batchId, (perBatch.get(batchId) ?? 0) + 1);
    }
    for (const batch of selectedBatches) counts.set(batch.id, perBatch.get(batch.id) ?? 0);
  }

  return counts;
}

/**
 * This staff member's batches ("Assign Classes"), each with a `student_count`
 * — field name and shape match `ExtracurricularBatch` in
 * `frontend/src/types/extracurricularStaff.types.ts` exactly (snake_case
 * `student_count`, not `studentCount`).
 */
export async function getMyBatches(staffId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_batches")
    .select(
      "id, school_id, staff_id, activity_id, academic_year_id, class_id, scope, name, created_at, " +
        "classes(id, name, section), activities(id, school_id, name, staff_title, category, is_custom, is_active, created_at), " +
        "academic_years(name)"
    )
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  const batches = (data ?? []) as unknown as BatchRow[];
  if (batches.length === 0) return [];

  const counts = await getStudentCountsByBatch(batches);
  return batches.map((batch) => ({ ...batch, student_count: counts.get(batch.id) ?? 0 }));
}

/**
 * Roster for one of this staff member's own batches, matching
 * `PortalBatchStudent` (`id, admission_no, roll_no, class_id, users: {
 * full_name, email, phone, avatar_url }`) in
 * `frontend/src/types/extracurricularPortal.types.ts` — every consumer
 * (ExtracurricularStudentsPage/AttendancePage/PracticeWorkPage/EventsPage/
 * AchievementsPage) reads `s.users.full_name`/`s.id`, so returning a flat
 * `{student_id, full_name}` shape here crashes their render as soon as a
 * batch actually has students (silently masked before, since no batch had
 * any). Ownership is checked first via `assertStaffOwnsBatch`.
 */
export async function getBatchStudents(staffId: string, batchId: string, schoolId: string) {
  const batch = await assertStaffOwnsBatch(staffId, batchId, schoolId);
  const STUDENT_SELECT = "id, admission_no, roll_no, class_id, users(full_name, email, phone, avatar_url)";

  if (batch.scope === "entire_class") {
    const { data, error } = await supabaseAdmin
      .from("students")
      .select(STUDENT_SELECT)
      .eq("school_id", schoolId)
      .eq("class_id", batch.class_id)
      .order("roll_no");
    if (error) throw ApiError.internal(error.message);
    return data ?? [];
  }

  const { data, error } = await supabaseAdmin
    .from("extracurricular_batch_students")
    .select(`students(${STUDENT_SELECT})`)
    .eq("batch_id", batchId);
  if (error) throw ApiError.internal(error.message);

  return ((data ?? []) as unknown as { students: Record<string, unknown> | null }[])
    .map((row) => row.students)
    .filter((s): s is NonNullable<typeof s> => !!s);
}

/** Today's recurring schedule slots across every batch this staff member runs. Field set matches `ExtracurricularScheduleSlot` exactly. */
export async function getTodaySchedule(staffId: string, schoolId: string) {
  const dayOfWeek = new Date().getDay();
  const { data, error } = await supabaseAdmin
    .from("extracurricular_schedule_slots")
    .select("id, batch_id, staff_id, day_of_week, start_time, end_time, venue")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .eq("day_of_week", dayOfWeek)
    .order("start_time");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/** The full recurring weekly schedule for this staff member, across every day. */
export async function getWeeklySchedule(staffId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_schedule_slots")
    .select("id, batch_id, staff_id, day_of_week, start_time, end_time, venue")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .order("day_of_week")
    .order("start_time");
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

interface MarkAttendanceInput {
  batch_id: string;
  session_date: string;
  records: { student_id: string; status: "present" | "absent" | "late" | "excused"; remarks?: string }[];
}

/** Bulk upsert of one session's attendance for a batch this staff member owns — one row per student, keyed on (batch_id, student_id, session_date). */
export async function markAttendance(staffId: string, schoolId: string, input: MarkAttendanceInput) {
  await assertStaffOwnsBatch(staffId, input.batch_id, schoolId);

  const rows = input.records.map((record) => ({
    school_id: schoolId,
    batch_id: input.batch_id,
    staff_id: staffId,
    student_id: record.student_id,
    session_date: input.session_date,
    status: record.status,
    remarks: record.remarks ?? null,
    marked_by: staffId,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from("extracurricular_attendance")
    .upsert(rows, { onConflict: "batch_id,student_id,session_date" })
    .select();
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

/**
 * Sessions run + average present-rate (0-100) over the last 30 days, for
 * this staff member's own dashboard/profile. Optionally narrowed to one
 * batch. Field names (`sessionsRun`, `presentRate`) match `AttendanceSummary`
 * in extracurricularPortal.types.ts and the admin side's
 * `ExtracurricularStaffProfile.attendanceSummary`.
 */
export async function getAttendanceSummary(staffId: string, schoolId: string, batchId?: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);

  let query = supabaseAdmin
    .from("extracurricular_attendance")
    .select("batch_id, session_date, status")
    .eq("staff_id", staffId)
    .eq("school_id", schoolId)
    .gte("session_date", sinceDate);
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  const rows = data ?? [];

  const distinctSessions = new Set(rows.map((row) => `${row.batch_id}:${row.session_date}`));
  const presentCount = rows.filter((row) => row.status === "present").length;
  const presentRate = rows.length > 0 ? Math.round((presentCount / rows.length) * 10000) / 100 : 0;

  return {
    sessionsRun: distinctSessions.size,
    presentRate,
  };
}

/**
 * Notifies a subset (or, when omitted, the entire roster) of a batch's
 * students. Shared by every action below that fans a notification out to
 * students — resolves the target list via `getBatchStudents`'s existing
 * entire_class/selected_students roster logic, so it always agrees with what
 * the staff member can actually see for that batch.
 */
async function notifyBatchStudents(
  staffId: string,
  schoolId: string,
  batchId: string,
  studentIds: string[] | undefined,
  input: { title: string; message: string; type: notificationService.NotificationType; metadata?: Record<string, unknown> }
): Promise<void> {
  const roster = (await getBatchStudents(staffId, batchId, schoolId)) as { id: string }[];
  const targetIds =
    studentIds && studentIds.length > 0
      ? roster.filter((s) => studentIds.includes(s.id)).map((s) => s.id)
      : roster.map((s) => s.id);
  if (targetIds.length === 0) return;
  await notificationService.notifyStudents(schoolId, staffId, targetIds, input);
}

interface AddPracticeWorkInput {
  batch_id: string;
  title: string;
  description?: string;
  due_date?: string;
  attachment_url?: string;
  /** Notify only these students instead of the whole batch roster. */
  student_ids?: string[];
}

/** Assign practice work to a batch this staff member owns, and notify the targeted students. */
export async function addPracticeWork(staffId: string, schoolId: string, input: AddPracticeWorkInput) {
  await assertStaffOwnsBatch(staffId, input.batch_id, schoolId);

  const { data, error } = await supabaseAdmin
    .from("extracurricular_practice_work")
    .insert({
      school_id: schoolId,
      batch_id: input.batch_id,
      staff_id: staffId,
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      attachment_url: input.attachment_url ?? null,
    })
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);

  await notifyBatchStudents(staffId, schoolId, input.batch_id, input.student_ids, {
    title: "📘 New practice work assigned",
    message: input.due_date ? `${input.title} — due ${input.due_date}` : input.title,
    type: "activity_practice_work_assigned",
    metadata: { practiceWorkId: data.id, batchId: input.batch_id },
  });

  return data;
}

/** Practice work this staff member has assigned, optionally narrowed to one batch. Field set matches `ExtracurricularPracticeWork` exactly. */
export async function listPracticeWork(staffId: string, batchId?: string) {
  let query = supabaseAdmin
    .from("extracurricular_practice_work")
    .select("id, batch_id, staff_id, title, description, due_date, attachment_url, created_at")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

interface CreateEventInput {
  activity_id?: string;
  batch_id?: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  /** Notify only these students instead of the whole batch roster. Ignored if `batch_id` is absent. */
  student_ids?: string[];
}

/** Create an activity event. If tied to a batch, ownership of that batch is checked first and the targeted students are notified. */
export async function createEvent(staffId: string, schoolId: string, input: CreateEventInput) {
  if (input.batch_id) {
    await assertStaffOwnsBatch(staffId, input.batch_id, schoolId);
  }

  const { data, error } = await supabaseAdmin
    .from("extracurricular_events")
    .insert({
      school_id: schoolId,
      staff_id: staffId,
      activity_id: input.activity_id ?? null,
      batch_id: input.batch_id ?? null,
      title: input.title,
      description: input.description ?? null,
      event_date: input.event_date,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      venue: input.venue ?? null,
    })
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);

  if (input.batch_id) {
    await notifyBatchStudents(staffId, schoolId, input.batch_id, input.student_ids, {
      title: `🏆 ${input.title}`,
      message: input.description || `Scheduled on ${input.event_date}${input.venue ? ` at ${input.venue}` : ""}.`,
      type: "activity_event",
      metadata: { eventId: data.id, batchId: input.batch_id },
    });
  }

  return data;
}

/** Events this staff member has created. Field set matches `ExtracurricularEvent` exactly. */
export async function listEvents(staffId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_events")
    .select(
      "id, staff_id, activity_id, batch_id, title, description, event_date, start_time, end_time, venue, " +
        "activities(name), extracurricular_batches(name, classes(name, section), academic_years(name))"
    )
    .eq("staff_id", staffId)
    .order("event_date", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

const ACHIEVEMENT_BUCKET = "extracurricular-achievements";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — private bucket, regenerated on every list/create, mirrors teacherDocument.service.ts.

/** `signed_url` (not `url`) to match `ExtracurricularAchievement.signed_url` on the frontend. */
async function withSignedUrl<T extends { storage_path: string }>(row: T) {
  const { data, error } = await supabaseAdmin.storage
    .from(ACHIEVEMENT_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...row, signed_url: error ? undefined : data?.signedUrl ?? undefined };
}

/** Achievements/certificates this staff member has uploaded (their own, or on behalf of a student they train). Field set matches `ExtracurricularAchievement` exactly. */
export async function listAchievements(staffId: string) {
  const { data, error } = await supabaseAdmin
    .from("extracurricular_achievements")
    .select("id, staff_id, activity_id, student_id, title, description, achieved_on, file_name, storage_path, uploaded_at")
    .eq("staff_id", staffId)
    .order("uploaded_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return Promise.all((data ?? []).map(withSignedUrl));
}

interface AddAchievementInput {
  activity_id?: string;
  /** One row is inserted per student (a shared certificate scan can be awarded to several students at once); empty/omitted means the staff member's own credential. */
  student_ids?: string[];
  title: string;
  description?: string;
  achieved_on?: string;
  file_name: string;
  storage_path: string;
}

/**
 * Records metadata for a certificate/achievement file the frontend has
 * already uploaded to the private `extracurricular-achievements` bucket,
 * keyed as `{school_id}/{staff_id}/{filename}` (see the storage policies in
 * 041_extracurricular_staff_module_extras.sql). Every given student must be
 * one this staff member actually trains, and each is notified + gets their
 * own achievement row.
 */
export async function addAchievement(staffId: string, schoolId: string, input: AddAchievementInput) {
  const expectedPrefix = `${schoolId}/${staffId}/`;
  if (!input.storage_path.startsWith(expectedPrefix)) {
    throw ApiError.badRequest("storage_path must be under the staff member's own folder");
  }

  const studentIds = Array.from(new Set(input.student_ids ?? []));
  for (const studentId of studentIds) {
    await assertStaffOwnsStudent(staffId, studentId, schoolId);
  }

  const rows = (studentIds.length > 0 ? studentIds : [null]).map((studentId) => ({
    school_id: schoolId,
    staff_id: staffId,
    activity_id: input.activity_id ?? null,
    student_id: studentId,
    title: input.title,
    description: input.description ?? null,
    achieved_on: input.achieved_on ?? null,
    file_name: input.file_name,
    storage_path: input.storage_path,
    uploaded_by: staffId,
  }));

  const { data, error } = await supabaseAdmin
    .from("extracurricular_achievements")
    .insert(rows)
    .select("id, staff_id, activity_id, student_id, title, description, achieved_on, file_name, storage_path, uploaded_at");
  if (error) throw ApiError.internal(error.message);

  if (studentIds.length > 0) {
    await notificationService.notifyStudents(schoolId, staffId, studentIds, {
      title: `🏅 Congratulations! You received "${input.title}"`,
      message: input.description || "A new certificate/achievement has been awarded to you.",
      type: "activity_certificate",
      metadata: { achievementIds: (data ?? []).map((r) => r.id) },
    });
  }

  const created = data ?? [];
  return Promise.all(created.map(withSignedUrl));
}
