import { api } from "@/lib/axios";
import {
  ClassAttendanceToday,
  ClassRoom,
  ClassSubject,
  PaginatedResult,
  Student,
  Subject,
} from "@/types/admin.types";

export async function fetchClasses(): Promise<ClassRoom[]> {
  const { data } = await api.get("/classes");
  return data.data;
}

export async function fetchClass(id: string): Promise<ClassRoom> {
  const { data } = await api.get(`/classes/${id}`);
  return data.data;
}

export async function fetchClassStudents(
  id: string,
  params: { search?: string; page?: number; pageSize?: number } = {}
): Promise<PaginatedResult<Student>> {
  const { data } = await api.get(`/classes/${id}/students`, { params });
  return data.data;
}

/** Today's per-student attendance roster for a class — reuses the same endpoint the teacher portal marks attendance against. */
export async function fetchClassAttendanceToday(classId: string): Promise<ClassAttendanceToday[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await api.get("/attendance/daily", { params: { class_id: classId, date: today } });
  return data.data;
}

export async function createClass(input: {
  name: string;
  section: string;
  academic_year_id: string;
  branch_id?: string;
  class_teacher_id?: string;
  capacity?: number;
  status?: "active" | "inactive";
}): Promise<ClassRoom> {
  const { data } = await api.post("/classes", input);
  return data.data;
}

export async function updateClass(id: string, patch: Partial<ClassRoom>): Promise<ClassRoom> {
  const { data } = await api.patch(`/classes/${id}`, patch);
  return data.data;
}

export async function deleteClass(id: string): Promise<void> {
  await api.delete(`/classes/${id}`);
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await api.get("/subjects");
  return data.data;
}

export async function createSubject(input: {
  name: string;
  code: string;
  description?: string;
  status?: "active" | "inactive";
}): Promise<Subject> {
  const { data } = await api.post("/subjects", input);
  return data.data;
}

export async function updateSubject(id: string, patch: Partial<Subject>): Promise<Subject> {
  const { data } = await api.patch(`/subjects/${id}`, patch);
  return data.data;
}

export async function deleteSubject(id: string): Promise<void> {
  await api.delete(`/subjects/${id}`);
}

export async function fetchClassSubjects(classId: string): Promise<ClassSubject[]> {
  const { data } = await api.get(`/classes/${classId}/subjects`);
  return data.data;
}

export async function assignSubjectToClass(
  classId: string,
  input: { subject_id: string; teacher_id?: string }
): Promise<ClassSubject> {
  const { data } = await api.post(`/classes/${classId}/subjects`, input);
  return data.data;
}

export async function removeSubjectFromClass(classId: string, subjectId: string): Promise<void> {
  await api.delete(`/classes/${classId}/subjects/${subjectId}`);
}
