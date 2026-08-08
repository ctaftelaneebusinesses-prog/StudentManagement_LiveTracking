import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { TeacherDocument, TeacherDocumentType } from "@/types/admin.types";

const DOCUMENT_BUCKET = "teacher-documents";

export async function fetchDocuments(teacherId: string): Promise<TeacherDocument[]> {
  const { data } = await api.get(`/teachers/${teacherId}/documents`);
  return data.data;
}

/**
 * Uploads the file straight to the private `teacher-documents` bucket (same
 * direct-to-storage pattern as student documents), keyed under the teacher's
 * own folder so the `teacher_documents_write_staff` storage policy allows it,
 * then asks the backend to record the metadata row.
 */
export async function uploadDocument(
  schoolId: string,
  teacherId: string,
  file: File,
  docType: TeacherDocumentType,
  notes?: string
): Promise<TeacherDocument> {
  const path = `${schoolId}/${teacherId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data } = await api.post(`/teachers/${teacherId}/documents`, {
    doc_type: docType,
    file_name: file.name,
    storage_path: path,
    notes,
  });
  return data.data;
}

export async function deleteDocument(teacherId: string, documentId: string): Promise<void> {
  await api.delete(`/teachers/${teacherId}/documents/${documentId}`);
}
