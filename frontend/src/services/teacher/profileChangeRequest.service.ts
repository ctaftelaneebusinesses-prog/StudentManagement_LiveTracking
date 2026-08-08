import { api } from "@/lib/axios";
import { ProfileChangeRequest, ProfileChangeStatus } from "@/types/portal.types";

/** The class teacher's review queue — students in the one class they're homeroom teacher of. */
export async function fetchProfileChangeQueue(status?: ProfileChangeStatus): Promise<ProfileChangeRequest[]> {
  const { data } = await api.get("/profile-change-requests", { params: status ? { status } : undefined });
  return data.data;
}

export async function reviewProfileChangeRequest(
  id: string,
  status: "approved" | "rejected",
  reviewerNotes?: string
): Promise<ProfileChangeRequest & { alreadyReviewed: boolean }> {
  const { data } = await api.patch(`/profile-change-requests/${id}`, { status, reviewer_notes: reviewerNotes });
  return data.data;
}
