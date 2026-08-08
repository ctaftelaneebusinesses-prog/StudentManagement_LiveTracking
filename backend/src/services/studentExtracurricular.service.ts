import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import * as notificationService from "./notification.service";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ACHIEVEMENT_BUCKET = "extracurricular-achievements";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Every batch (class assignment) covering this student — entire_class batches for their own class, plus any selected_students batch they're individually part of. */
async function getStudentBatchIds(schoolId: string, studentId: string, classId: string | null): Promise<string[]> {
  const batchIds = new Set<string>();

  if (classId) {
    const { data, error } = await supabaseAdmin
      .from("extracurricular_batches")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("scope", "entire_class");
    if (error) throw ApiError.internal(error.message);
    for (const row of data ?? []) batchIds.add(row.id as string);
  }

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("extracurricular_batch_students")
    .select("batch_id")
    .eq("student_id", studentId);
  if (membershipError) throw ApiError.internal(membershipError.message);
  for (const row of memberships ?? []) batchIds.add(row.batch_id as string);

  return Array.from(batchIds);
}

/** Extracurricular Activities overview for the Student/Parent portal sidebar page — today's practice, upcoming events, practice work, awards/certificates, announcements, and a best-effort gallery reused from achievement image uploads. */
export async function getOverview(schoolId: string, studentId: string) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student) throw ApiError.notFound("Student not found");

  const batchIds = await getStudentBatchIds(schoolId, studentId, student.class_id as string | null);

  if (batchIds.length === 0) {
    return {
      todaysPractice: [],
      upcomingEvents: [],
      practiceWork: [],
      achievements: [],
      gallery: [],
      announcements: [],
    };
  }

  const todayDow = new Date().getDay();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [scheduleRes, eventsRes, practiceWorkRes, achievementsRes, notifications] = await Promise.all([
    supabaseAdmin
      .from("extracurricular_schedule_slots")
      .select("id, batch_id, day_of_week, start_time, end_time, venue, extracurricular_batches(activities(name), classes(name, section))")
      .eq("school_id", schoolId)
      .eq("day_of_week", todayDow)
      .in("batch_id", batchIds)
      .order("start_time"),
    supabaseAdmin
      .from("extracurricular_events")
      .select("id, title, description, event_date, start_time, end_time, venue, activities(name)")
      .eq("school_id", schoolId)
      .in("batch_id", batchIds)
      .gte("event_date", todayIso)
      .order("event_date"),
    supabaseAdmin
      .from("extracurricular_practice_work")
      .select("id, title, description, due_date, attachment_url, created_at")
      .eq("school_id", schoolId)
      .in("batch_id", batchIds)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("extracurricular_achievements")
      .select("id, activity_id, title, description, achieved_on, file_name, storage_path, uploaded_at, activities(name)")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .order("uploaded_at", { ascending: false }),
    notificationService.listForStudent(schoolId, studentId, studentId, 30),
  ]);

  if (scheduleRes.error) throw ApiError.internal(scheduleRes.error.message);
  if (eventsRes.error) throw ApiError.internal(eventsRes.error.message);
  if (practiceWorkRes.error) throw ApiError.internal(practiceWorkRes.error.message);
  if (achievementsRes.error) throw ApiError.internal(achievementsRes.error.message);

  const achievementRows = achievementsRes.data ?? [];
  const signedAchievements = await Promise.all(
    achievementRows.map(async (row) => {
      const { data, error } = await supabaseAdmin.storage
        .from(ACHIEVEMENT_BUCKET)
        .createSignedUrl(row.storage_path as string, SIGNED_URL_TTL_SECONDS);
      return { ...row, signed_url: error ? undefined : (data?.signedUrl ?? undefined) };
    })
  );

  const gallery = signedAchievements.filter((a) =>
    IMAGE_EXTENSIONS.some((ext) => (a.file_name as string).toLowerCase().endsWith(ext))
  );

  const announcements = notifications.filter((n) => n.type.startsWith("activity_"));

  return {
    todaysPractice: scheduleRes.data ?? [],
    upcomingEvents: eventsRes.data ?? [],
    practiceWork: practiceWorkRes.data ?? [],
    achievements: signedAchievements,
    gallery,
    announcements,
  };
}
