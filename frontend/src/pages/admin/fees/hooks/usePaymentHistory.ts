import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/useSchool";
import * as feesService from "@/services/admin/fees.service";
import { PaymentHistoryParams } from "@/services/admin/fees.service";

export function usePaymentHistory(params: PaymentHistoryParams) {
  const { selectedSchool } = useSchool();

  return useQuery({
    queryKey: ["admin", "fees", "payments", selectedSchool.id, params],
    queryFn: () => feesService.fetchPaymentHistory(params),
  });
}
