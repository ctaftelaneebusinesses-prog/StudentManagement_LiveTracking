import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import {
  ExtracurricularAchievement,
  ExtracurricularBatch,
  ExtracurricularEvent,
  ExtracurricularPracticeWork,
  ExtracurricularScheduleSlot,
  PortalActivity,
} from "@/types/extracurricularStaff.types";
import {
  AttendanceSummary,
  ExtracurricularPortalDashboard,
  ExtracurricularPortalProfile,
  MarkAttendanceInput,
  PortalBatchStudent,
} from "@/types/extracurricularPortal.types";
import { ExtracurricularTimetableDay } from "@/types/extracurricularPortal.types";

export async function fetchWeeklyTimetable(): Promise<ExtracurricularTimetableDay[]> {
  const { data } = await api.get("/extracurricular-portal/timetable");
  return data.data;
}

export async function fetchPortalDashboard(): Promise<ExtracurricularPortalDashboard> {
  const { data } = await api.get("/extracurricular-portal/dashboard");
  return data.data;
}

export async function fetchPortalProfile(): Promise<ExtracurricularPortalProfile> {
  const { data } = await api.get("/extracurricular-portal/profile");
  return data.data;
}

export interface UpdatePortalProfileInput {
  phone?: string;
  address?: string;
  bio?: string;
}

export async function updatePortalProfile(patch: UpdatePortalProfileInput): Promise<ExtracurricularPortalProfile> {
  const { data } = await api.patch("/extracurricular-portal/profile", patch);
  return data.data;
}

/** Same `{userId}/avatar.{ext}` convention as the admin-side upload — staff can self-upload their own photo. */
export async function uploadOwnPhoto(staffId: string, file: File): Promise<ExtracurricularPortalProfile> {
  const extension = file.name.split(".").pop();
  const path = `${staffId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // avatar_url lives on `users`, not the portal profile PATCH body's allowed
  // fields — read via a dedicated call rather than updatePortalProfile.
  await api.patch("/extracurricular-portal/profile", { avatar_url: data.publicUrl });
  return fetchPortalProfile();
}

export async function fetchMyActivities(): Promise<PortalActivity[]> {
  const { data } = await api.get("/extracurricular-portal/activities");
  return data.data;
}

export async function markActivityCompleted(activityId: string): Promise<PortalActivity> {
  const { data } = await api.patch(`/extracurricular-portal/activities/${activityId}/complete`);
  return data.data;
}

export async function fetchMyBatches(): Promise<ExtracurricularBatch[]> {
  const { data } = await api.get("/extracurricular-portal/batches");
  return data.data;
}

export async function fetchBatchStudents(batchId: string): Promise<PortalBatchStudent[]> {
  const { data } = await api.get(`/extracurricular-portal/batches/${batchId}/students`);
  return data.data;
}

export async function fetchTodaySchedule(): Promise<ExtracurricularScheduleSlot[]> {
  const { data } = await api.get("/extracurricular-portal/schedule/today");
  return data.data;
}

export async function fetchWeeklySchedule(): Promise<ExtracurricularScheduleSlot[]> {
  const { data } = await api.get("/extracurricular-portal/schedule");
  return data.data;
}

export async function markAttendance(input: MarkAttendanceInput): Promise<void> {
  await api.post("/extracurricular-portal/attendance", input);
}

export async function fetchAttendanceSummary(batchId?: string): Promise<AttendanceSummary> {
  const { data } = await api.get("/extracurricular-portal/attendance/summary", { params: { batch_id: batchId } });
  return data.data;
}

export async function fetchMyPracticeWork(batchId?: string): Promise<ExtracurricularPracticeWork[]> {
  const { data } = await api.get("/extracurricular-portal/practice-work", { params: { batch_id: batchId } });
  return data.data;
}

export interface CreatePracticeWorkInput {
  batch_id: string;
  title: string;
  description?: string;
  due_date?: string;
  attachment_url?: string;
  /** Notify only these students instead of the whole batch roster. */
  student_ids?: string[];
}

export async function createPracticeWork(input: CreatePracticeWorkInput): Promise<ExtracurricularPracticeWork> {
  const { data } = await api.post("/extracurricular-portal/practice-work", input);
  return data.data;
}

export async function fetchMyEvents(): Promise<ExtracurricularEvent[]> {
  const { data } = await api.get("/extracurricular-portal/events");
  return data.data;
}

export interface CreateEventInput {
  activity_id?: string;
  batch_id?: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  /** Notify only these students instead of the whole batch roster. Ignored if `batch_id` is absent. */
  student_ids?: string[];
}

export async function createEvent(input: CreateEventInput): Promise<ExtracurricularEvent> {
  const { data } = await api.post("/extracurricular-portal/events", input);
  return data.data;
}

export async function fetchMyAchievements(): Promise<ExtracurricularAchievement[]> {
  const { data } = await api.get("/extracurricular-portal/achievements");
  return data.data;
}

export interface UploadAchievementInput {
  activity_id?: string;
  /** Empty/omitted means the staff member's own credential; otherwise one achievement row + notification is created per student. */
  student_ids?: string[];
  title: string;
  description?: string;
  achieved_on?: string;
}

/** Uploads to the private `extracurricular-achievements` bucket, then records metadata via the backend (signed reads only). Returns one row per recipient (or one row for the staff member's own credential). */
export async function uploadAchievement(
  staffId: string,
  schoolId: string,
  file: File,
  meta: UploadAchievementInput
): Promise<ExtracurricularAchievement[]> {
  const path = `${schoolId}/${staffId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("extracurricular-achievements")
    .upload(path, file, { cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = await api.post("/extracurricular-portal/achievements", {
    ...meta,
    file_name: file.name,
    storage_path: path,
  });
  return data.data;
}
