import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { HomeworkItem } from "@/types/dashboard.types";
import { QuestionPaperRecord } from "@/types/teacher.types";

export async function fetchAllHomework(studentId: string): Promise<HomeworkItem[]> {
  const { data } = await api.get(`/students/${studentId}/homework/all`);
  return data.data;
}

/** Question papers for exams already published to this student's class — see exam.service.ts::listPublishedQuestionPapersForStudent. */
export async function fetchQuestionPapers(studentId: string): Promise<QuestionPaperRecord[]> {
  const { data } = await api.get(`/students/${studentId}/question-papers`);
  return data.data;
}

export interface SubmitHomeworkInput {
  submission_text?: string;
  attachment_url?: string;
}

export async function submitHomework(homeworkId: string, input: SubmitHomeworkInput) {
  const { data } = await api.post(`/homework/${homeworkId}/submit`, input);
  return data.data;
}

/**
 * Uploads a homework submission file to the public `homework-submissions`
 * bucket, keyed `{studentId}/{filename}` — students.id is the same uuid as
 * users.id (1:1 extension table), so this matches auth.uid() and satisfies
 * the homework_submissions_write_own storage policy. Mirrors
 * services/profile.service.ts::uploadAvatar's upload-then-getPublicUrl flow.
 */
export async function uploadSubmissionAttachment(studentId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${studentId}/${timestamp}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("homework-submissions")
    .upload(path, file, { upsert: false, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("homework-submissions").getPublicUrl(path);
  return data.publicUrl;
}
