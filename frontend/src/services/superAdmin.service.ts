import { api } from "@/lib/axios";
import {
  AuditLogPage,
  CreateSchoolAdminInput,
  PlatformDashboard,
  PlatformSchool,
  SchoolAdmin,
  SchoolAdminImpact,
  SchoolOverview,
  SchoolsImpact,
} from "@/types/superAdmin.types";
import { School } from "@/types/admin.types";
import { CreateSchoolInput } from "@/services/admin/school.service";

/**
 * Platform-tier API client. Every endpoint here is behind
 * requireRole("super_admin") + a platform.* permission on the backend
 * (see backend/src/routes/superAdmin.routes.ts) — a school_admin calling any
 * of these gets a 403, so nothing in this file should be reachable from the
 * school-level console.
 */

// --- Dashboard --------------------------------------------------------------
export async function fetchDashboard(): Promise<PlatformDashboard> {
  const { data } = await api.get("/super-admin/dashboard");
  return data.data;
}

// --- Schools ----------------------------------------------------------------
export async function listSchools(): Promise<PlatformSchool[]> {
  const { data } = await api.get("/super-admin/schools");
  return data.data;
}

export async function fetchSchoolOverview(schoolId: string): Promise<SchoolOverview> {
  const { data } = await api.get(`/super-admin/schools/${schoolId}`);
  return data.data;
}

export async function createSchool(input: CreateSchoolInput): Promise<School> {
  const { data } = await api.post("/super-admin/schools", input);
  return data.data;
}

export async function updateSchool(schoolId: string, patch: Partial<School>): Promise<School> {
  const { data } = await api.patch(`/super-admin/schools/${schoolId}`, patch);
  return data.data;
}

/** Read-only preview for the confirmation dialog — changes nothing. */
export async function previewSchoolsImpact(schoolIds: string[]): Promise<SchoolsImpact> {
  const { data } = await api.post("/super-admin/schools/impact", { school_ids: schoolIds });
  return data.data;
}

export async function setSchoolsActive(schoolIds: string[], isActive: boolean) {
  const { data } = await api.post("/super-admin/schools/set-active", {
    school_ids: schoolIds,
    is_active: isActive,
  });
  return data.data as { usersAffected: number };
}

// --- School admins ----------------------------------------------------------
export async function listSchoolAdmins(filters: {
  search?: string;
  status?: "active" | "inactive";
  schoolId?: string;
}): Promise<SchoolAdmin[]> {
  const { data } = await api.get("/super-admin/school-admins", {
    params: { search: filters.search, status: filters.status, school_id: filters.schoolId },
  });
  return data.data;
}

export async function fetchSchoolAdmin(userId: string): Promise<SchoolAdmin> {
  const { data } = await api.get(`/super-admin/school-admins/${userId}`);
  return data.data;
}

export async function createSchoolAdmin(input: CreateSchoolAdminInput): Promise<SchoolAdmin> {
  const { data } = await api.post("/super-admin/school-admins", input);
  return data.data;
}

export async function updateSchoolAdmin(
  userId: string,
  patch: { full_name?: string; phone?: string | null; designation?: string | null; avatar_url?: string | null }
): Promise<SchoolAdmin> {
  const { data } = await api.patch(`/super-admin/school-admins/${userId}`, patch);
  return data.data;
}

/**
 * Sets a new password. The plaintext is never persisted or returned — the
 * caller shows it once at generation time and it exists nowhere afterwards.
 */
export async function resetSchoolAdminPassword(userId: string, password: string) {
  const { data } = await api.post(`/super-admin/school-admins/${userId}/reset-password`, { password });
  return data.data;
}

export async function assignSchools(userId: string, schoolIds: string[]): Promise<SchoolAdmin> {
  const { data } = await api.put(`/super-admin/school-admins/${userId}/schools`, { school_ids: schoolIds });
  return data.data;
}

export async function removeAssignment(userId: string, schoolId: string): Promise<SchoolAdmin> {
  const { data } = await api.delete(`/super-admin/school-admins/${userId}/schools/${schoolId}`);
  return data.data;
}

export async function previewSchoolAdminImpact(userId: string): Promise<SchoolAdminImpact> {
  const { data } = await api.get(`/super-admin/school-admins/${userId}/impact`);
  return data.data;
}

export async function deactivateSchoolAdmin(userId: string) {
  const { data } = await api.post(`/super-admin/school-admins/${userId}/deactivate`);
  return data.data as { schoolsDeactivated: { name: string }[]; usersAffected: number };
}

export async function activateSchoolAdmin(userId: string) {
  const { data } = await api.post(`/super-admin/school-admins/${userId}/activate`);
  return data.data as {
    schoolsReactivated: { name: string }[];
    skippedSchools: { name: string }[];
    usersAffected: number;
  };
}

// --- Audit log --------------------------------------------------------------
export async function fetchAuditLog(params: {
  page: number;
  pageSize: number;
  action?: string;
  schoolId?: string;
  search?: string;
}): Promise<AuditLogPage> {
  const { data } = await api.get("/super-admin/audit-log", {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      action: params.action,
      school_id: params.schoolId,
      search: params.search,
    },
  });
  return data.data;
}

export async function fetchAuditActions(): Promise<string[]> {
  const { data } = await api.get("/super-admin/audit-log/actions");
  return data.data;
}
