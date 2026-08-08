import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { QuestionPaperRecord } from "@/types/teacher.types";
import { ExamDocument } from "@/types/exam.types";

const DOCUMENT_BUCKET = "exam-documents";

/** All documents for one assessment, filtered to question papers only (the exam-documents endpoint is shared with admin's other doc types). */
export async function fetchQuestionPapersForExam(examId: string): Promise<ExamDocument[]> {
  const { data } = await api.get(`/exams/${examId}/documents`);
  return (data.data as ExamDocument[]).filter((doc) => doc.doc_type === "question_paper");
}

/** Uploads straight to the private `exam-documents` bucket (same pattern as the admin DocumentsTab), then records the metadata row with doc_type fixed to question_paper. */
export async function uploadQuestionPaper(schoolId: string, examId: string, file: File, notes?: string): Promise<ExamDocument> {
  const path = `${schoolId}/${examId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data } = await api.post(`/exams/${examId}/documents`, {
    doc_type: "question_paper",
    file_name: file.name,
    storage_path: path,
    notes,
  });
  return data.data;
}

/** Writes the question paper directly (HTML from the rich-text composer) instead of uploading a file. */
export async function composeQuestionPaper(examId: string, content: string, notes?: string): Promise<ExamDocument> {
  const { data } = await api.post(`/exams/${examId}/documents`, {
    doc_type: "question_paper",
    content,
    notes,
  });
  return data.data;
}

export async function deleteQuestionPaper(examId: string, documentId: string): Promise<void> {
  await api.delete(`/exams/${examId}/documents/${documentId}`);
}

/** Class Teacher/staff only — makes a question paper visible to the class's students, or takes it back down. */
export async function publishQuestionPaper(examId: string, documentId: string, isPublished: boolean): Promise<ExamDocument> {
  const { data } = await api.patch(`/exams/${examId}/documents/${documentId}/publish`, { is_published: isPublished });
  return data.data;
}

/** Class Teacher's read-only view of every question paper uploaded for any exam belonging to their class. */
export async function fetchClassQuestionPapers(classId: string): Promise<QuestionPaperRecord[]> {
  const { data } = await api.get(`/exams/class/${classId}/question-papers`);
  return data.data;
}
