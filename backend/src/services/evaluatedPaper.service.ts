import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertStudentInSchool } from "../utils/scopeGuards";

const BUCKET = "evaluated-papers";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — private bucket, regenerated on every list.

const EVALUATED_PAPER_SELECT =
  "id, student_id, exam_id, subject_id, file_name, storage_path, notes, uploaded_by, uploaded_at, " +
  "exams(name, exam_date), subjects(name, code)";

/** Explicit row shape — the embedded exams()/subjects() relations above collapse supabase-js's select-type inference to GenericStringError otherwise (same quirk documented on homework.service.ts's HomeworkRow). */
interface EvaluatedPaperRow {
  id: string;
  student_id: string;
  exam_id: string;
  subject_id: string;
  file_name: string;
  storage_path: string;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  exams: { name: string; exam_date: string | null } | null;
  subjects: { name: string; code: string } | null;
}

async function withSignedUrl<T extends { storage_path: string }>(doc: T) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...doc, url: error ? null : data?.signedUrl ?? null };
}

/** Every evaluated paper uploaded for one student, most recent first — the portal's "Evaluated Papers" list. */
export async function listForStudent(schoolId: string, studentId: string) {
  await assertStudentInSchool(schoolId, studentId);

  const { data, error } = await supabaseAdmin
    .from("evaluated_papers")
    .select(EVALUATED_PAPER_SELECT)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("uploaded_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  return Promise.all(((data ?? []) as unknown as EvaluatedPaperRow[]).map(withSignedUrl));
}

/**
 * Records metadata for a paper the frontend has already uploaded straight to
 * the private `evaluated-papers` storage bucket (mirrors student_documents'
 * upload-then-register pattern), keyed as `{school_id}/{student_id}/{filename}`.
 */
export async function addPaper(
  schoolId: string,
  studentId: string,
  uploadedBy: string,
  input: { exam_id: string; subject_id: string; file_name: string; storage_path: string; notes?: string }
) {
  await assertStudentInSchool(schoolId, studentId);

  const expectedPrefix = `${schoolId}/${studentId}/`;
  if (!input.storage_path.startsWith(expectedPrefix)) {
    throw ApiError.badRequest("storage_path must be under the student's own folder");
  }

  const { data: exam, error: examError } = await supabaseAdmin
    .from("exams")
    .select("id")
    .eq("id", input.exam_id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (examError) throw ApiError.internal(examError.message);
  if (!exam) throw ApiError.notFound("Exam not found");

  const { data, error } = await supabaseAdmin
    .from("evaluated_papers")
    .insert({
      school_id: schoolId,
      student_id: studentId,
      exam_id: input.exam_id,
      subject_id: input.subject_id,
      file_name: input.file_name,
      storage_path: input.storage_path,
      notes: input.notes,
      uploaded_by: uploadedBy,
    })
    .select(EVALUATED_PAPER_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  return withSignedUrl(data as unknown as EvaluatedPaperRow);
}

export async function deletePaper(schoolId: string, studentId: string, paperId: string) {
  const { data: paper, error: fetchError } = await supabaseAdmin
    .from("evaluated_papers")
    .select("storage_path")
    .eq("id", paperId)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!paper) throw ApiError.notFound("Evaluated paper not found");

  await supabaseAdmin.storage.from(BUCKET).remove([paper.storage_path]);

  const { error } = await supabaseAdmin
    .from("evaluated_papers")
    .delete()
    .eq("id", paperId)
    .eq("school_id", schoolId)
    .eq("student_id", studentId);
  if (error) throw ApiError.internal(error.message);
}
