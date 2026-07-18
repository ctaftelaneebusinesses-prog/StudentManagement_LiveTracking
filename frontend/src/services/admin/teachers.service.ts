import { api } from "@/lib/axios";
import { Teacher, TeacherAssignment } from "@/types/admin.types";

export async function fetchTeachers(): Promise<Teacher[]> {
  const { data } = await api.get("/teachers");
  return data.data;
}

export async function fetchTeacher(id: string): Promise<Teacher> {
  const { data } = await api.get(`/teachers/${id}`);
  return data.data;
}

export interface CreateTeacherInput {
  email: string;
  full_name: string;
  phone?: string;
  employee_id: string;
  qualification?: string;
  joining_date?: string;
}

export async function createTeacher(input: CreateTeacherInput): Promise<Teacher> {
  const { data } = await api.post("/teachers", input);
  return data.data;
}

export async function updateTeacher(id: string, patch: Partial<CreateTeacherInput>): Promise<Teacher> {
  const { data } = await api.patch(`/teachers/${id}`, patch);
  return data.data;
}

export async function deactivateTeacher(id: string): Promise<void> {
  await api.delete(`/teachers/${id}`);
}

export async function fetchTeacherAssignments(id: string): Promise<TeacherAssignment[]> {
  const { data } = await api.get(`/teachers/${id}/assignments`);
  return data.data;
}

export async function assignTeacherToClassSubject(
  id: string,
  classId: string,
  subjectId: string
): Promise<TeacherAssignment> {
  const { data } = await api.post(`/teachers/${id}/assignments`, { class_id: classId, subject_id: subjectId });
  return data.data;
}

export async function setHomeroomTeacher(id: string, classId: string) {
  const { data } = await api.post(`/teachers/${id}/homeroom`, { class_id: classId });
  return data.data;
}
