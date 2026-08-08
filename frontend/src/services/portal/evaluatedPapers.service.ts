import { api } from "@/lib/axios";
import { EvaluatedPaper } from "@/types/portal.types";

export async function fetchEvaluatedPapers(studentId: string): Promise<EvaluatedPaper[]> {
  const { data } = await api.get(`/students/${studentId}/evaluated-papers`);
  return data.data;
}
