import { api } from "@/lib/axios";
import { ClassRoom, FeePayment, FeeStructure, FeeSummary } from "@/types/admin.types";
import {
  BulkAssignFeesInput,
  BulkRemoveFeesInput,
  BulkUpdateFeesInput,
  ClassWiseCollectionRow,
  CollectionReport,
  FeeAnalytics,
  FeeDashboardStats,
  FeeReceipt,
  FeeStatus,
  PaginatedResult,
  PaymentHistoryItem,
  PaymentMethod,
  RecentActivity,
  ReportPeriod,
  StudentFeeDetail,
} from "@/types/fees.types";

export async function fetchFeeClasses(): Promise<ClassRoom[]> {
  const { data } = await api.get("/fees/classes");
  return data.data;
}

export async function fetchFeeSummary(studentId: string): Promise<FeeSummary> {
  const { data } = await api.get(`/students/${studentId}/fees/summary`);
  return data.data;
}

export interface RecordPaymentInput {
  fee_structure_id?: string;
  amount: number;
  payment_date?: string;
  payment_method?: FeePayment["payment_method"];
  reference_no?: string;
  notes?: string;
}

export async function recordPayment(studentId: string, input: RecordPaymentInput): Promise<FeePayment> {
  const { data } = await api.post(`/students/${studentId}/fees/payments`, input);
  return data.data;
}

export interface StudentFeeOverrideInput {
  override_amount: number;
  reason?: string;
}

export async function upsertStudentFeeOverride(
  studentId: string,
  feeStructureId: string,
  input: StudentFeeOverrideInput
): Promise<FeeStructure> {
  const { data } = await api.put(`/students/${studentId}/fees/structures/${feeStructureId}/override`, input);
  return data.data;
}

export async function deleteStudentFeeOverride(studentId: string, feeStructureId: string): Promise<void> {
  await api.delete(`/students/${studentId}/fees/structures/${feeStructureId}/override`);
}

export async function fetchFeeStructures(classId?: string): Promise<FeeStructure[]> {
  const { data } = await api.get("/fees/structures", { params: classId ? { classId } : undefined });
  return data.data;
}

export interface CreateFeeStructureInput {
  class_id?: string;
  student_id?: string;
  academic_year_id?: string;
  term: string;
  amount: number;
  due_date?: string;
  discount_amount?: number;
  scholarship_amount?: number;
}

export async function createFeeStructure(input: CreateFeeStructureInput): Promise<FeeStructure> {
  const { data } = await api.post("/fees/structures", input);
  return data.data;
}

export async function updateFeeStructure(id: string, patch: Partial<CreateFeeStructureInput>): Promise<FeeStructure> {
  const { data } = await api.patch(`/fees/structures/${id}`, patch);
  return data.data;
}

export async function deleteFeeStructure(id: string): Promise<void> {
  await api.delete(`/fees/structures/${id}`);
}

export async function fetchFeeDashboard(): Promise<FeeDashboardStats> {
  const { data } = await api.get("/fees/dashboard");
  return data.data;
}

export async function fetchFeeAnalytics(): Promise<FeeAnalytics> {
  const { data } = await api.get("/fees/analytics");
  return data.data;
}

export interface StudentFeeDetailsParams {
  search?: string;
  classId?: string;
  academicYearId?: string;
  status?: "all" | FeeStatus;
  page: number;
  pageSize: number;
}

export async function fetchStudentFeeDetails(params: StudentFeeDetailsParams): Promise<PaginatedResult<StudentFeeDetail>> {
  const { data } = await api.get("/fees/students", { params });
  return data.data;
}

export interface PaymentHistoryParams {
  search?: string;
  classId?: string;
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export async function fetchPaymentHistory(params: PaymentHistoryParams): Promise<PaginatedResult<PaymentHistoryItem>> {
  const { data } = await api.get("/fees/payments", { params });
  return data.data;
}

export async function fetchReceipt(paymentId: string): Promise<FeeReceipt> {
  const { data } = await api.get(`/fees/payments/${paymentId}/receipt`);
  return data.data;
}

export async function fetchRecentActivity(): Promise<RecentActivity> {
  const { data } = await api.get("/fees/recent-activity");
  return data.data;
}

export async function fetchCollectionReport(params: { period: ReportPeriod; dateFrom?: string; dateTo?: string }): Promise<CollectionReport> {
  const { data } = await api.get("/fees/reports/collection", { params });
  return data.data;
}

export async function fetchClassWiseCollection(): Promise<ClassWiseCollectionRow[]> {
  const { data } = await api.get("/fees/reports/class-wise");
  return data.data;
}

export async function bulkAssignFees(input: BulkAssignFeesInput): Promise<{ created: number; skipped: number }> {
  const { data } = await api.post("/fees/bulk/assign", input);
  return data.data;
}

export async function bulkUpdateFees(input: BulkUpdateFeesInput): Promise<{ updated: number }> {
  const { data } = await api.patch("/fees/bulk/update", input);
  return data.data;
}

export async function bulkRemoveFees(input: BulkRemoveFeesInput): Promise<{ removed: number; skipped: number }> {
  const { data } = await api.delete("/fees/bulk/remove", { data: input });
  return data.data;
}
