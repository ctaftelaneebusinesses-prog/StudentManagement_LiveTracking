import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";

export function useRecentActivity() {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["fees", "recent-activity", selectedSchool.id],
    queryFn: feesService.fetchRecentActivity,
  });
}
