import { api } from "@/lib/axios";
import { AcademicYear, Branch, School } from "@/types/admin.types";

export async function fetchMySchool(): Promise<School> {
  const { data } = await api.get("/schools/me");
  return data.data;
}

export async function updateMySchool(patch: Partial<School>): Promise<School> {
  const { data } = await api.patch("/schools/me", patch);
  return data.data;
}

export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await api.get("/schools/me/academic-years");
  return data.data;
}

export async function createAcademicYear(input: {
  name: string;
  start_date: string;
  end_date: string;
}): Promise<AcademicYear> {
  const { data } = await api.post("/schools/me/academic-years", input);
  return data.data;
}

export async function setCurrentAcademicYear(id: string): Promise<AcademicYear> {
  const { data } = await api.post(`/schools/me/academic-years/${id}/set-current`);
  return data.data;
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get("/schools/me/branches");
  return data.data;
}

export async function createBranch(input: {
  name: string;
  address?: string;
  is_main?: boolean;
}): Promise<Branch> {
  const { data } = await api.post("/schools/me/branches", input);
  return data.data;
}

export async function updateBranch(id: string, patch: Partial<Branch>): Promise<Branch> {
  const { data } = await api.patch(`/schools/me/branches/${id}`, patch);
  return data.data;
}

export async function deactivateBranch(id: string): Promise<void> {
  await api.delete(`/schools/me/branches/${id}`);
}
