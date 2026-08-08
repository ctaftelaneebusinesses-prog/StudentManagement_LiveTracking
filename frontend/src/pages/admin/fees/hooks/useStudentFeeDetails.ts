import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";
import { StudentFeeDetailsParams } from "@/services/admin/fees.service";

export function useStudentFeeDetails(params: StudentFeeDetailsParams) {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["admin", "fees", "students", selectedSchool.id, params],
    queryFn: () => feesService.fetchStudentFeeDetails(params),
  });
}
