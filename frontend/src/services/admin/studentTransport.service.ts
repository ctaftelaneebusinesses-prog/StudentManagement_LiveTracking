import { api } from "@/lib/axios";
import { StudentTransport } from "@/types/admin.types";

export async function fetchStudentTransport(studentId: string): Promise<StudentTransport | null> {
  const { data } = await api.get(`/students/${studentId}/transport`);
  return data.data;
}

export async function assignStudentTransport(studentId: string, pickupPointId: string): Promise<StudentTransport> {
  const { data } = await api.patch(`/students/${studentId}/transport`, { pickup_point_id: pickupPointId });
  return data.data;
}
