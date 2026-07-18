import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool, assertUserInSchool } from "../utils/scopeGuards";

const NOTIFICATION_SELECT =
  "id, title, message, audience_scope, audience_class_id, audience_user_id, created_by, created_at, " +
  "classes(name, section)";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  audience_scope: "school" | "class" | "student";
  audience_class_id: string | null;
  audience_user_id: string | null;
  created_by: string | null;
  created_at: string;
  classes: { name: string; section: string } | null;
}

export async function createNotification(
  schoolId: string,
  createdBy: string,
  input: {
    title: string;
    message: string;
    audience_scope: "school" | "class" | "student";
    audience_class_id?: string;
    audience_user_id?: string;
  }
) {
  if (input.audience_scope === "class" && input.audience_class_id) {
    await assertClassInSchool(schoolId, input.audience_class_id);
  }
  if (input.audience_scope === "student" && input.audience_user_id) {
    await assertUserInSchool(schoolId, input.audience_user_id);
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({ school_id: schoolId, created_by: createdBy, ...input })
    .select(NOTIFICATION_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listForSchool(schoolId: string, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw ApiError.internal(error.message);
  return data;
}

/**
 * Notifications relevant to one student's context (school-wide + their class
 * + addressed to them directly), annotated with whether the requesting user
 * (the student themself or a viewing parent) has already read each one.
 */
export async function listForStudent(schoolId: string, studentId: string, requestingUserId: string, limit = 20) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);

  const orFilters = ["audience_scope.eq.school", `and(audience_scope.eq.student,audience_user_id.eq.${studentId})`];
  if (student?.class_id) {
    orFilters.push(`and(audience_scope.eq.class,audience_class_id.eq.${student.class_id})`);
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("school_id", schoolId)
    .or(orFilters.join(","))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw ApiError.internal(error.message);

  const notifications = (data ?? []) as unknown as NotificationRow[];
  if (notifications.length === 0) return [];

  const { data: reads, error: readsError } = await supabaseAdmin
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", requestingUserId)
    .in(
      "notification_id",
      notifications.map((n) => n.id)
    );
  if (readsError) throw ApiError.internal(readsError.message);

  const readIds = new Set((reads ?? []).map((r) => r.notification_id));
  return notifications.map((n) => ({ ...n, isRead: readIds.has(n.id) }));
}

export async function markRead(notificationId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from("notification_reads")
    .upsert({ notification_id: notificationId, user_id: userId }, { onConflict: "notification_id,user_id" });
  if (error) throw ApiError.internal(error.message);
}
