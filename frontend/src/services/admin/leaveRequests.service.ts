import { api } from "@/lib/axios";
import { LeaveRequest, LeaveRequestStatus, PaginatedResult } from "@/types/admin.types";
import { LeaveSummary, LeaveType } from "@/types/teacher.types";

export interface ListLeaveRequestsParams {
  teacherId?: string;
  status?: LeaveRequestStatus;
  applicantRole?: "teacher" | "principal";
  page?: number;
  pageSize?: number;
}

export async function fetchLeaveRequests(params: ListLeaveRequestsParams = {}): Promise<PaginatedResult<LeaveRequest>> {
  const { data } = await api.get("/leave-requests", { params });
  return data.data;
}

export async function fetchLeaveRequestsForTeacher(teacherId: string): Promise<LeaveRequest[]> {
  const { data } = await api.get(`/teachers/${teacherId}/leave-requests`);
  return data.data;
}

export interface CreateLeaveRequestInput {
  teacher_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export async function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  const { data } = await api.post("/leave-requests", input);
  return data.data;
}

export async function reviewLeaveRequest(id: string, status: "approved" | "rejected"): Promise<LeaveRequest> {
  const { data } = await api.patch(`/leave-requests/${id}`, { status });
  return data.data;
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  await api.delete(`/leave-requests/${id}`);
}

export interface ApplySelfLeaveInput {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
}

/** Self-service — a principal applying for their own leave (admin/super_admin-only reviewed; see backend leaveRequest.service.ts). */
export async function fetchMyLeaveSummary(): Promise<LeaveSummary> {
  const { data } = await api.get("/leave-requests/me/summary");
  return data.data;
}

export async function fetchMyLeaveRequests(): Promise<LeaveRequest[]> {
  const { data } = await api.get("/leave-requests/me");
  return data.data;
}

export async function applyForMyLeave(input: ApplySelfLeaveInput): Promise<LeaveRequest> {
  const { data } = await api.post("/leave-requests/me", input);
  return data.data;
}
