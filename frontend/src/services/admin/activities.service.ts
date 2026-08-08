import { api } from "@/lib/axios";
import { Activity, ActivityAssignment } from "@/types/extracurricularStaff.types";

export interface ListActivitiesParams {
  search?: string;
  is_active?: boolean;
}

/**
 * The backend paginates `/activities` (like every other list endpoint), but
 * this master list only ever has a few dozen rows and is consumed as a plain
 * array everywhere (Staff Type/Assign Activities dropdowns, filters, the
 * Activities admin table) — so this unwraps `.items` and requests the
 * backend's max page size (1000) rather than exposing pagination here.
 */
export async function fetchActivities(params: ListActivitiesParams = {}): Promise<Activity[]> {
  const { data } = await api.get("/activities", { params: { ...params, pageSize: 1000 } });
  return data.data.items;
}

export interface CreateActivityInput {
  name: string;
  staff_title: string;
  category?: string;
  staff_ids?: string[];
}

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const { data } = await api.post("/activities", input);
  return data.data;
}

export async function updateActivity(id: string, patch: Partial<CreateActivityInput>): Promise<Activity> {
  const { data } = await api.patch(`/activities/${id}`, patch);
  return data.data;
}

export async function deactivateActivity(id: string): Promise<void> {
  await api.delete(`/activities/${id}`);
}

export async function fetchActivityAssignments(id: string): Promise<ActivityAssignment[]> {
  const { data } = await api.get(`/activities/${id}/assignments`);
  return data.data;
}
