import { api } from "@/lib/axios";
import { LeaveRequestRecord, LeaveSummary, LeaveType } from "@/types/teacher.types";
import { StudentLeaveQueueRecord, StudentLeaveStatus } from "@/types/leave.types";

export interface ApplyForLeaveInput {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
}

export async function fetchLeaveSummary(): Promise<LeaveSummary> {
  const { data } = await api.get("/teacher-portal/leave-summary");
  return data.data;
}

export async function fetchMyLeaveRequests(): Promise<LeaveRequestRecord[]> {
  const { data } = await api.get("/teacher-portal/leave-requests");
  return data.data;
}

export async function applyForLeave(input: ApplyForLeaveInput): Promise<LeaveRequestRecord> {
  const { data } = await api.post("/teacher-portal/leave-requests", input);
  return data.data;
}

/** The class teacher's review queue — students in the one class they're homeroom teacher of. */
export async function fetchStudentLeaveQueue(status?: StudentLeaveStatus): Promise<StudentLeaveQueueRecord[]> {
  const { data } = await api.get("/student-leave-requests", { params: status ? { status } : undefined });
  return data.data;
}

export async function reviewStudentLeave(id: string, status: "approved" | "rejected"): Promise<StudentLeaveQueueRecord> {
  const { data } = await api.patch(`/student-leave-requests/${id}`, { status });
  return data.data;
}
