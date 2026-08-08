import { api } from "@/lib/axios";
import { ReportCard } from "@/types/portal.types";

export async function fetchReportCard(studentId: string): Promise<ReportCard> {
  const { data } = await api.get(`/students/${studentId}/report-card`);
  return data.data;
}
