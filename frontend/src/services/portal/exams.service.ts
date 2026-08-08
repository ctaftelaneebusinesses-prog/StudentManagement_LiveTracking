import { api } from "@/lib/axios";
import { ExamScheduleEntry, PortalExam } from "@/types/portal.types";

export async function fetchExams(studentId: string): Promise<PortalExam[]> {
  const { data } = await api.get(`/students/${studentId}/exams`);
  return data.data;
}

export async function fetchExamSchedule(studentId: string, examId: string): Promise<ExamScheduleEntry[]> {
  const { data } = await api.get(`/students/${studentId}/exams/${examId}/schedule`);
  return data.data;
}
