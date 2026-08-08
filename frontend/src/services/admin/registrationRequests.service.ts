import { api } from "@/lib/axios";

export interface RegistrationRequest {
  id: string;
  school_id: string;
  user_id: string;
  role_id: number;
  reviewer_type: "admin" | "principal" | "class_teacher";
  assigned_reviewer_id: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  users: { full_name: string; email: string; phone: string | null } | null;
  roles: { name: string } | null;
}

export async function listRegistrationRequests(status?: "pending" | "approved" | "rejected"): Promise<RegistrationRequest[]> {
  const { data } = await api.get("/registration-requests", { params: status ? { status } : undefined });
  return data.data;
}

export async function reviewRegistrationRequest(id: string, action: "approve" | "reject", notes?: string) {
  const { data } = await api.patch(`/registration-requests/${id}`, { action, notes });
  return data.data;
}
