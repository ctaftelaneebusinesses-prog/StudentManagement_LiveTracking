import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertStaffInSchool } from "./extracurricularStaff.service";

const ACHIEVEMENT_BUCKET = "extracurricular-achievements";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — private bucket, regenerated on every list/get, same as teacherDocument.service.ts.

const ACHIEVEMENT_SELECT =
  "id, staff_id, activity_id, student_id, title, description, achieved_on, file_name, storage_path, uploaded_by, uploaded_at";

async function withSignedUrl<T extends { storage_path: string }>(row: T) {
  const { data, error } = await supabaseAdmin.storage
    .from(ACHIEVEMENT_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...row, url: error ? null : data?.signedUrl ?? null };
}

export async function listAchievements(schoolId: string, staffId: string, filters: { studentId?: string } = {}) {
  await assertStaffInSchool(schoolId, staffId);

  let query = supabaseAdmin
    .from("extracurricular_achievements")
    .select(ACHIEVEMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("staff_id", staffId)
    .order("uploaded_at", { ascending: false });
  if (filters.studentId) query = query.eq("student_id", filters.studentId);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);

  return Promise.all((data ?? []).map(withSignedUrl));
}

/**
 * Records metadata for a file the frontend has already uploaded straight to
 * the private `extracurricular-achievements` storage bucket, keyed as
 * `{school_id}/{staff_id}/{filename}` — same flow as
 * teacherDocument.service.ts::addDocument.
 */
export async function addAchievement(
  schoolId: string,
  staffId: string,
  uploadedBy: string,
  input: {
    activity_id?: string;
    student_id?: string;
    title: string;
    description?: string;
    achieved_on?: string;
    file_name: string;
    storage_path: string;
  }
) {
  await assertStaffInSchool(schoolId, staffId);

  const expectedPrefix = `${schoolId}/${staffId}/`;
  if (!input.storage_path.startsWith(expectedPrefix)) {
    throw ApiError.badRequest("storage_path must be under the staff member's own folder");
  }

  const { data, error } = await supabaseAdmin
    .from("extracurricular_achievements")
    .insert({
      school_id: schoolId,
      staff_id: staffId,
      activity_id: input.activity_id,
      student_id: input.student_id,
      title: input.title,
      description: input.description,
      achieved_on: input.achieved_on,
      file_name: input.file_name,
      storage_path: input.storage_path,
      uploaded_by: uploadedBy,
    })
    .select(ACHIEVEMENT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  return withSignedUrl(data);
}

export async function deleteAchievement(schoolId: string, staffId: string, achievementId: string) {
  const { data: row, error: fetchError } = await supabaseAdmin
    .from("extracurricular_achievements")
    .select("storage_path")
    .eq("id", achievementId)
    .eq("school_id", schoolId)
    .eq("staff_id", staffId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!row) throw ApiError.notFound("Achievement not found");

  await supabaseAdmin.storage.from(ACHIEVEMENT_BUCKET).remove([row.storage_path]);

  const { error } = await supabaseAdmin
    .from("extracurricular_achievements")
    .delete()
    .eq("id", achievementId)
    .eq("school_id", schoolId)
    .eq("staff_id", staffId);
  if (error) throw ApiError.internal(error.message);
}
