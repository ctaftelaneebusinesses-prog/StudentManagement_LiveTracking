import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";

const DOCUMENT_BUCKET = "teacher-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — private bucket, regenerated on every list/get.

async function withSignedUrl<T extends { storage_path: string }>(doc: T) {
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...doc, url: error ? null : data?.signedUrl ?? null };
}

async function assertTeacherInSchool(schoolId: string, teacherId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("id")
    .eq("id", teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Teacher not found");
}

export async function listDocuments(schoolId: string, teacherId: string) {
  await assertTeacherInSchool(schoolId, teacherId);

  const { data, error } = await supabaseAdmin
    .from("teacher_documents")
    .select("id, doc_type, file_name, storage_path, notes, uploaded_at, uploaded_by")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .order("uploaded_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  return Promise.all((data ?? []).map(withSignedUrl));
}

/**
 * Records metadata for a document the frontend has already uploaded straight
 * to the private `teacher-documents` storage bucket, keyed as
 * `{school_id}/{teacher_id}/{filename}`.
 */
export async function addDocument(
  schoolId: string,
  teacherId: string,
  uploadedBy: string,
  input: { doc_type: string; file_name: string; storage_path: string; notes?: string }
) {
  await assertTeacherInSchool(schoolId, teacherId);

  const expectedPrefix = `${schoolId}/${teacherId}/`;
  if (!input.storage_path.startsWith(expectedPrefix)) {
    throw ApiError.badRequest("storage_path must be under the teacher's own folder");
  }

  const { data, error } = await supabaseAdmin
    .from("teacher_documents")
    .insert({
      school_id: schoolId,
      teacher_id: teacherId,
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

export async function deleteDocument(schoolId: string, teacherId: string, documentId: string) {
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from("teacher_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!doc) throw ApiError.notFound("Document not found");

  await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);

  const { error } = await supabaseAdmin
    .from("teacher_documents")
    .delete()
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId);
  if (error) throw ApiError.internal(error.message);
}
