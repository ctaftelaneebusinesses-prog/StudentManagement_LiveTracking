import { api } from "@/lib/axios";
import { TimetableDay } from "@/types/dashboard.types";

export async function fetchWeeklyTimetable(studentId: string): Promise<TimetableDay[]> {
  const { data } = await api.get(`/students/${studentId}/timetable`);
  return data.data;
}
