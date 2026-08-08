export interface TimetableChangeProposedChange {
  subject_id?: string;
  room_number?: string;
  start_time?: string;
  end_time?: string;
}

export interface TimetableChangeRequest {
  id: string;
  class_id: string;
  period_id: string | null;
  teacher_id: string;
  day_of_week: number;
  period_no: number;
  proposed_change: TimetableChangeProposedChange;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  classes: { name: string; section: string } | null;
  users: { full_name: string } | null;
}
