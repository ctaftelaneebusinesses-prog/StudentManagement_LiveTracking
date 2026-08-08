import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";

const SYLLABUS_BUCKET = "syllabus-documents";

export interface SyllabusEntry {
  id: string;
  school_id: string;
  academic_year: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  is_published: boolean;
  published_at: string | null;
  created_by_role: "admin" | "principal" | "teacher";
  created_at: string;
  updated_at: string;
  url: string | null;
  classes: { name: string; section: string } | null;
  subjects: { name: string; code: string } | null;
}

interface ListFilters {
  academic_year?: string;
  class_id?: string;
  subject_id?: string;
  search?: string;
  is_published?: boolean;
}

export async function listSyllabus(filters: ListFilters = {}): Promise<SyllabusEntry[]> {
  const { data } = await api.get("/syllabus", {
    params: {
      academic_year: filters.academic_year || undefined,
      class_id: filters.class_id || undefined,
      subject_id: filters.subject_id || undefined,
      search: filters.search || undefined,
      is_published: filters.is_published === undefined ? undefined : String(filters.is_published),
    },
  });
  return data.data;
}

/** Student portal — published-only, scoped server-side to the caller's own class. */
export async function listMyClassSyllabus(): Promise<SyllabusEntry[]> {
  const { data } = await api.get("/syllabus/my-class");
  return data.data;
}

/**
 * Uploads straight to the private `syllabus-documents` bucket (same
 * direct-to-storage pattern as student documents), keyed under
 * `{schoolId}/{classId}/{subjectId}/...` so both the staff and teacher-
 * ownership storage RLS policies allow it, then asks the backend to record
 * the metadata row.
 */
export async function createSyllabus(
  schoolId: string,
  input: { academic_year: string; class_id: string; subject_id: string; title: string; description?: string; is_published?: boolean; file: File }
): Promise<SyllabusEntry> {
  const path = `${schoolId}/${input.class_id}/${input.subject_id}/${Date.now()}-${input.file.name}`;
  const { error: uploadError } = await supabase.storage.from(SYLLABUS_BUCKET).upload(path, input.file);
  if (uploadError) throw uploadError;

  const { data } = await api.post("/syllabus", {
    academic_year: input.academic_year,
    class_id: input.class_id,
    subject_id: input.subject_id,
    title: input.title,
    description: input.description || undefined,
    is_published: input.is_published,
    storage_path: path,
    file_name: input.file.name,
  });
  return data.data;
}

export async function updateSyllabus(
  id: string,
  patch: { title?: string; description?: string; is_published?: boolean }
): Promise<SyllabusEntry> {
  const { data } = await api.patch(`/syllabus/${id}`, patch);
  return data.data;
}

/** Replaces the uploaded file for an existing syllabus entry — uploads to a fresh path, then patches the metadata row to point at it. */
export async function replaceSyllabusFile(id: string, schoolId: string, classId: string, subjectId: string, file: File): Promise<SyllabusEntry> {
  const path = `${schoolId}/${classId}/${subjectId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from(SYLLABUS_BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data } = await api.patch(`/syllabus/${id}`, { storage_path: path, file_name: file.name });
  return data.data;
}

export async function deleteSyllabus(id: string): Promise<void> {
  await api.delete(`/syllabus/${id}`);
}
