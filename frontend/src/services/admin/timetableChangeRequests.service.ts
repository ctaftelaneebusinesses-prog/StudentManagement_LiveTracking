import { api } from "@/lib/axios";
import { TimetableChangeRequest } from "@/types/timetableChangeRequest.types";

export async function fetchOpenSuggestions(): Promise<TimetableChangeRequest[]> {
  const { data } = await api.get("/timetable-change-requests");
  return data.data;
}

export async function reviewSuggestion(id: string, status: "approved" | "rejected"): Promise<TimetableChangeRequest> {
  const { data } = await api.patch(`/timetable-change-requests/${id}`, { status });
  return data.data;
}
