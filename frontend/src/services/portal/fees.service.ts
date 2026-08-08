import { api } from "@/lib/axios";
import { FeeSummary, PaymentRecord } from "@/types/portal.types";

export async function fetchFeeSummary(studentId: string): Promise<FeeSummary> {
  const { data } = await api.get(`/students/${studentId}/fees/summary`);
  return data.data;
}

export async function fetchPayments(studentId: string): Promise<PaymentRecord[]> {
  const { data } = await api.get(`/students/${studentId}/fees/payments`);
  return data.data;
}
