import { api } from "@/lib/axios";
import { LeaveRequest, ParentDashboard, ReportCard } from "@/types/parent.types";

export async function fetchDashboard(): Promise<ParentDashboard> {
  const { data } = await api.get("/parent-portal/dashboard");
  return data.data;
}

export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  const { data } = await api.get("/parent-portal/leave-requests");
  return data.data;
}

export async function applyForLeave(input: { student_id: string; start_date: string; end_date: string; reason: string }): Promise<LeaveRequest> {
  const { data } = await api.post("/parent-portal/leave-requests", input);
  return data.data;
}

export async function fetchReportCard(studentId: string): Promise<ReportCard> {
  const { data } = await api.get(`/parent-portal/students/${studentId}/report-card`);
  return data.data;
}
