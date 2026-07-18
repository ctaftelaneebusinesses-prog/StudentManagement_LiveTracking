import { api } from "@/lib/axios";
import { AdminUser, PaginatedResult } from "@/types/admin.types";

export interface ListUsersParams {
  role?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchUsers(params: ListUsersParams = {}): Promise<PaginatedResult<AdminUser>> {
  const { data } = await api.get("/users", { params });
  return data.data;
}

export async function fetchUser(id: string): Promise<AdminUser> {
  const { data } = await api.get(`/users/${id}`);
  return data.data;
}

export async function inviteUser(input: {
  email: string;
  full_name: string;
  phone?: string;
  role_id: number;
}): Promise<AdminUser> {
  const { data } = await api.post("/users", input);
  return data.data;
}

export async function updateUser(
  id: string,
  patch: { full_name?: string; phone?: string; is_active?: boolean }
): Promise<AdminUser> {
  const { data } = await api.patch(`/users/${id}`, patch);
  return data.data;
}

export async function deactivateUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function assignRole(id: string, roleId: number) {
  const { data } = await api.post(`/users/${id}/roles`, { role_id: roleId });
  return data.data;
}

export async function revokeRole(id: string, roleId: number) {
  const { data } = await api.delete(`/users/${id}/roles/${roleId}`);
  return data.data;
}
