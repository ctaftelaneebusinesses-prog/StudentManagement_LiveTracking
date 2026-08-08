import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { PaginatedResult } from "@/types/admin.types";
import {
  BatchScope,
  ExtracurricularAchievement,
  ExtracurricularBatch,
  ExtracurricularBatchStudent,
  ExtracurricularDashboardStats,
  ExtracurricularGender,
  ExtracurricularScheduleSlot,
  ExtracurricularStaff,
  ExtracurricularStaffActivity,
  ExtracurricularStaffProfile,
} from "@/types/extracurricularStaff.types";

export interface ListStaffParams {
  search?: string;
  staff_type_activity_id?: string;
  activity_id?: string;
  status?: "active" | "inactive";
  class_id?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchExtracurricularStaffList(
  params: ListStaffParams = {}
): Promise<PaginatedResult<ExtracurricularStaff>> {
  const { data } = await api.get("/extracurricular-staff", { params });
  return data.data;
}

export async function fetchExtracurricularStaffMember(id: string): Promise<ExtracurricularStaffProfile> {
  const { data } = await api.get(`/extracurricular-staff/${id}`);
  return data.data;
}

export async function fetchExtracurricularDashboardStats(): Promise<ExtracurricularDashboardStats> {
  const { data } = await api.get("/extracurricular-staff/dashboard-stats");
  return data.data;
}

export interface CreateExtracurricularStaffInput {
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
  gender?: ExtracurricularGender;
  date_of_birth?: string;
  address?: string;
  staff_type_activity_id: string;
  qualification?: string;
  experience_years?: number;
  bio?: string;
  joining_date?: string;
}

export async function createExtracurricularStaff(
  input: CreateExtracurricularStaffInput
): Promise<ExtracurricularStaff> {
  const { data } = await api.post("/extracurricular-staff", input);
  return data.data;
}

export async function updateExtracurricularStaff(
  id: string,
  patch: Partial<CreateExtracurricularStaffInput> & { avatar_url?: string | null }
): Promise<ExtracurricularStaff> {
  const { data } = await api.patch(`/extracurricular-staff/${id}`, patch);
  return data.data;
}

export async function setExtracurricularStaffStatus(id: string, is_active: boolean): Promise<void> {
  await api.patch(`/extracurricular-staff/${id}/status`, { is_active });
}

/** Same `{staffId}/avatar.{ext}` convention and `avatars` bucket as uploadTeacherPhoto. */
export async function uploadExtracurricularStaffPhoto(staffId: string, file: File): Promise<ExtracurricularStaff> {
  const extension = file.name.split(".").pop();
  const path = `${staffId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return updateExtracurricularStaff(staffId, { avatar_url: data.publicUrl });
}

export async function assignActivities(
  staffId: string,
  activityIds: string[]
): Promise<ExtracurricularStaffActivity[]> {
  const { data } = await api.put(`/extracurricular-staff/${staffId}/activities`, { activity_ids: activityIds });
  return data.data;
}

export interface CreateBatchInput {
  activity_id: string;
  academic_year_id: string;
  class_id: string;
  scope: BatchScope;
  name?: string;
  student_ids?: string[];
}

export async function fetchStaffBatches(staffId: string): Promise<ExtracurricularBatch[]> {
  const { data } = await api.get(`/extracurricular-staff/${staffId}/batches`);
  return data.data;
}

export async function createBatch(staffId: string, input: CreateBatchInput): Promise<ExtracurricularBatch> {
  const { data } = await api.post(`/extracurricular-staff/${staffId}/batches`, input);
  return data.data;
}

export async function updateBatch(batchId: string, patch: Partial<CreateBatchInput>): Promise<ExtracurricularBatch> {
  const { data } = await api.patch(`/extracurricular-staff/batches/${batchId}`, patch);
  return data.data;
}

export async function deleteBatch(batchId: string): Promise<void> {
  await api.delete(`/extracurricular-staff/batches/${batchId}`);
}

export async function addBatchStudents(
  batchId: string,
  studentIds: string[]
): Promise<ExtracurricularBatchStudent[]> {
  const { data } = await api.post(`/extracurricular-staff/batches/${batchId}/students`, {
    student_ids: studentIds,
  });
  return data.data;
}

export async function removeBatchStudent(batchId: string, studentId: string): Promise<void> {
  await api.delete(`/extracurricular-staff/batches/${batchId}/students/${studentId}`);
}

export async function fetchStaffSchedule(staffId: string): Promise<ExtracurricularScheduleSlot[]> {
  const { data } = await api.get(`/extracurricular-staff/${staffId}/schedule`);
  return data.data;
}

export interface ScheduleSlotInput {
  batch_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue?: string;
}

export async function upsertScheduleSlot(input: ScheduleSlotInput): Promise<ExtracurricularScheduleSlot> {
  const { data } = await api.post("/extracurricular-staff/schedule", input);
  return data.data;
}

export async function deleteScheduleSlot(slotId: string): Promise<void> {
  await api.delete(`/extracurricular-staff/schedule/${slotId}`);
}

export async function fetchStaffAchievements(staffId: string): Promise<ExtracurricularAchievement[]> {
  const { data } = await api.get(`/extracurricular-staff/${staffId}/achievements`);
  return data.data;
}

export interface AddAchievementInput {
  activity_id?: string;
  student_id?: string;
  title: string;
  description?: string;
  achieved_on?: string;
  file_name: string;
  storage_path: string;
}

/** Uploads to the private `extracurricular-achievements` bucket, then records metadata via the backend (signed reads only). */
export async function uploadStaffAchievement(
  staffId: string,
  schoolId: string,
  file: File,
  meta: Omit<AddAchievementInput, "file_name" | "storage_path">
): Promise<ExtracurricularAchievement> {
  const path = `${schoolId}/${staffId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("extracurricular-achievements")
    .upload(path, file, { cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = await api.post(`/extracurricular-staff/${staffId}/achievements`, {
    ...meta,
    file_name: file.name,
    storage_path: path,
  });
  return data.data;
}

export async function deleteStaffAchievement(staffId: string, achievementId: string): Promise<void> {
  await api.delete(`/extracurricular-staff/${staffId}/achievements/${achievementId}`);
}
