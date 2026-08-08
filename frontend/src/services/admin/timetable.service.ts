import { api } from "@/lib/axios";
import { TimetablePeriodEntry, UpsertTimetablePeriodInput } from "@/types/timetable.types";

export async function fetchTimetableForClass(classId: string): Promise<TimetablePeriodEntry[]> {
  const { data } = await api.get("/timetable", { params: { classId } });
  return data.data;
}

export async function upsertPeriod(input: UpsertTimetablePeriodInput): Promise<TimetablePeriodEntry> {
  const { data } = await api.post("/timetable", input);
  return data.data;
}

export async function deletePeriod(id: string): Promise<void> {
  await api.delete(`/timetable/${id}`);
}
