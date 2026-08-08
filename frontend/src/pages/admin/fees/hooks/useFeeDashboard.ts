import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";

export function useFeeDashboard() {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["admin", "fees", "dashboard", selectedSchool.id],
    queryFn: feesService.fetchFeeDashboard,
  });
}
