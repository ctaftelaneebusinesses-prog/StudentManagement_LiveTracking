import { api } from "@/lib/axios";
import { TeacherAssessment } from "@/types/teacher.types";

export interface CreateAssessmentInput {
  class_id: string;
  subject_id: string;
  name: string;
  exam_date: string;
  max_marks?: number;
  instructions?: string;
}

export async function fetchMyAssessments(): Promise<TeacherAssessment[]> {
  const { data } = await api.get("/teacher-portal/assessments");
  return data.data;
}

export async function createAssessment(input: CreateAssessmentInput): Promise<TeacherAssessment> {
  const { data } = await api.post("/teacher-portal/assessments", input);
  return data.data;
}
