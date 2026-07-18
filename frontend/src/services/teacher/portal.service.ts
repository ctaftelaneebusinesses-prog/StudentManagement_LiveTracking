import { api } from "@/lib/axios";
import { RosterStudent, TeacherDashboard } from "@/types/teacher.types";

export async function fetchDashboard(): Promise<TeacherDashboard> {
  const { data } = await api.get("/teacher-portal/dashboard");
  return data.data;
}

export async function fetchRoster(classId: string): Promise<RosterStudent[]> {
  const { data } = await api.get(`/teacher-portal/classes/${classId}/students`);
  return data.data;
}
