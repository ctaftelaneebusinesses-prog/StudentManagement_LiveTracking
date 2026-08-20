import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import {
  AcademicYear,
  BackupSettings,
  Branch,
  Department,
  EmailSettings,
  Holiday,
  NotificationSettings,
  PlatformSchoolStats,
  School,
  SchoolProfileStats,
} from "@/types/admin.types";

export async function fetchMySchool(): Promise<School> {
  const { data } = await api.get("/schools/me");
  return data.data;
}

export async function updateMySchool(patch: Partial<School>): Promise<School> {
  const { data } = await api.patch("/schools/me", patch);
  return data.data;
}

// ----------------------------------------------------------------------------
// Platform-level School Management (super_admin only).
// ----------------------------------------------------------------------------

export async function listSchools(): Promise<School[]> {
  const { data } = await api.get("/schools");
  return data.data;
}

/**
 * The schools the caller may switch between — their own plus any
 * school_admin_schools assignments (066_super_admin_multi_school.sql). Scoped
 * server-side, so a school_admin never sees a school they don't manage.
 * Powers the school selector; use listSchools() only for platform-tier views.
 */
export async function listAssignedSchools(): Promise<School[]> {
  const { data } = await api.get("/schools/assigned");
  return data.data;
}

export interface CreateSchoolInput {
  name: string;
  code?: string;
  branch_name?: string;
  principal_name?: string;
  address?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  city?: string;
  district?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  logo_url?: string;
  is_active?: boolean;
  academic_year?: { name: string; start_date: string; end_date: string };
}

export async function createSchool(input: CreateSchoolInput): Promise<School> {
  const { data } = await api.post("/schools", input);
  return data.data;
}

export async function getSchoolById(id: string): Promise<School> {
  const { data } = await api.get(`/schools/${id}`);
  return data.data;
}

export async function updateSchoolById(id: string, patch: Partial<School>): Promise<School> {
  const { data } = await api.patch(`/schools/${id}`, patch);
  return data.data;
}

export async function deleteSchoolById(id: string, force = false): Promise<{ action: "deleted" | "deactivated" }> {
  const { data } = await api.delete(`/schools/${id}`, { params: force ? { force: true } : undefined });
  return data.data;
}

export async function fetchPlatformStats(): Promise<PlatformSchoolStats> {
  const { data } = await api.get("/schools/platform/stats");
  return data.data;
}

export async function fetchSchoolProfileStats(id: string): Promise<SchoolProfileStats> {
  const { data } = await api.get(`/schools/${id}/stats`);
  return data.data;
}

/**
 * Logo upload for the School Management create/edit flow — unlike
 * `uploadSchoolLogo` below (which always PATCHes `/schools/me`, i.e. only
 * ever the caller's own school), this just returns the public URL so the
 * caller can PATCH an arbitrary school (including a brand-new one) via
 * `updateSchoolById`.
 */
export async function uploadSchoolLogoFor(schoolId: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop();
  const path = `${schoolId}/logo.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("school-logos").getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await api.get("/schools/me/academic-years");
  return data.data;
}

export async function createAcademicYear(input: {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}): Promise<AcademicYear> {
  const { data } = await api.post("/schools/me/academic-years", input);
  return data.data;
}

export async function setCurrentAcademicYear(id: string): Promise<AcademicYear> {
  const { data } = await api.post(`/schools/me/academic-years/${id}/set-current`);
  return data.data;
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get("/schools/me/branches");
  return data.data;
}

export async function createBranch(input: {
  name: string;
  address?: string;
  is_main?: boolean;
}): Promise<Branch> {
  const { data } = await api.post("/schools/me/branches", input);
  return data.data;
}

export async function updateBranch(id: string, patch: Partial<Branch>): Promise<Branch> {
  const { data } = await api.patch(`/schools/me/branches/${id}`, patch);
  return data.data;
}

export async function deactivateBranch(id: string): Promise<void> {
  await api.delete(`/schools/me/branches/${id}`);
}

/**
 * Uploads a new school logo to the public "school-logos" bucket, keyed as
 * `{schoolId}/logo.{ext}` so the school_logos_write_staff storage policy
 * (checks the first path segment equals current_school_id()) allows it, then
 * saves the public URL on the school row via the existing update endpoint.
 */
export async function uploadSchoolLogo(schoolId: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop();
  const path = `${schoolId}/logo.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("school-logos").getPublicUrl(path);
  await updateMySchool({ logo_url: data.publicUrl });
  return data.publicUrl;
}

export async function updateAcademicYear(
  id: string,
  patch: Partial<{ name: string; start_date: string; end_date: string; is_current: boolean }>
): Promise<AcademicYear> {
  const { data } = await api.patch(`/schools/me/academic-years/${id}`, patch);
  return data.data;
}

// ----------------------------------------------------------------------------
// Settings (email/notifications/backup/workingDays — namespaced jsonb keys).
// ----------------------------------------------------------------------------

export async function updateSchoolSettings(key: string, value: unknown): Promise<School> {
  const { data } = await api.patch("/schools/me/settings", { key, value });
  return data.data;
}

export const updateEmailSettings = (value: EmailSettings) => updateSchoolSettings("email", value);
export const updateNotificationSettings = (value: NotificationSettings) => updateSchoolSettings("notifications", value);
export const updateBackupSettings = (value: BackupSettings) => updateSchoolSettings("backup", value);
export const updateWorkingDays = (value: number[]) => updateSchoolSettings("workingDays", value);
export const updateAttendanceSettings = (value: { teacherCheckinCutoff?: string }) => updateSchoolSettings("attendance", value);

export interface DefaultPeriodTiming {
  period_no: number;
  start_time: string;
  end_time: string;
}
export const updateDefaultPeriodTimings = (value: DefaultPeriodTiming[]) => updateSchoolSettings("defaultPeriodTimings", value);

export interface LeaveTypeLimits {
  casual: number;
  sick: number;
  other: number;
}
export interface RoleLeavePolicy {
  teacher: LeaveTypeLimits;
  principal: LeaveTypeLimits;
}
export const updateLeavePolicy = (value: RoleLeavePolicy) => updateSchoolSettings("leavePolicy", value);

// ----------------------------------------------------------------------------
// Departments
// ----------------------------------------------------------------------------

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await api.get("/schools/me/departments");
  return data.data;
}

export async function createDepartment(input: { name: string; description?: string; head_teacher_id?: string }): Promise<Department> {
  const { data } = await api.post("/schools/me/departments", input);
  return data.data;
}

export async function updateDepartment(id: string, patch: Partial<Department>): Promise<Department> {
  const { data } = await api.patch(`/schools/me/departments/${id}`, patch);
  return data.data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/schools/me/departments/${id}`);
}

// ----------------------------------------------------------------------------
// Holidays
// ----------------------------------------------------------------------------

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data } = await api.get("/schools/me/holidays");
  return data.data;
}

export async function createHoliday(input: {
  name: string;
  date: string;
  is_recurring_yearly?: boolean;
  academic_year_id?: string;
}): Promise<Holiday> {
  const { data } = await api.post("/schools/me/holidays", input);
  return data.data;
}

export async function updateHoliday(id: string, patch: Partial<Holiday>): Promise<Holiday> {
  const { data } = await api.patch(`/schools/me/holidays/${id}`, patch);
  return data.data;
}

export async function deleteHoliday(id: string): Promise<void> {
  await api.delete(`/schools/me/holidays/${id}`);
}

// ----------------------------------------------------------------------------
// Backup
// ----------------------------------------------------------------------------

export async function exportSchoolData(): Promise<Record<string, unknown>> {
  const { data } = await api.get("/schools/me/backup/export");
  return data.data;
}
