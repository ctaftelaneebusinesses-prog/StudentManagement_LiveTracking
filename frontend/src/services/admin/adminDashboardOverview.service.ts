import { api } from "@/lib/axios";
import { AdminDashboardOverview } from "@/types/adminDashboard.types";

/** Real, database-backed replacement for the old mock-data dashboard feed (see data/mockAdminDashboard.ts, now removed). */
export async function fetchAdminDashboardOverview(schoolId: string): Promise<AdminDashboardOverview> {
  const { data } = await api.get("/reports/admin/dashboard-overview", { params: { school_id: schoolId } });
  return data.data;
}
