import { api } from "@/lib/axios";
import { Exam, ExamMark, ExamReport, ExamScheduleEntry } from "@/types/exam.types";

export async function fetchExams(classId?: string): Promise<Exam[]> {
  const { data } = await api.get("/exams", { params: classId ? { classId } : undefined });
  return data.data;
}

export interface CreateExamInput {
  class_id?: string;
  class_ids?: string[];
  scope?: "class" | "selected" | "all";
  academic_year_id?: string;
  name: string;
  exam_date?: string;
}

export async function createExam(input: CreateExamInput): Promise<Exam> {
  const { data } = await api.post("/exams", input);
  return data.data;
}

export interface UpdateExamInput {
  class_id?: string;
  academic_year_id?: string;
  name?: string;
  exam_date?: string;
}

export async function updateExam(id: string, patch: UpdateExamInput): Promise<Exam> {
  const { data } = await api.patch(`/exams/${id}`, patch);
  return data.data;
}

export async function deleteExam(id: string): Promise<void> {
  await api.delete(`/exams/${id}`);
}

export async function publishExam(id: string, isPublished: boolean): Promise<Exam> {
  const { data } = await api.patch(`/exams/${id}/publish`, { is_published: isPublished });
  return data.data;
}

// ---------------------------------------------------------------------------
// Subject schedule / exam timetable
// ---------------------------------------------------------------------------
export async function fetchSchedule(examId: string): Promise<ExamScheduleEntry[]> {
  const { data } = await api.get(`/exams/${examId}/schedule`);
  return data.data;
}

export interface ScheduleEntryInput {
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room?: string;
  max_marks?: number;
}

export async function createScheduleEntry(examId: string, input: ScheduleEntryInput): Promise<ExamScheduleEntry> {
  const { data } = await api.post(`/exams/${examId}/schedule`, input);
  return data.data;
}

export async function updateScheduleEntry(
  examId: string,
  scheduleId: string,
  patch: Partial<ScheduleEntryInput>
): Promise<ExamScheduleEntry> {
  const { data } = await api.patch(`/exams/${examId}/schedule/${scheduleId}`, patch);
  return data.data;
}

export async function deleteScheduleEntry(examId: string, scheduleId: string): Promise<void> {
  await api.delete(`/exams/${examId}/schedule/${scheduleId}`);
}

// ---------------------------------------------------------------------------
// Marks & report
// ---------------------------------------------------------------------------
export async function fetchMarksForExam(examId: string): Promise<ExamMark[]> {
  const { data } = await api.get(`/exams/${examId}/marks`);
  return data.data;
}

export async function fetchExamReport(examId: string): Promise<ExamReport> {
  const { data } = await api.get(`/exams/${examId}/report`);
  return data.data;
}
