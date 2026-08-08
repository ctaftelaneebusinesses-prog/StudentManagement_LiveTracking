import { api } from "@/lib/axios";
import { ActivityEntry } from "@/types/admin.types";

export async function fetchActivityTimeline(studentId: string): Promise<ActivityEntry[]> {
  const { data } = await api.get(`/students/${studentId}/activity`);
  return data.data;
}
