import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool } from "../utils/scopeGuards";

const PERIOD_SELECT =
  "id, class_id, day_of_week, period_no, subject_id, teacher_id, start_time, end_time, " +
  "subjects(name, code), users(full_name)";

export async function listForClass(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("timetable_periods")
    .select(PERIOD_SELECT)
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("day_of_week")
    .order("period_no");
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function upsertPeriod(
  schoolId: string,
  input: {
    class_id: string;
    day_of_week: number;
    period_no: number;
    subject_id?: string;
    teacher_id?: string;
    start_time: string;
    end_time: string;
  }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const { data, error } = await supabaseAdmin
    .from("timetable_periods")
    .upsert({ school_id: schoolId, ...input }, { onConflict: "class_id,day_of_week,period_no" })
    .select(PERIOD_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function deletePeriod(schoolId: string, periodId: string) {
  const { error } = await supabaseAdmin
    .from("timetable_periods")
    .delete()
    .eq("id", periodId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

interface Period {
  day_of_week: number;
  [key: string]: unknown;
}

/** Full weekly timetable for the student's own class, grouped by day (0 = Sunday .. 6 = Saturday). */
export async function getWeeklyForStudent(schoolId: string, studentId: string) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student?.class_id) return [];

  const periods = (await listForClass(schoolId, student.class_id)) as unknown as Period[];

  const byDay = new Map<number, Period[]>();
  for (const period of periods) {
    const day = period.day_of_week;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(period);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayOfWeek, dayPeriods]) => ({ dayOfWeek, periods: dayPeriods }));
}
