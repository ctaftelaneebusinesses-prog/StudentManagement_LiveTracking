import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool } from "../utils/scopeGuards";

const PERIOD_SELECT =
  "id, class_id, day_of_week, period_no, subject_id, teacher_id, room_number, start_time, end_time, " +
  "period_type, activity_id, subjects(name, code), users(full_name), activities(name)";

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

interface UpsertPeriodInput {
  class_id: string;
  day_of_week: number;
  period_no: number;
  subject_id?: string;
  teacher_id?: string;
  room_number?: string;
  start_time: string;
  end_time: string;
  period_type: "academic" | "extracurricular";
  activity_id?: string;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * A teacher or room can legitimately be double-booked across two classes
 * whose `period_no` differs but whose actual clock times don't overlap —
 * so conflicts are found by real time-range overlap, not by period_no
 * equality, and only ever against OTHER classes (a same-class edit just
 * updates its own row via the upsert's natural key, never "conflicts" with
 * itself).
 */
async function assertNoSchedulingConflict(schoolId: string, input: UpsertPeriodInput): Promise<void> {
  if (input.teacher_id) {
    const { data, error } = await supabaseAdmin
      .from("timetable_periods")
      .select("start_time, end_time, classes(name, section)")
      .eq("school_id", schoolId)
      .eq("teacher_id", input.teacher_id)
      .eq("day_of_week", input.day_of_week)
      .neq("class_id", input.class_id)
      .lt("start_time", input.end_time)
      .gt("end_time", input.start_time)
      .limit(1);
    if (error) throw ApiError.internal(error.message);

    const conflict = data?.[0] as unknown as { start_time: string; end_time: string; classes: { name: string; section: string } | null };
    if (conflict) {
      const className = conflict.classes ? `${conflict.classes.name} - ${conflict.classes.section}` : "another class";
      throw ApiError.conflict(
        `This teacher is already teaching ${className} from ${formatTime(conflict.start_time)}–${formatTime(conflict.end_time)} on this day.`
      );
    }
  }

  if (input.room_number) {
    const { data, error } = await supabaseAdmin
      .from("timetable_periods")
      .select("start_time, end_time, classes(name, section)")
      .eq("school_id", schoolId)
      .eq("room_number", input.room_number)
      .eq("day_of_week", input.day_of_week)
      .neq("class_id", input.class_id)
      .lt("start_time", input.end_time)
      .gt("end_time", input.start_time)
      .limit(1);
    if (error) throw ApiError.internal(error.message);

    const conflict = data?.[0] as unknown as { start_time: string; end_time: string; classes: { name: string; section: string } | null };
    if (conflict) {
      const className = conflict.classes ? `${conflict.classes.name} - ${conflict.classes.section}` : "another class";
      throw ApiError.conflict(
        `Room ${input.room_number} is already in use by ${className} from ${formatTime(conflict.start_time)}–${formatTime(conflict.end_time)} on this day.`
      );
    }
  }
}

/**
 * Mirrors a period's teacher back onto class_subjects.teacher_id — the Subjects tab's
 * source of truth — so assigning a teacher from the Timetable stays in sync with the
 * Subjects list. Only propagates a real teacher (never blanks an existing assignment just
 * because one period was saved without picking a teacher yet).
 */
async function syncTeacherToClassSubject(classId: string, subjectId: string, teacherId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("class_subjects")
    .upsert({ class_id: classId, subject_id: subjectId, teacher_id: teacherId }, { onConflict: "class_id,subject_id" });
  if (error) throw ApiError.internal(error.message);
}

export async function upsertPeriod(schoolId: string, input: UpsertPeriodInput) {
  await assertClassInSchool(schoolId, input.class_id);
  await assertNoSchedulingConflict(schoolId, input);

  const { data, error } = await supabaseAdmin
    .from("timetable_periods")
    .upsert({ school_id: schoolId, ...input }, { onConflict: "class_id,day_of_week,period_no" })
    .select(PERIOD_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  if (input.period_type !== "extracurricular" && input.subject_id && input.teacher_id) {
    await syncTeacherToClassSubject(input.class_id, input.subject_id, input.teacher_id);
  }

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

/** Full weekly timetable across every class this teacher teaches, grouped by day (0 = Sunday .. 6 = Saturday) — the Teacher Portal's "My Timetable". */
export async function getWeeklyForTeacher(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("timetable_periods")
    .select(`${PERIOD_SELECT}, classes(name, section)`)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .order("day_of_week")
    .order("period_no");
  if (error) throw ApiError.internal(error.message);

  const periods = (data ?? []) as unknown as Period[];
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
