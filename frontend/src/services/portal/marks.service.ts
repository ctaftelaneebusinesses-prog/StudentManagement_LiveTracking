import { api } from "@/lib/axios";
import { MarkRecord } from "@/types/portal.types";

export async function fetchMarks(studentId: string): Promise<MarkRecord[]> {
  const { data } = await api.get(`/students/${studentId}/marks`);
  return data.data;
}
