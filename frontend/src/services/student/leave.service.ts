import { api } from "@/lib/axios";
import { StudentLeaveRequestRecord } from "@/types/leave.types";

export interface ApplyForStudentLeaveInput {
  start_date: string;
  end_date: string;
  reason: string;
}

export async function fetchMyLeaveRequests(studentId: string): Promise<StudentLeaveRequestRecord[]> {
  const { data } = await api.get(`/students/${studentId}/leave-requests`);
  return data.data;
}

export async function applyForLeave(studentId: string, input: ApplyForStudentLeaveInput): Promise<StudentLeaveRequestRecord> {
  const { data } = await api.post(`/students/${studentId}/leave-requests`, input);
  return data.data;
}
