import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertStudentInSchool } from "../utils/scopeGuards";

const DOCUMENT_BUCKET = "student-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — private bucket, regenerated on every list/get.

async function withSignedUrl<T extends { storage_path: string }>(doc: T) {
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...doc, url: error ? null : data?.signedUrl ?? null };
}

export async function listDocuments(schoolId: string, studentId: string) {
  await assertStudentInSchool(schoolId, studentId);

  const { data, error } = await supabaseAdmin
    .from("student_documents")
    .select("id, doc_type, file_name, storage_path, notes, uploaded_at, uploaded_by")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("uploaded_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  return Promise.all((data ?? []).map(withSignedUrl));
}

/**
 * Records metadata for a document the frontend has already uploaded straight
 * to the private `student-documents` storage bucket (mirrors the avatar
 * upload pattern), keyed as `{school_id}/{student_id}/{filename}`.
 */
export async function addDocument(
  schoolId: string,
  studentId: string,
  uploadedBy: string,
  input: { doc_type: string; file_name: string; storage_path: string; notes?: string }
) {
  await assertStudentInSchool(schoolId, studentId);

  const expectedPrefix = `${schoolId}/${studentId}/`;
  if (!input.storage_path.startsWith(expectedPrefix)) {
    throw ApiError.badRequest("storage_path must be under the student's own folder");
  }

  const { data, error } = await supabaseAdmin
    .from("student_documents")
    .insert({
      school_id: schoolId,
      student_id: studentId,
      doc_type: input.doc_type,
      file_name: input.file_name,
      storage_path: input.storage_path,
      notes: input.notes,
      uploaded_by: uploadedBy,
    })
    .select("id, doc_type, file_name, storage_path, notes, uploaded_at, uploaded_by")
    .single();
  if (error) throw ApiError.internal(error.message);

  return withSignedUrl(data);
}

export async function deleteDocument(schoolId: string, studentId: string, documentId: string) {
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from("student_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!doc) throw ApiError.notFound("Document not found");

  await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);

  const { error } = await supabaseAdmin
    .from("student_documents")
    .delete()
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .eq("student_id", studentId);
  if (error) throw ApiError.internal(error.message);
}
