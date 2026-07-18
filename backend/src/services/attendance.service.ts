import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool, assertStudentInSchool } from "../utils/scopeGuards";

type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "leave";

export async function upsertAttendance(
  schoolId: string,
  markedBy: string,
  input: { student_id: string; class_id: string; date: string; status: AttendanceStatus; remarks?: string }
) {
  await assertStudentInSchool(schoolId, input.student_id);

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .upsert(
      {
        school_id: schoolId,
        student_id: input.student_id,
        class_id: input.class_id,
        date: input.date,
        status: input.status,
        remarks: input.remarks,
        marked_by: markedBy,
      },
      { onConflict: "student_id,date" }
    )
    .select()
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function bulkUpsertAttendance(
  schoolId: string,
  markedBy: string,
  input: {
    class_id: string;
    date: string;
    records: { student_id: string; status: AttendanceStatus; remarks?: string }[];
  }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const rows = input.records.map((r) => ({
    school_id: schoolId,
    student_id: r.student_id,
    class_id: input.class_id,
    date: input.date,
    status: r.status,
    remarks: r.remarks,
    marked_by: markedBy,
  }));

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,date" })
    .select();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listForClass(schoolId: string, classId: string, date: string) {
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("id, student_id, status, remarks, students(admission_no, users(full_name))")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("date", date);
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Attendance across a date range for a whole class, most recent first — the class-level History view. */
export async function listHistoryForClass(schoolId: string, classId: string, from?: string, to?: string) {
  let query = supabaseAdmin
    .from("attendance")
    .select("id, student_id, date, status, remarks, students(admission_no, users(full_name))")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listForStudent(schoolId: string, studentId: string, from?: string, to?: string) {
  let query = supabaseAdmin
    .from("attendance")
    .select("id, date, status, remarks")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Defaults to the current calendar month when no range is given — the common dashboard view. */
export async function getSummaryForStudent(schoolId: string, studentId: string, from?: string, to?: string) {
  const now = new Date();
  const defaultFrom = from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = to ?? now.toISOString().slice(0, 10);

  const records = await listForStudent(schoolId, studentId, defaultFrom, defaultTo);

  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    absent: 0,
    late: 0,
    half_day: 0,
    leave: 0,
  };
  for (const record of records) {
    counts[record.status as AttendanceStatus] += 1;
  }

  const total = records.length;
  const presentEquivalent = counts.present + counts.late + counts.half_day * 0.5;
  const percentage = total > 0 ? Math.round((presentEquivalent / total) * 1000) / 10 : null;

  return { from: defaultFrom, to: defaultTo, total, counts, percentage, records: records.slice(0, 10) };
}
