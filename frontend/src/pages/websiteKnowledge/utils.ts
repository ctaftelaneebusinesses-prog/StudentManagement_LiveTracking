import { AssessmentStatus, ProgressRow, QuizRole, SummaryCounts } from "@/types/websiteKnowledge.types";
import { BadgeVariant } from "@/components/ui/Badge";

export const ROLE_LABELS: Record<QuizRole, string> = {
  student: "Student",
  teacher: "Teacher",
  principal: "Principal",
  school_admin: "School Admin",
  accountant: "Accountant",
  driver: "Driver",
  extracurricular_staff: "Extracurricular Staff",
};

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  not_attempted: "Not Attempted",
  in_progress: "In Progress",
  failed: "Failed",
  passed: "Passed",
  certified: "Certified",
};

export const STATUS_VARIANTS: Record<AssessmentStatus, BadgeVariant> = {
  not_attempted: "neutral",
  in_progress: "info",
  failed: "danger",
  passed: "success",
  certified: "success",
};

export function formatPercentage(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Client-side mirror of the backend's summarize() in websiteKnowledgeMonitoring.service.ts — used when a list of progress rows is already in hand and a second network round-trip for the same counts isn't worth it. */
export function summarizeRows(rows: ProgressRow[]): SummaryCounts {
  const total = rows.length;
  const not_attempted = rows.filter((r) => r.status === "not_attempted").length;
  const in_progress = rows.filter((r) => r.status === "in_progress").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const passed = rows.filter((r) => r.status === "passed" || r.status === "certified").length;
  const certified = rows.filter((r) => r.status === "certified").length;
  return { total, completed: failed + passed, not_attempted, in_progress, passed, failed, certified };
}
