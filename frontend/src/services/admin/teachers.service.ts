import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { PaginatedResult, Teacher, TeacherAssignment } from "@/types/admin.types";

export interface ListTeachersParams {
  search?: string;
  qualification?: string;
  status?: "active" | "inactive";
  classId?: string;
  subjectId?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchTeachers(params: ListTeachersParams = {}): Promise<PaginatedResult<Teacher>> {
  const { data } = await api.get("/teachers", { params });
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
  password?: string;
  employee_id: string;
  qualification?: string;
  joining_date?: string;
  experience_years?: number;
}

export async function createTeacher(input: CreateTeacherInput): Promise<Teacher> {
  const { data } = await api.post("/teachers", input);
  return data.data;
}

export async function updateTeacher(
  id: string,
  patch: Partial<CreateTeacherInput> & { is_active?: boolean; avatar_url?: string | null }
): Promise<Teacher> {
  const { data } = await api.patch(`/teachers/${id}`, patch);
  return data.data;
}

export async function deactivateTeacher(id: string): Promise<void> {
  await api.delete(`/teachers/${id}`);
}

/** Same `{userId}/avatar.{ext}` convention and `avatars` bucket as uploadStudentPhoto. */
export async function uploadTeacherPhoto(teacherId: string, file: File): Promise<Teacher> {
  const extension = file.name.split(".").pop();
  const path = `${teacherId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return updateTeacher(teacherId, { avatar_url: data.publicUrl });
}

export async function deleteTeacherPhoto(teacherId: string): Promise<Teacher> {
  const extensions = ["jpg", "jpeg", "png", "webp", "gif"];
  await supabase.storage.from("avatars").remove(extensions.map((ext) => `${teacherId}/avatar.${ext}`));
  return updateTeacher(teacherId, { avatar_url: null });
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

export interface SubjectAssignmentInput {
  class_id: string;
  subject_id: string;
}

export async function bulkAssignSubjects(
  id: string,
  assignments: SubjectAssignmentInput[]
): Promise<TeacherAssignment[]> {
  const { data } = await api.post(`/teachers/${id}/assignments/bulk`, { assignments });
  return data.data;
}

export async function setHomeroomTeacher(id: string, classId: string, force = false) {
  const { data } = await api.post(`/teachers/${id}/homeroom`, { class_id: classId, force });
  return data.data;
}

export async function clearHomeroomTeacher(id: string): Promise<void> {
  await api.delete(`/teachers/${id}/homeroom`);
}
