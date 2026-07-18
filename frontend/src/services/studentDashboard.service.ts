import { api } from "@/lib/axios";
import { StudentDashboard } from "@/types/dashboard.types";

export async function fetchStudentDashboard(studentId: string): Promise<StudentDashboard> {
  const { data } = await api.get(`/students/${studentId}/dashboard`);
  return data.data;
}

export async function markNotificationRead(studentId: string, notificationId: string): Promise<void> {
  await api.post(`/students/${studentId}/notifications/${notificationId}/read`);
}
