import { useQuery } from "@tanstack/react-query";
import { fetchAdminDashboardOverview } from "@/services/admin/adminDashboardOverview.service";
import { useSchool } from "@/hooks/useSchool";

export function useAdminOverview() {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["admin-dashboard-overview", selectedSchool.id],
    queryFn: () => fetchAdminDashboardOverview(selectedSchool.id),
    enabled: !!selectedSchool.id,
  });
}
