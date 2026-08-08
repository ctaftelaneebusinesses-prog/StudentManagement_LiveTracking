import { api } from "@/lib/axios";
import {
  Attempt,
  AttemptHistory,
  AttemptSummary,
  Certificate,
  AssessmentSettings,
  QuestionRow,
  QuestionSetRow,
  QuizRole,
  GlobalStats,
  StudentProgressRow,
  TeacherProgressRow,
  PrincipalProgressRow,
  SchoolAdminProgressRow,
  SummaryCounts,
} from "@/types/websiteKnowledge.types";

// ---------------------------------------------------------------------------
// Self-service: take the quiz, view own attempts/certificate
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<AssessmentSettings> {
  const { data } = await api.get("/website-knowledge/settings");
  return data.data;
}

export async function startAttempt(): Promise<Attempt> {
  const { data } = await api.post("/website-knowledge/attempts/start");
  return data.data;
}

export async function submitAnswer(attemptId: string, questionId: string, selectedOption: string) {
  const { data } = await api.post(`/website-knowledge/attempts/${attemptId}/answers`, {
    question_id: questionId,
    selected_option: selectedOption,
  });
  return data.data as { question_id: string; is_correct: boolean };
}

export async function completeAttempt(attemptId: string): Promise<Attempt> {
  const { data } = await api.post(`/website-knowledge/attempts/${attemptId}/complete`);
  return data.data;
}

export async function listMyAttempts(): Promise<AttemptSummary[]> {
  const { data } = await api.get("/website-knowledge/attempts");
  return data.data;
}

export async function getAttemptDetail(attemptId: string): Promise<Attempt & { answers: { question_id: string; selected_option: string | null; is_correct: boolean | null }[] }> {
  const { data } = await api.get(`/website-knowledge/attempts/${attemptId}`);
  return data.data;
}

export async function getMyCertificate(): Promise<Certificate | null> {
  const { data } = await api.get("/website-knowledge/certificate");
  return data.data;
}

// ---------------------------------------------------------------------------
// Monitoring (role-hierarchy visibility)
// ---------------------------------------------------------------------------

export async function getMySummary(): Promise<{ scope: string } & Partial<SummaryCounts> & Record<string, unknown>> {
  const { data } = await api.get("/website-knowledge/monitoring/summary");
  return data.data;
}

export async function listStudentsProgress(): Promise<StudentProgressRow[]> {
  const { data } = await api.get("/website-knowledge/monitoring/students");
  return data.data;
}

export async function getStudentHistory(studentId: string): Promise<AttemptHistory> {
  const { data } = await api.get(`/website-knowledge/monitoring/students/${studentId}/history`);
  return data.data;
}

export async function listTeachersProgress(): Promise<TeacherProgressRow[]> {
  const { data } = await api.get("/website-knowledge/monitoring/teachers");
  return data.data;
}

export async function getTeacherHistory(teacherId: string): Promise<AttemptHistory> {
  const { data } = await api.get(`/website-knowledge/monitoring/teachers/${teacherId}/history`);
  return data.data;
}

export async function listPrincipalsProgress(): Promise<PrincipalProgressRow[]> {
  const { data } = await api.get("/website-knowledge/monitoring/principals");
  return data.data;
}

export async function getPrincipalHistory(principalId: string): Promise<AttemptHistory> {
  const { data } = await api.get(`/website-knowledge/monitoring/principals/${principalId}/history`);
  return data.data;
}

export async function listSchoolAdminsProgress(): Promise<SchoolAdminProgressRow[]> {
  const { data } = await api.get("/website-knowledge/monitoring/school-admins");
  return data.data;
}

export async function getSchoolAdminHistory(schoolAdminId: string): Promise<AttemptHistory> {
  const { data } = await api.get(`/website-knowledge/monitoring/school-admins/${schoolAdminId}/history`);
  return data.data;
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const { data } = await api.get("/website-knowledge/monitoring/global-stats");
  return data.data;
}

// ---------------------------------------------------------------------------
// Admin: Question Bank + Settings (super_admin only)
// ---------------------------------------------------------------------------

export async function listQuestions(filters: { role_name?: QuizRole; category?: string; is_active?: boolean; search?: string } = {}): Promise<QuestionRow[]> {
  const { data } = await api.get("/website-knowledge/admin/questions", {
    params: {
      role_name: filters.role_name,
      category: filters.category || undefined,
      is_active: filters.is_active === undefined ? undefined : String(filters.is_active),
      search: filters.search || undefined,
    },
  });
  return data.data;
}

export interface CreateQuestionInput {
  role_name: QuizRole;
  question_text: string;
  options: { key: string; text: string }[];
  correct_option: string;
  explanation?: string;
  category?: string;
}

export async function createQuestion(input: CreateQuestionInput): Promise<QuestionRow> {
  const { data } = await api.post("/website-knowledge/admin/questions", input);
  return data.data;
}

export async function updateQuestion(id: string, patch: Partial<QuestionRow>): Promise<QuestionRow> {
  const { data } = await api.patch(`/website-knowledge/admin/questions/${id}`, patch);
  return data.data;
}

export async function deleteQuestion(id: string): Promise<void> {
  await api.delete(`/website-knowledge/admin/questions/${id}`);
}

export async function listQuestionSets(roleName?: QuizRole): Promise<QuestionSetRow[]> {
  const { data } = await api.get("/website-knowledge/admin/question-sets", { params: { role_name: roleName } });
  return data.data;
}

export async function createQuestionSet(input: { role_name: QuizRole; set_number: number; name: string }): Promise<QuestionSetRow> {
  const { data } = await api.post("/website-knowledge/admin/question-sets", input);
  return data.data;
}

export async function updateQuestionSet(id: string, patch: { name?: string; is_active?: boolean }): Promise<QuestionSetRow> {
  const { data } = await api.patch(`/website-knowledge/admin/question-sets/${id}`, patch);
  return data.data;
}

export async function deleteQuestionSet(id: string): Promise<void> {
  await api.delete(`/website-knowledge/admin/question-sets/${id}`);
}

export async function getQuestionSetItems(setId: string) {
  const { data } = await api.get(`/website-knowledge/admin/question-sets/${setId}/items`);
  return data.data as { id: string; order_index: number; question_id: string; questions: QuestionRow }[];
}

export async function addQuestionToSet(setId: string, questionId: string): Promise<void> {
  await api.post(`/website-knowledge/admin/question-sets/${setId}/items`, { question_id: questionId });
}

export async function removeQuestionFromSet(setId: string, questionId: string): Promise<void> {
  await api.delete(`/website-knowledge/admin/question-sets/${setId}/items/${questionId}`);
}

export async function updateSettings(patch: { question_count?: number; passing_percentage?: number }): Promise<AssessmentSettings> {
  const { data } = await api.patch("/website-knowledge/admin/settings", patch);
  return data.data;
}
