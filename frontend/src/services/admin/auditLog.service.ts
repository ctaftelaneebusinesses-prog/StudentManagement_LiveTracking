import { api } from "@/lib/axios";
import { ActivityLogEntry, LoginHistoryEntry } from "@/types/admin.types";
import { PaginatedResult } from "@/types/fees.types";

export async function fetchLoginHistory(params: { page: number; pageSize: number }): Promise<PaginatedResult<LoginHistoryEntry>> {
  const { data } = await api.get("/audit/login-history", { params });
  return data.data;
}

export async function fetchActivityLog(params: { page: number; pageSize: number }): Promise<PaginatedResult<ActivityLogEntry>> {
  const { data } = await api.get("/audit/activity-log", { params });
  return data.data;
}
