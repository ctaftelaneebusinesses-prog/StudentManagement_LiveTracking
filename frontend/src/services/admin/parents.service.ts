import { api } from "@/lib/axios";
import { LinkedParent, Parent, ParentRelation } from "@/types/admin.types";

export async function searchParents(search?: string): Promise<Parent[]> {
  const { data } = await api.get("/parents", { params: { search } });
  return data.data;
}

export async function fetchParentsForStudent(studentId: string): Promise<LinkedParent[]> {
  const { data } = await api.get(`/students/${studentId}/parents`);
  return data.data;
}

export interface CreateAndLinkParentInput {
  email: string;
  full_name: string;
  phone?: string;
  occupation?: string;
  address?: string;
  relation: ParentRelation;
}

export async function createAndLinkParent(
  studentId: string,
  input: CreateAndLinkParentInput
): Promise<LinkedParent[]> {
  const { data } = await api.post(`/students/${studentId}/parents`, input);
  return data.data;
}

export async function linkExistingParent(
  studentId: string,
  parentId: string,
  relation: ParentRelation
): Promise<LinkedParent[]> {
  const { data } = await api.post(`/students/${studentId}/parents/link`, { parent_id: parentId, relation });
  return data.data;
}

export interface UpdateLinkedParentInput {
  relation?: ParentRelation;
  full_name?: string;
  phone?: string;
  occupation?: string;
  address?: string;
}

export async function updateLinkedParent(
  studentId: string,
  parentId: string,
  patch: UpdateLinkedParentInput
): Promise<LinkedParent[]> {
  const { data } = await api.patch(`/students/${studentId}/parents/${parentId}`, patch);
  return data.data;
}

export async function unlinkParent(studentId: string, parentId: string): Promise<LinkedParent[]> {
  const { data } = await api.delete(`/students/${studentId}/parents/${parentId}`);
  return data.data;
}
