import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { DocumentType, StudentDocument } from "@/types/admin.types";

const DOCUMENT_BUCKET = "student-documents";

export async function fetchDocuments(studentId: string): Promise<StudentDocument[]> {
  const { data } = await api.get(`/students/${studentId}/documents`);
  return data.data;
}

/**
 * Uploads the file straight to the private `student-documents` bucket (same
 * direct-to-storage pattern as avatar upload), keyed under the student's own
 * folder so the `student_documents_write_staff` storage policy allows it,
 * then asks the backend to record the metadata row.
 */
export async function uploadDocument(
  schoolId: string,
  studentId: string,
  file: File,
  docType: DocumentType,
  notes?: string
): Promise<StudentDocument> {
  const path = `${schoolId}/${studentId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data } = await api.post(`/students/${studentId}/documents`, {
    doc_type: docType,
    file_name: file.name,
    storage_path: path,
    notes,
  });
  return data.data;
}

export async function deleteDocument(studentId: string, documentId: string): Promise<void> {
  await api.delete(`/students/${studentId}/documents/${documentId}`);
}
