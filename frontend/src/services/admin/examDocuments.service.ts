import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { ExamDocument, ExamDocumentType } from "@/types/exam.types";

const DOCUMENT_BUCKET = "exam-documents";

export async function fetchExamDocuments(examId: string): Promise<ExamDocument[]> {
  const { data } = await api.get(`/exams/${examId}/documents`);
  return data.data;
}

/**
 * Uploads the file straight to the private `exam-documents` bucket (same
 * direct-to-storage pattern as student documents), keyed under the exam's
 * own folder so the `exam_documents_write_staff` storage policy allows it,
 * then asks the backend to record the metadata row.
 */
export async function uploadExamDocument(
  schoolId: string,
  examId: string,
  file: File,
  docType: ExamDocumentType,
  notes?: string
): Promise<ExamDocument> {
  const path = `${schoolId}/${examId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data } = await api.post(`/exams/${examId}/documents`, {
    doc_type: docType,
    file_name: file.name,
    storage_path: path,
    notes,
  });
  return data.data;
}

export async function deleteExamDocument(examId: string, documentId: string): Promise<void> {
  await api.delete(`/exams/${examId}/documents/${documentId}`);
}
