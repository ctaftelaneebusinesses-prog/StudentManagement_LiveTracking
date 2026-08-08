import { api } from "@/lib/axios";
import { TimetableChangeRequest, TimetableChangeProposedChange } from "@/types/timetableChangeRequest.types";

export interface SuggestChangeInput {
  class_id: string;
  period_id?: string;
  day_of_week: number;
  period_no: number;
  proposed_change: TimetableChangeProposedChange;
  reason: string;
}

export async function suggestChange(input: SuggestChangeInput): Promise<TimetableChangeRequest> {
  const { data } = await api.post("/timetable-change-requests", input);
  return data.data;
}

export async function fetchMySuggestions(): Promise<TimetableChangeRequest[]> {
  const { data } = await api.get("/timetable-change-requests/mine");
  return data.data;
}
