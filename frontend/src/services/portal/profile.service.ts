import { api } from "@/lib/axios";
import { ProfileChangeFieldEdit, ProfileChangeRequest, StudentProfile } from "@/types/portal.types";

export async function fetchProfile(studentId: string): Promise<StudentProfile> {
  const { data } = await api.get(`/students/${studentId}`);
  return data.data;
}

export async function fetchMyProfileChangeRequests(studentId: string): Promise<ProfileChangeRequest[]> {
  const { data } = await api.get(`/students/${studentId}/profile-change-requests`);
  return data.data;
}

export async function submitProfileChangeRequest(
  studentId: string,
  input: { changes: Record<string, ProfileChangeFieldEdit>; reason?: string }
): Promise<ProfileChangeRequest> {
  const { data } = await api.post(`/students/${studentId}/profile-change-requests`, input);
  return data.data;
}
