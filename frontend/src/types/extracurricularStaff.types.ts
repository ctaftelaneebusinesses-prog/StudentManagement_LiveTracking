export interface Activity {
  id: string;
  school_id: string | null;
  name: string;
  staff_title: string;
  category: string | null;
  is_custom: boolean;
  is_active: boolean;
  created_at: string;
  /** Only present on rows from GET /activities (listActivities) — counts of this school's staff assignments for this activity, by status. */
  assignedPendingCount?: number;
  assignedCompletedCount?: number;
}

export type ExtracurricularGender = "male" | "female" | "other";

export interface ExtracurricularStaff {
  id: string;
  school_id: string;
  staff_code: string;
  staff_type_activity_id: string;
  gender: ExtracurricularGender | null;
  date_of_birth: string | null;
  address: string | null;
  joining_date: string;
  qualification: string | null;
  experience_years: number | null;
  bio: string | null;
  users: { full_name: string; email: string; phone: string | null; avatar_url: string | null; is_active: boolean };
  staff_type_activity?: Activity | null; // staff_type_activity_id join
}

export type ActivityAssignmentStatus = "assigned" | "completed";

/** One staff member's assignment to a given activity — returned by GET /activities/:id/assignments (listActivityAssignments), the detail view behind the Activities page's aggregate "Assignment" column. */
export interface ActivityAssignment {
  id: string;
  staff_id: string;
  staff_code: string;
  full_name: string;
  status: ActivityAssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
}

export interface ExtracurricularStaffActivity {
  id: string;
  staff_id: string;
  activity_id: string;
  status?: ActivityAssignmentStatus;
  assigned_at: string;
  completed_at?: string | null;
  activities: Activity;
}

/** Shape returned by GET /extracurricular-portal/activities (getMyActivities) — the master Activity fields flattened together with this staff member's own assignment status. */
export interface PortalActivity extends Activity {
  status: ActivityAssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
  assigned_by_name: string | null;
}

export type BatchScope = "entire_class" | "selected_students";

export interface ExtracurricularBatch {
  id: string;
  school_id: string;
  staff_id: string;
  activity_id: string;
  academic_year_id: string;
  class_id: string;
  scope: BatchScope;
  name: string | null;
  created_at: string;
  activities?: Activity;
  classes?: { id: string; name: string; section: string };
  /** Joined via the batch's own `academic_year_id` FK — NOT via `classes`, which dropped its `academic_year` text column (migration 005) in favor of `classes.academic_year_id`. */
  academic_years?: { name: string };
  student_count?: number;
  /** Actual field name returned by GET /extracurricular-portal/batches (getMyBatches) — student_count above is unused by that endpoint. */
  studentCount?: number;
}

export interface ExtracurricularBatchStudent {
  id: string;
  batch_id: string;
  student_id: string;
  students?: {
    id: string;
    admission_no: string;
    roll_no: string | null;
    users: { full_name: string };
  };
}

export interface ExtracurricularScheduleSlot {
  id: string;
  batch_id: string;
  staff_id: string;
  day_of_week: number; // 0 = Sunday
  start_time: string;
  end_time: string;
  venue: string | null;
  /**
   * Joined batch/activity/class summary — present on the rows returned by
   * GET /extracurricular-portal/schedule(/today) (getTodaySchedule /
   * getWeeklySchedule) but absent from a bare schedule-slot row, so it's
   * optional here.
   */
  extracurricular_batches?: {
    id: string;
    name: string | null;
    scope: BatchScope;
    class_id: string;
    classes?: { name: string; section: string } | null;
    activities?: { name: string; staff_title: string } | null;
  } | null;
}

export type ExtracurricularAttendanceStatus = "present" | "absent" | "late" | "excused";

export interface ExtracurricularAttendanceRow {
  id: string;
  batch_id: string;
  student_id: string;
  session_date: string;
  status: ExtracurricularAttendanceStatus;
  remarks: string | null;
}

export interface ExtracurricularPracticeWork {
  id: string;
  batch_id: string;
  staff_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  attachment_url: string | null;
  created_at: string;
  /** Joined batch/class summary — present on rows from GET /extracurricular-portal/practice-work (listPracticeWork). */
  extracurricular_batches?: {
    name: string | null;
    class_id: string;
    classes?: { name: string; section: string } | null;
  } | null;
}

export interface ExtracurricularEvent {
  id: string;
  staff_id: string;
  activity_id: string | null;
  batch_id: string | null;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  /** Joined names — present on rows from GET /extracurricular-portal/events (listEvents). */
  activities?: { name: string } | null;
  extracurricular_batches?: {
    name: string | null;
    classes?: { name: string; section: string } | null;
    academic_years?: { name: string } | null;
  } | null;
}

export interface ExtracurricularAchievement {
  id: string;
  staff_id: string;
  activity_id: string | null;
  student_id: string | null;
  title: string;
  description: string | null;
  achieved_on: string | null;
  file_name: string;
  storage_path: string;
  signed_url?: string;
  /** Actual field name returned by the portal endpoints (listAchievements/addAchievement via withSignedUrl) — signed_url above is unused by those. */
  url?: string | null;
  uploaded_at: string;
}

export interface ExtracurricularDashboardStats {
  totalStaff: number;
  activeStaff: number;
  activitiesAssignedCount: number;
  studentsTrainingToday: number;
}

export interface ExtracurricularStaffProfile extends ExtracurricularStaff {
  assignedActivities: ExtracurricularStaffActivity[];
  batches: ExtracurricularBatch[];
  studentCount: number;
  attendanceSummary: { sessionsRun: number; presentRate: number };
}
