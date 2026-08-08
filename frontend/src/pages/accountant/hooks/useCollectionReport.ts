import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";
import { ReportPeriod } from "@/types/fees.types";

export function useCollectionReport(params: { period: ReportPeriod; dateFrom?: string; dateTo?: string }) {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["fees", "reports", "collection", selectedSchool.id, params],
    queryFn: () => feesService.fetchCollectionReport(params),
  });
}
