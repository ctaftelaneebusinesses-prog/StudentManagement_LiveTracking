import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";

/** The school's classes, via the `fees.view`-gated endpoint (not `classes.manage`) so it works for the accountant role. */
export function useFeeClasses() {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["fees", "classes", selectedSchool.id],
    queryFn: feesService.fetchFeeClasses,
  });
}
