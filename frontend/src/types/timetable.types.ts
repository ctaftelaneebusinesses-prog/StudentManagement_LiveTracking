export type TimetablePeriodType = "academic" | "extracurricular";

export interface TimetablePeriodEntry {
  id: string;
  class_id: string;
  day_of_week: number;
  period_no: number;
  subject_id: string | null;
  teacher_id: string | null;
  room_number: string | null;
  start_time: string;
  end_time: string;
  period_type: TimetablePeriodType;
  activity_id: string | null;
  subjects: { name: string; code: string } | null;
  users: { full_name: string } | null;
  activities: { name: string } | null;
}

export interface UpsertTimetablePeriodInput {
  class_id: string;
  day_of_week: number;
  period_no: number;
  subject_id?: string;
  teacher_id?: string;
  room_number?: string;
  start_time: string;
  end_time: string;
  period_type: TimetablePeriodType;
  activity_id?: string;
}

/** Sunday .. Saturday, matching the `day_of_week` (0-6) column. */
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** School-week display order — Monday first, Sunday hidden by default (most schools don't schedule classes then). */
export const SCHOOL_WEEK_DAYS = [1, 2, 3, 4, 5, 6] as const;
