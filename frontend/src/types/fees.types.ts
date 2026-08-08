import { SeriesPoint, CategorySlice } from "./adminDashboard.types";

export type FeeStatus = "paid" | "partial" | "unpaid";

export interface FeeDashboardStats {
  totalFees: number;
  collectedFees: number;
  pendingFees: number;
  todaysCollection: number;
  weekCollection: number;
  monthCollection: number;
  yearCollection: number;
  paidStudentsCount: number;
  pendingStudentsCount: number;
}

export interface FeeAnalytics {
  monthlyCollection: SeriesPoint[];
  collectionTrend: SeriesPoint[];
  statusBreakdown: CategorySlice[];
}

export interface StudentFeeDetail {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  name: string;
  avatarUrl: string | null;
  contactNumber: string | null;
  className: string;
  classId: string | null;
  parentName: string | null;
  parentContact: string | null;
  due: number;
  paid: number;
  balance: number;
  status: FeeStatus;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "online" | "cheque" | "other";

export interface PaymentHistoryItem {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_no: string | null;
  receipt_no: string;
  students: {
    admission_no: string;
    class_id: string | null;
    classes: { name: string; section: string } | null;
    users: { full_name: string };
  };
}

export interface FeeReceipt {
  id: string;
  receiptNo: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNo: string | null;
  notes: string | null;
  createdAt: string;
  studentName: string;
  admissionNo: string;
  className: string;
  recordedByName: string | null;
  schoolName: string;
}

export interface RecentPaymentActivity {
  id: string;
  studentName: string;
  admissionNo: string;
  amount: number;
  paymentDate: string;
  receiptNo: string;
}

export interface RecentFeeUpdateActivity {
  id: string;
  target: string;
  term: string;
  amount: number;
  createdAt: string;
}

export interface RecentActivity {
  recentPayments: RecentPaymentActivity[];
  recentFeeUpdates: RecentFeeUpdateActivity[];
}

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface CollectionReport {
  period: ReportPeriod;
  rows: { label: string; value: number }[];
}

export interface ClassWiseCollectionRow {
  classId: string;
  className: string;
  due: number;
  paid: number;
  balance: number;
}

export type BulkFeeScope = "school" | "class" | "student";

export interface BulkAssignFeesInput {
  scope: BulkFeeScope;
  classIds?: string[];
  studentIds?: string[];
  academicYearId?: string;
  term: string;
  amount: number;
  due_date?: string;
  discount_amount?: number;
  scholarship_amount?: number;
}

export interface BulkUpdateFeesInput {
  classIds?: string[];
  studentIds?: string[];
  academicYearId?: string;
  term?: string;
  patch: { amount?: number; due_date?: string; discount_amount?: number; scholarship_amount?: number };
}

export interface BulkRemoveFeesInput {
  classIds?: string[];
  studentIds?: string[];
  academicYearId?: string;
  term?: string;
}
