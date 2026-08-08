import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";

export function useFeeAnalytics() {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["admin", "fees", "analytics", selectedSchool.id],
    queryFn: feesService.fetchFeeAnalytics,
  });
}
