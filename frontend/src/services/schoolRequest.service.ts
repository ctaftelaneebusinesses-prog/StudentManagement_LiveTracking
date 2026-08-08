import { api } from "@/lib/axios";
import { SchoolRequest, SchoolRequestPayload, SchoolRequestStatus } from "@/types/schoolRequest.types";

// --- school_admin side --------------------------------------------------
export async function createRequest(payload: SchoolRequestPayload): Promise<SchoolRequest> {
  const { data } = await api.post("/school-requests", payload);
  return data.data;
}

export async function listMyRequests(): Promise<SchoolRequest[]> {
  const { data } = await api.get("/school-requests/mine");
  return data.data;
}

// --- super_admin side -----------------------------------------------------
export async function listAllRequests(status?: SchoolRequestStatus): Promise<SchoolRequest[]> {
  const { data } = await api.get("/school-requests", { params: { status } });
  return data.data;
}

export async function approveRequest(id: string, reviewerNotes?: string) {
  const { data } = await api.post(`/school-requests/${id}/approve`, { reviewer_notes: reviewerNotes });
  return data.data as { request: SchoolRequest; school: { id: string; name: string } };
}

export async function rejectRequest(id: string, reviewerNotes?: string): Promise<SchoolRequest> {
  const { data } = await api.post(`/school-requests/${id}/reject`, { reviewer_notes: reviewerNotes });
  return data.data;
}
