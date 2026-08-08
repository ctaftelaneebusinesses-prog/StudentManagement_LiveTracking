import { api } from "@/lib/axios";

export interface TeacherAssignment {
  id: string;
  class_id: string;
  subject_id: string;
  classes: { name: string; section: string; academic_years?: { name: string } } | null;
  subjects: { name: string; code: string } | null;
}

/** This teacher's own class+subject slots — used to restrict pickers (e.g. Syllabus upload) to only what they're actually assigned to teach. */
export async function fetchMyAssignments(): Promise<TeacherAssignment[]> {
  const { data } = await api.get("/teacher-portal/my-assignments");
  return data.data;
}
