import { api } from "@/lib/axios";
import { ClassSubjectMarksStatus, ExamMarkRecord, TeacherExam } from "@/types/teacher.types";

export async function fetchExams(classId: string): Promise<TeacherExam[]> {
  const { data } = await api.get("/exams", { params: { classId } });
  return data.data;
}

export interface CreateExamInput {
  class_id: string;
  academic_year_id?: string;
  name: string;
  exam_date?: string;
}

export async function createExam(input: CreateExamInput): Promise<TeacherExam> {
  const { data } = await api.post("/exams", input);
  return data.data;
}

export async function fetchMarksForExam(examId: string): Promise<ExamMarkRecord[]> {
  const { data } = await api.get(`/exams/${examId}/marks`);
  return data.data;
}

export interface UpsertMarkRecord {
  student_id: string;
  subject_id: string;
  marks_obtained: number;
  max_marks?: number;
  grade?: string;
  remarks?: string;
}

export async function upsertMarks(examId: string, records: UpsertMarkRecord[]): Promise<ExamMarkRecord[]> {
  const { data } = await api.post(`/exams/${examId}/marks`, { records });
  return data.data;
}

/** Class Teacher's per-subject marks completion status for one exam. */
export async function fetchClassSubjectStatus(examId: string, classId: string): Promise<ClassSubjectMarksStatus[]> {
  const { data } = await api.get(`/exams/${examId}/subject-status`, { params: { classId } });
  return data.data;
}

export async function sendMarksReminder(examId: string, subjectId: string, classId: string): Promise<void> {
  await api.post(`/exams/${examId}/subjects/${subjectId}/remind`, { classId });
}
