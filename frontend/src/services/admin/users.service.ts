import { api } from "@/lib/axios";
import { AdminUser, PaginatedResult } from "@/types/admin.types";
import { Permission, Role, RolePermissionPair } from "@/types/users.types";

export interface ListUsersParams {
  role?: string;
  search?: string;
  status?: "active" | "inactive";
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

export async function createUser(input: {
  email: string;
  full_name: string;
  phone?: string;
  password?: string;
  role_id: number;
  designation?: string;
}): Promise<AdminUser> {
  const { data } = await api.post("/users", input);
  return data.data;
}

export async function updateUser(
  id: string,
  patch: { full_name?: string; phone?: string; is_active?: boolean; designation?: string }
): Promise<AdminUser> {
  const { data } = await api.patch(`/users/${id}`, patch);
  return data.data;
}

export async function deactivateUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function activateUser(id: string): Promise<AdminUser> {
  return updateUser(id, { is_active: true });
}

export async function resetPassword(id: string, password: string): Promise<void> {
  await api.post(`/users/${id}/reset-password`, { password });
}

export async function bulkActivate(userIds: string[]): Promise<{ updatedCount: number }> {
  const { data } = await api.post("/users/bulk-activate", { userIds });
  return data.data;
}

export async function bulkDeactivate(userIds: string[]): Promise<{ updatedCount: number }> {
  const { data } = await api.post("/users/bulk-deactivate", { userIds });
  return data.data;
}

export interface CreateUserInput {
  email: string;
  full_name: string;
  phone?: string;
  password?: string;
  role_id: number;
  designation?: string;
}

export interface BulkCreateUsersResult {
  created: AdminUser[];
  failed: { index: number; email?: string; message: string }[];
  totalRequested: number;
}

export async function bulkCreateUsers(users: CreateUserInput[]): Promise<BulkCreateUsersResult> {
  const { data } = await api.post("/users/bulk-create", { users });
  return data.data;
}

export async function bulkDeleteUsers(userIds: string[]): Promise<{ deletedCount: number; requestedCount: number }> {
  const { data } = await api.post("/users/bulk-delete", { userIds });
  return data.data;
}

export interface UserRoleEntry {
  role_id: number;
  roles: { name: string };
}

export async function fetchUserRoles(id: string): Promise<UserRoleEntry[]> {
  const { data } = await api.get(`/users/${id}/roles`);
  return data.data;
}

export async function assignRole(id: string, roleId: number) {
  const { data } = await api.post(`/users/${id}/roles`, { role_id: roleId });
  return data.data;
}

export async function revokeRole(id: string, roleId: number) {
  const { data } = await api.delete(`/users/${id}/roles/${roleId}`);
  return data.data;
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await api.get("/roles");
  return data.data;
}

export async function fetchPermissions(): Promise<Permission[]> {
  const { data } = await api.get("/permissions");
  return data.data;
}

export async function fetchRolePermissionMatrix(): Promise<RolePermissionPair[]> {
  const { data } = await api.get("/role-permissions");
  return data.data;
}
