import { api } from "@/lib/axios";
import { StudentMarkEntry } from "@/types/admin.types";

export async function fetchMarksForStudent(studentId: string): Promise<StudentMarkEntry[]> {
  const { data } = await api.get(`/students/${studentId}/marks`);
  return data.data;
}
