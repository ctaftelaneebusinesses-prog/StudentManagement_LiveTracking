import { api } from "@/lib/axios";
import { Sibling } from "@/types/admin.types";

export async function fetchSiblings(studentId: string): Promise<Sibling[]> {
  const { data } = await api.get(`/students/${studentId}/siblings`);
  return data.data;
}

export async function searchSiblingCandidates(studentId: string, search?: string): Promise<Sibling[]> {
  const { data } = await api.get(`/students/${studentId}/siblings/search`, { params: { search } });
  return data.data;
}

export async function linkSibling(studentId: string, siblingStudentId: string): Promise<Sibling[]> {
  const { data } = await api.post(`/students/${studentId}/siblings/link`, { sibling_student_id: siblingStudentId });
  return data.data;
}

export async function unlinkSibling(studentId: string, siblingStudentId: string): Promise<Sibling[]> {
  const { data } = await api.delete(`/students/${studentId}/siblings/${siblingStudentId}`);
  return data.data;
}
