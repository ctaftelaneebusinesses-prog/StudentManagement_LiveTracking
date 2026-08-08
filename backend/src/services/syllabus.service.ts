import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool } from "../utils/scopeGuards";

const SYLLABUS_BUCKET = "syllabus-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // private bucket, regenerated on every list/get — mirrors studentDocument.service.ts.

const SYLLABUS_SELECT =
  "id, school_id, academic_year, class_id, subject_id, title, description, storage_path, file_name, " +
  "is_published, published_at, published_by, uploaded_by, created_by_role, created_at, updated_at, " +
  "classes(name, section), subjects(name, code)";

interface SyllabusRow {
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
  published_by: string | null;
  uploaded_by: string | null;
  created_by_role: "admin" | "principal" | "teacher";
  created_at: string;
  updated_at: string;
  classes: { name: string; section: string } | null;
  subjects: { name: string; code: string } | null;
}

async function withSignedUrl<T extends { storage_path: string }>(row: T) {
  const { data, error } = await supabaseAdmin.storage.from(SYLLABUS_BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...row, url: error ? null : data?.signedUrl ?? null };
}

interface ListFilters {
  academic_year?: string;
  class_id?: string;
  subject_id?: string;
  search?: string;
  is_published?: "true" | "false";
  /** Restricts to only the class/subject slots this teacher is assigned to teach — omit for staff (admin/principal), who see everything. */
  teacherId?: string;
}

export async function listSyllabus(schoolId: string, filters: ListFilters) {
  let query = supabaseAdmin.from("syllabus").select(SYLLABUS_SELECT).eq("school_id", schoolId).order("created_at", { ascending: false });

  if (filters.academic_year) query = query.eq("academic_year", filters.academic_year);
  if (filters.class_id) query = query.eq("class_id", filters.class_id);
  if (filters.subject_id) query = query.eq("subject_id", filters.subject_id);
  if (filters.is_published) query = query.eq("is_published", filters.is_published === "true");
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);

  let allowedSlots: Set<string> | null = null;
  if (filters.teacherId) {
    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("class_subjects")
      .select("class_id, subject_id")
      .eq("teacher_id", filters.teacherId);
    if (assignmentError) throw ApiError.internal(assignmentError.message);

    const slots = assignments ?? [];
    if (slots.length === 0) return [];
    // PostgREST has no direct "match any of these (class_id, subject_id) pairs"
    // filter — narrow by the distinct class_ids first (cheap), then filter down
    // to the exact pairs client-side below.
    query = query.in("class_id", Array.from(new Set(slots.map((s) => s.class_id as string))));
    allowedSlots = new Set(slots.map((s) => `${s.class_id}:${s.subject_id}`));
  }

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  let rows = (data ?? []) as unknown as SyllabusRow[];

  if (allowedSlots) {
    rows = rows.filter((r) => allowedSlots!.has(`${r.class_id}:${r.subject_id}`));
  }

  return Promise.all(rows.map(withSignedUrl));
}

export async function getSyllabus(schoolId: string, id: string) {
  const { data, error } = await supabaseAdmin.from("syllabus").select(SYLLABUS_SELECT).eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Syllabus entry not found");
  return withSignedUrl(data as unknown as SyllabusRow);
}

/** Students/parents only ever reach this via their portal routes — always scoped to their own class_id(s) and published-only, enforced here (not just RLS) per this codebase's "backend is the real gate" convention. A parent with more than one child passes all of their children's class_ids at once. */
export async function listPublishedForClasses(schoolId: string, classIds: string[]) {
  if (classIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("syllabus")
    .select(SYLLABUS_SELECT)
    .eq("school_id", schoolId)
    .in("class_id", classIds)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return Promise.all(((data ?? []) as unknown as SyllabusRow[]).map(withSignedUrl));
}

export async function createSyllabus(
  schoolId: string,
  uploadedBy: string,
  createdByRole: "admin" | "principal" | "teacher",
  input: {
    academic_year: string;
    class_id: string;
    subject_id: string;
    title: string;
    description?: string;
    storage_path: string;
    file_name: string;
    is_published?: boolean;
  }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const expectedPrefix = `${schoolId}/${input.class_id}/${input.subject_id}/`;
  if (!input.storage_path.startsWith(expectedPrefix)) {
    throw ApiError.badRequest("storage_path must be under this class/subject's own folder");
  }

  const isPublished = input.is_published ?? false;
  const { data, error } = await supabaseAdmin
    .from("syllabus")
    .insert({
      school_id: schoolId,
      academic_year: input.academic_year,
      class_id: input.class_id,
      subject_id: input.subject_id,
      title: input.title,
      description: input.description,
      storage_path: input.storage_path,
      file_name: input.file_name,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      published_by: isPublished ? uploadedBy : null,
      uploaded_by: uploadedBy,
      created_by_role: createdByRole,
    })
    .select(SYLLABUS_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return withSignedUrl(data as unknown as SyllabusRow);
}

export async function updateSyllabus(
  schoolId: string,
  id: string,
  actorId: string,
  patch: { title?: string; description?: string; storage_path?: string; file_name?: string; is_published?: boolean }
) {
  const existing = await getSyllabus(schoolId, id);

  const update: Record<string, unknown> = { ...patch };
  if (patch.is_published !== undefined && patch.is_published !== existing.is_published) {
    update.published_at = patch.is_published ? new Date().toISOString() : null;
    update.published_by = patch.is_published ? actorId : null;
  }

  const { data, error } = await supabaseAdmin.from("syllabus").update(update).eq("id", id).eq("school_id", schoolId).select(SYLLABUS_SELECT).single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Syllabus entry not found");
  return withSignedUrl(data as unknown as SyllabusRow);
}

export async function deleteSyllabus(schoolId: string, id: string) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("syllabus")
    .select("storage_path")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!existing) throw ApiError.notFound("Syllabus entry not found");

  await supabaseAdmin.storage.from(SYLLABUS_BUCKET).remove([existing.storage_path]);

  const { error } = await supabaseAdmin.from("syllabus").delete().eq("id", id).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

/** class_id + subject_id for an existing syllabus row — used by the controller to run assertTeacherOwnsClassSubject before an update/delete. */
export async function getSyllabusOwnership(schoolId: string, id: string): Promise<{ class_id: string; subject_id: string } | null> {
  const { data, error } = await supabaseAdmin.from("syllabus").select("class_id, subject_id").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  return data as { class_id: string; subject_id: string } | null;
}
