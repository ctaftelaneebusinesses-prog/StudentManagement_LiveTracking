import { api } from "@/lib/axios";
import { ClassRoom, ClassSubject, Subject } from "@/types/admin.types";

export async function fetchClasses(): Promise<ClassRoom[]> {
  const { data } = await api.get("/classes");
  return data.data;
}

export async function createClass(input: {
  name: string;
  section: string;
  academic_year_id: string;
  branch_id?: string;
  class_teacher_id?: string;
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

export async function createSubject(input: { name: string; code: string }): Promise<Subject> {
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
