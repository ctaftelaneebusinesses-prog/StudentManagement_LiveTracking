import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { BulkCreateStudentsResult, PaginatedResult, Student, StudentProfile } from "@/types/admin.types";

export interface ListStudentsParams {
  classId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchStudents(params: ListStudentsParams = {}): Promise<PaginatedResult<Student>> {
  const { data } = await api.get("/students", { params });
  return data.data;
}

/** Full profile — personal and class details. */
export async function fetchStudent(id: string): Promise<StudentProfile> {
  const { data } = await api.get(`/students/${id}`);
  return data.data;
}

export interface CreateStudentInput {
  email: string;
  full_name: string;
  phone?: string;
  password?: string;
  admission_no: string;
  roll_no?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  class_id?: string;
  place_of_birth?: string;
  nationality?: string;
  religion?: string;
  category?: string;
  city?: string;
  district?: string;
  state?: string;
  pin_code?: string;
  father_name?: string;
  father_phone?: string;
  father_email?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_email?: string;
  mother_occupation?: string;
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  const { data } = await api.post("/students", input);
  return data.data;
}

export interface UpdateStudentInput extends Partial<CreateStudentInput> {
  avatar_url?: string | null;
  blood_group?: string;
  allergies?: string;
  medical_conditions?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  doctor_name?: string;
  doctor_phone?: string;
}

export async function updateStudent(id: string, patch: UpdateStudentInput): Promise<Student> {
  const { data } = await api.patch(`/students/${id}`, patch);
  return data.data;
}

/**
 * Uploads a student's photo to the private `avatars` bucket, keyed as
 * `{studentId}/avatar.{ext}` so the `avatars_write_staff` storage policy
 * (which checks the uploader is staff in the same school as that user)
 * allows it, then persists the public URL on the student's user row.
 */
export async function uploadStudentPhoto(studentId: string, file: File): Promise<Student> {
  const extension = file.name.split(".").pop();
  const path = `${studentId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return updateStudent(studentId, { avatar_url: data.publicUrl });
}

/**
 * Removes a student's photo. Best-effort clears the object from the `avatars`
 * bucket for common extensions (mirrors the fixed `{studentId}/avatar.{ext}`
 * naming used by uploadStudentPhoto) before clearing `avatar_url`.
 */
export async function deleteStudentPhoto(studentId: string): Promise<Student> {
  const extensions = ["jpg", "jpeg", "png", "webp", "gif"];
  await supabase.storage.from("avatars").remove(extensions.map((ext) => `${studentId}/avatar.${ext}`));
  return updateStudent(studentId, { avatar_url: null });
}

export async function assignClass(id: string, classId: string): Promise<Student> {
  const { data } = await api.patch(`/students/${id}/class`, { class_id: classId });
  return data.data;
}

export async function deactivateStudent(id: string): Promise<void> {
  await api.delete(`/students/${id}`);
}

export async function activateStudent(id: string): Promise<Student> {
  const { data } = await api.post(`/students/${id}/activate`);
  return data.data;
}

export async function permanentlyDeleteStudent(id: string): Promise<void> {
  await api.delete(`/students/${id}/permanent`);
}

export async function bulkDeleteStudents(studentIds: string[]): Promise<{ deletedCount: number; requestedCount: number }> {
  const { data } = await api.post("/students/bulk-delete", { studentIds });
  return data.data;
}

export async function bulkCreateStudents(students: CreateStudentInput[]): Promise<BulkCreateStudentsResult> {
  const { data } = await api.post("/students/bulk", { students });
  return data.data;
}

/** Bulk-moves the given students into `classId` — the shared mechanic behind both Promote and Transfer. */
export async function bulkAssignClass(studentIds: string[], classId: string): Promise<{ updatedCount: number }> {
  const { data } = await api.post("/students/bulk-assign-class", { studentIds, classId });
  return data.data;
}
