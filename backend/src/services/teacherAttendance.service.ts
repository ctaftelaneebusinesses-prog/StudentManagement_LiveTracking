import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { getSchool } from "./school.service";

export type TeacherAttendanceStatus = "present" | "absent" | "half_day" | "leave";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCheckinCutoff(settings: Record<string, unknown> | null): string | null {
  const attendance = (settings ?? {})["attendance"] as { teacherCheckinCutoff?: string } | undefined;
  return attendance?.teacherCheckinCutoff ?? null;
}

async function assertTeacherInSchool(schoolId: string, teacherId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("id")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Teacher not found");
}

/** All teachers in the school with their attendance status for one day (null status = not yet marked). */
export async function getDailyAttendance(schoolId: string, date: string) {
  const { data: teachers, error: teacherError } = await supabaseAdmin
    .from("teachers")
    .select("id, employee_id, users(full_name)")
    .eq("school_id", schoolId)
    .order("employee_id");
  if (teacherError) throw ApiError.internal(teacherError.message);

  const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
    .from("teacher_attendance")
    .select("id, teacher_id, status, remarks, check_in_at, check_out_at, updated_at")
    .eq("school_id", schoolId)
    .eq("date", date);
  if (attendanceError) throw ApiError.internal(attendanceError.message);

  const attendanceByTeacher = new Map(
    (attendanceRows ?? []).map((row) => [row.teacher_id, row])
  );

  return (teachers ?? []).map((teacher) => {
    const record = attendanceByTeacher.get(teacher.id);
    return {
      teacher_id: teacher.id,
      teacher_name: (teacher as unknown as { users: { full_name: string } }).users?.full_name ?? "",
      employee_id: teacher.employee_id,
      attendance_id: record?.id ?? null,
      status: record?.status ?? null,
      remarks: record?.remarks ?? null,
      check_in_at: record?.check_in_at ?? null,
      check_out_at: record?.check_out_at ?? null,
      updated_at: record?.updated_at ?? null,
    };
  });
}

/** Per-teacher present/absent/half_day/leave counts for every teacher in the school, for one calendar month ("YYYY-MM"). */
export async function getMonthlySummary(schoolId: string, month: string) {
  const monthStart = `${month}-01`;
  const [year, mon] = month.split("-").map(Number);
  const monthEnd = new Date(year, mon, 0).toISOString().slice(0, 10);

  const { data: teachers, error: teacherError } = await supabaseAdmin
    .from("teachers")
    .select("id, employee_id, users(full_name)")
    .eq("school_id", schoolId)
    .order("employee_id");
  if (teacherError) throw ApiError.internal(teacherError.message);

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("teacher_attendance")
    .select("teacher_id, status")
    .eq("school_id", schoolId)
    .gte("date", monthStart)
    .lte("date", monthEnd);
  if (rowsError) throw ApiError.internal(rowsError.message);

  const countsByTeacher = new Map<string, { present: number; absent: number; half_day: number; leave: number }>();
  for (const row of rows ?? []) {
    const counts = countsByTeacher.get(row.teacher_id) ?? { present: 0, absent: 0, half_day: 0, leave: 0 };
    if (row.status in counts) counts[row.status as keyof typeof counts] += 1;
    countsByTeacher.set(row.teacher_id, counts);
  }

  return (teachers ?? []).map((teacher) => {
    const counts = countsByTeacher.get(teacher.id) ?? { present: 0, absent: 0, half_day: 0, leave: 0 };
    return {
      teacher_id: teacher.id,
      teacher_name: (teacher as unknown as { users: { full_name: string } }).users?.full_name ?? "",
      employee_id: teacher.employee_id,
      ...counts,
      total: counts.present + counts.absent + counts.half_day + counts.leave,
    };
  });
}

export async function markAttendance(
  schoolId: string,
  markedBy: string,
  input: { teacher_id: string; date: string; status: TeacherAttendanceStatus; remarks?: string }
) {
  await assertTeacherInSchool(schoolId, input.teacher_id);

  const { data, error } = await supabaseAdmin
    .from("teacher_attendance")
    .upsert(
      {
        school_id: schoolId,
        teacher_id: input.teacher_id,
        date: input.date,
        status: input.status,
        remarks: input.remarks ?? null,
        marked_by: markedBy,
        updated_by: markedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "teacher_id,date" }
    )
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listForTeacher(schoolId: string, teacherId: string, from?: string, to?: string) {
  await assertTeacherInSchool(schoolId, teacherId);

  let query = supabaseAdmin
    .from("teacher_attendance")
    .select("id, date, status, remarks, check_in_at, check_out_at")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data ?? [];
}

export async function getSummaryForTeacher(schoolId: string, teacherId: string) {
  await assertTeacherInSchool(schoolId, teacherId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("teacher_attendance")
    .select("status")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .gte("date", monthStart);
  if (error) throw ApiError.internal(error.message);

  const counts = { present: 0, absent: 0, half_day: 0, leave: 0 };
  for (const row of data ?? []) {
    if (row.status in counts) counts[row.status as keyof typeof counts] += 1;
  }
  return { ...counts, total: (data ?? []).length, from: monthStart };
}

/** Today's self-service check-in/out state for the calling teacher, plus the school's configured cutoff (if any). */
export async function getTodayStatus(schoolId: string, teacherId: string) {
  await assertTeacherInSchool(schoolId, teacherId);

  const date = todayDate();
  const [{ data, error }, school] = await Promise.all([
    supabaseAdmin
      .from("teacher_attendance")
      .select("status, check_in_at, check_out_at")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherId)
      .eq("date", date)
      .maybeSingle(),
    getSchool(schoolId),
  ]);
  if (error) throw ApiError.internal(error.message);

  return {
    date,
    status: data?.status ?? null,
    check_in_at: data?.check_in_at ?? null,
    check_out_at: data?.check_out_at ?? null,
    checkin_cutoff: getCheckinCutoff(school.settings as Record<string, unknown> | null),
  };
}

/**
 * Teacher taps "Check In". Always sets status back to 'present', so a late
 * arrival after the auto-absent job already ran for the day overrides it —
 * the record reflects "did they show up at all today", not a hard cutoff
 * lockout.
 */
export async function checkIn(schoolId: string, teacherId: string) {
  await assertTeacherInSchool(schoolId, teacherId);

  const { data, error } = await supabaseAdmin
    .from("teacher_attendance")
    .upsert(
      {
        school_id: schoolId,
        teacher_id: teacherId,
        date: todayDate(),
        status: "present",
        check_in_at: new Date().toISOString(),
        marked_by: teacherId,
        updated_by: teacherId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "teacher_id,date" }
    )
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Teacher taps "Check Out". Requires an existing check-in row for today. */
export async function checkOut(schoolId: string, teacherId: string) {
  await assertTeacherInSchool(schoolId, teacherId);

  const date = todayDate();
  const { data: existing, error: findError } = await supabaseAdmin
    .from("teacher_attendance")
    .select("id, check_in_at")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .eq("date", date)
    .maybeSingle();
  if (findError) throw ApiError.internal(findError.message);
  if (!existing || !existing.check_in_at) throw ApiError.badRequest("Check in before checking out");

  const { data, error } = await supabaseAdmin
    .from("teacher_attendance")
    .update({
      check_out_at: new Date().toISOString(),
      updated_by: teacherId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

/**
 * Auto-absent sweep for one school: any teacher with no attendance row yet
 * for `date` is marked absent. Called by the scheduler once a school's
 * configured cutoff time has passed for the day. Safe to call more than
 * once — teachers who check in afterward simply upsert over this row.
 */
export async function autoMarkAbsentees(schoolId: string, date: string): Promise<number> {
  const [{ data: teachers, error: teacherError }, { data: marked, error: markedError }] = await Promise.all([
    supabaseAdmin.from("teachers").select("id").eq("school_id", schoolId),
    supabaseAdmin.from("teacher_attendance").select("teacher_id").eq("school_id", schoolId).eq("date", date),
  ]);
  if (teacherError) throw ApiError.internal(teacherError.message);
  if (markedError) throw ApiError.internal(markedError.message);

  const markedIds = new Set((marked ?? []).map((row) => row.teacher_id));
  const unmarked = (teachers ?? []).filter((t) => !markedIds.has(t.id));
  if (unmarked.length === 0) return 0;

  const { error: insertError } = await supabaseAdmin.from("teacher_attendance").insert(
    unmarked.map((t) => ({
      school_id: schoolId,
      teacher_id: t.id,
      date,
      status: "absent" as const,
      marked_by: null,
    }))
  );
  if (insertError) throw ApiError.internal(insertError.message);
  return unmarked.length;
}
