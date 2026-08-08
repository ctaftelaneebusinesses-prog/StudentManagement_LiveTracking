import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";

export function useClassWiseCollection() {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["fees", "reports", "class-wise", selectedSchool.id],
    queryFn: feesService.fetchClassWiseCollection,
  });
}
