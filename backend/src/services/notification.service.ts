import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool, assertUserInSchool } from "../utils/scopeGuards";
import { logger } from "../config/logger";
import * as emailService from "./email.service";

export type NotificationType =
  | "attendance"
  | "homework"
  | "marks"
  | "van"
  | "announcement"
  | "emergency"
  | "student_leave_submitted"
  | "student_leave_approved"
  | "student_leave_rejected"
  | "teacher_leave_submitted"
  | "teacher_leave_approved"
  | "teacher_leave_rejected"
  | "principal_leave_submitted"
  | "principal_leave_approved"
  | "principal_leave_rejected"
  | "timetable_change_suggested"
  | "profile_change_submitted"
  | "profile_change_approved"
  | "profile_change_rejected"
  | "activity_assigned"
  | "activity_completed"
  | "fee_due"
  | "fee_updated"
  | "fee_removed"
  | "payment_received"
  | "activity_practice_scheduled"
  | "activity_practice_work_assigned"
  | "activity_event"
  | "activity_certificate"
  | "activity_schedule_updated"
  | "registration_submitted"
  | "registration_approved"
  | "registration_rejected"
  | "school_request_submitted"
  | "school_request_approved"
  | "school_request_rejected"
  | "website_knowledge_completed";
export type NotificationPriority = "normal" | "high" | "critical";
export type AudienceScope = "school" | "class" | "student" | "role" | "user";

const NOTIFICATION_SELECT =
  "id, title, message, type, priority, metadata, audience_scope, audience_class_id, audience_user_id, " +
  "created_by, created_at, email_sent_at, classes(name, section)";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  metadata: Record<string, unknown>;
  audience_scope: AudienceScope;
  audience_class_id: string | null;
  audience_user_id: string | null;
  created_by: string | null;
  created_at: string;
  email_sent_at: string | null;
  classes: { name: string; section: string } | null;
}

interface CreateNotificationInput {
  title: string;
  message: string;
  audience_scope: AudienceScope;
  audience_class_id?: string;
  audience_user_id?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

async function insertNotification(schoolId: string, createdBy: string | null, input: CreateNotificationInput): Promise<NotificationRow> {
  if (input.audience_scope === "class" && input.audience_class_id) {
    await assertClassInSchool(schoolId, input.audience_class_id);
  }
  if ((input.audience_scope === "student" || input.audience_scope === "user") && input.audience_user_id) {
    await assertUserInSchool(schoolId, input.audience_user_id);
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      school_id: schoolId,
      created_by: createdBy,
      type: input.type ?? "announcement",
      priority: input.priority ?? "normal",
      metadata: input.metadata ?? {},
      ...input,
    })
    .select(NOTIFICATION_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data as unknown as NotificationRow;
}

export async function createNotification(schoolId: string, createdBy: string | null, input: CreateNotificationInput) {
  const notification = await insertNotification(schoolId, createdBy, input);
  void dispatchEmail(schoolId, notification);
  return notification;
}

/**
 * Bulk-creates one notification row per student (each independently visible
 * to that student and their linked parents via the existing 'student'
 * audience RLS policy) — used for events that fan out to a specific set of
 * students at once, e.g. a van route's pickup list, rather than an entire
 * class or the whole school.
 */
export async function notifyStudents(
  schoolId: string,
  createdBy: string | null,
  studentIds: string[],
  input: { title: string; message: string; type: NotificationType; priority?: NotificationPriority; metadata?: Record<string, unknown> }
) {
  const uniqueIds = Array.from(new Set(studentIds));
  if (uniqueIds.length === 0) return [];

  const rows = uniqueIds.map((studentId) => ({
    school_id: schoolId,
    created_by: createdBy,
    audience_scope: "student" as const,
    audience_user_id: studentId,
    title: input.title,
    message: input.message,
    type: input.type,
    priority: input.priority ?? "normal",
    metadata: input.metadata ?? {},
  }));

  const { data, error } = await supabaseAdmin.from("notifications").insert(rows).select(NOTIFICATION_SELECT);
  if (error) throw ApiError.internal(error.message);

  const notifications = (data ?? []) as unknown as NotificationRow[];
  for (const notification of notifications) {
    void dispatchEmail(schoolId, notification);
  }
  return notifications;
}

/**
 * Bulk-creates one `'user'`-scoped notification per userId — addressed to
 * exactly that person and nobody else (no parent fan-out like `notifyStudents`,
 * no whole-role broadcast like the `'role'` scope). Used for the leave
 * workflow: a specific class teacher, a specific admin/principal, or the
 * applicant being notified back once their request is resolved.
 * `schoolId` is nullable for platform-level notifications with no school
 * context (e.g. a school_admin's request reaching a super_admin, who may have
 * no home school at all) — the 'user' audience scope this function always
 * uses is delivered and read purely by `audience_user_id = auth.uid()`, never
 * by school_id (see 069_platform_notifications.sql).
 */
export async function notifyUsers(
  schoolId: string | null,
  createdBy: string | null,
  userIds: string[],
  input: { title: string; message: string; type: NotificationType; priority?: NotificationPriority; metadata?: Record<string, unknown> }
) {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return [];

  const rows = uniqueIds.map((userId) => ({
    school_id: schoolId,
    created_by: createdBy,
    audience_scope: "user" as const,
    audience_user_id: userId,
    title: input.title,
    message: input.message,
    type: input.type,
    priority: input.priority ?? "normal",
    metadata: input.metadata ?? {},
  }));

  const { data, error } = await supabaseAdmin.from("notifications").insert(rows).select(NOTIFICATION_SELECT);
  if (error) throw ApiError.internal(error.message);

  const notifications = (data ?? []) as unknown as NotificationRow[];
  for (const notification of notifications) {
    void dispatchEmail(schoolId, notification);
  }
  return notifications;
}

/** Student user ids for a class — shared by any caller that needs to fan out beyond the in-app notification row (e.g. push.service.ts), since resolveRecipients below only returns email addresses. */
export async function resolveClassUserIds(classId: string): Promise<string[]> {
  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("class_id", classId);
  if (studentsError) throw ApiError.internal(studentsError.message);

  return (students ?? []).map((s) => s.id as string);
}

/** School-wide broadcast, e.g. general announcements and emergency alerts. */
export async function createEmergencyAlert(schoolId: string, createdBy: string, input: { title: string; message: string }) {
  const notification = await insertNotification(schoolId, createdBy, {
    title: input.title,
    message: input.message,
    audience_scope: "school",
    type: "emergency",
    priority: "critical",
  });
  // Emergency alerts are time-critical — wait for the email blast rather
  // than firing-and-forgetting like every other notification type.
  await dispatchEmail(schoolId, notification);
  return notification;
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

  return attachReadState(data as unknown as NotificationRow[], requestingUserId);
}

/**
 * "My notifications" for any authenticated user, regardless of role — uses
 * the caller's own request-scoped (RLS-enforced) client instead of manually
 * reproducing the audience rules in JS, since the notifications RLS
 * policies (006 migration) already encode exactly who can see what.
 */
export async function listForUser(userScopedClient: SupabaseClient, userId: string, limit = 50) {
  const { data, error } = await userScopedClient
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw ApiError.internal(error.message);

  return attachReadState(data as unknown as NotificationRow[], userId, userScopedClient);
}

async function attachReadState(notifications: NotificationRow[], userId: string, client: SupabaseClient | typeof supabaseAdmin = supabaseAdmin) {
  if (!notifications || notifications.length === 0) return [];

  const { data: reads, error: readsError } = await client
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId)
    .in(
      "notification_id",
      notifications.map((n) => n.id)
    );
  if (readsError) throw ApiError.internal(readsError.message);

  const readIds = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
  return notifications.map((n) => ({ ...n, isRead: readIds.has(n.id) }));
}

export async function markRead(notificationId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from("notification_reads")
    .upsert({ notification_id: notificationId, user_id: userId }, { onConflict: "notification_id,user_id" });
  if (error) throw ApiError.internal(error.message);
}

/** Same as markRead, but through the caller's own RLS-scoped client (used by the generic /notifications/me endpoints). */
export async function markReadForUser(userScopedClient: SupabaseClient, notificationId: string, userId: string) {
  const { error } = await userScopedClient
    .from("notification_reads")
    .upsert({ notification_id: notificationId, user_id: userId }, { onConflict: "notification_id,user_id" });
  if (error) throw ApiError.internal(error.message);
}

/**
 * "Clear all" — marks every notification currently visible to this caller
 * (per RLS, via their own scoped client, same set listForUser would return)
 * as read in one batch upsert rather than one request per row.
 */
export async function markAllReadForUser(userScopedClient: SupabaseClient, userId: string) {
  const { data: visible, error: visibleError } = await userScopedClient.from("notifications").select("id");
  if (visibleError) throw ApiError.internal(visibleError.message);

  const ids = (visible ?? []).map((n) => n.id as string);
  if (ids.length === 0) return;

  const { error } = await userScopedClient
    .from("notification_reads")
    .upsert(
      ids.map((notification_id) => ({ notification_id, user_id: userId })),
      { onConflict: "notification_id,user_id" }
    );
  if (error) throw ApiError.internal(error.message);
}

interface RecipientRow {
  email: string;
  full_name: string | null;
}

async function resolveRecipients(schoolId: string, notification: NotificationRow): Promise<RecipientRow[]> {
  if (notification.audience_scope === "school") {
    const { data, error } = await supabaseAdmin.from("users").select("email, full_name").eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
    return data ?? [];
  }

  if (notification.audience_scope === "class" && notification.audience_class_id) {
    const { data: students, error: studentsError } = await supabaseAdmin
      .from("students")
      .select("id, users(email, full_name)")
      .eq("class_id", notification.audience_class_id);
    if (studentsError) throw ApiError.internal(studentsError.message);

    const studentRows = (students ?? []) as unknown as { id: string; users: RecipientRow | null }[];
    const recipients = studentRows.map((s) => s.users).filter((u): u is RecipientRow => !!u);
    return recipients;
  }

  if (notification.audience_scope === "student" && notification.audience_user_id) {
    const recipients: RecipientRow[] = [];
    const { data: target, error: targetError } = await supabaseAdmin
      .from("users")
      .select("email, full_name")
      .eq("id", notification.audience_user_id)
      .maybeSingle();
    if (targetError) throw ApiError.internal(targetError.message);
    if (target) recipients.push(target);
    return recipients;
  }

  if (notification.audience_scope === "user" && notification.audience_user_id) {
    const { data: target, error: targetError } = await supabaseAdmin
      .from("users")
      .select("email, full_name")
      .eq("id", notification.audience_user_id)
      .maybeSingle();
    if (targetError) throw ApiError.internal(targetError.message);
    return target ? [target] : [];
  }

  return [];
}

/**
 * Resolves recipients and sends the email, then stamps email_sent_at.
 * Never throws — a mail failure must never surface as an API error for the
 * request that created the notification (callers fire this without await
 * except for emergency alerts).
 */
async function dispatchEmail(schoolId: string | null, notification: NotificationRow) {
  // Platform-level notification (no school context) — there's no per-school
  // email settings to apply, and nothing school-scoped to email about.
  if (!schoolId) return;
  try {
    const { data: school } = await supabaseAdmin.from("schools").select("settings").eq("id", schoolId).maybeSingle();
    const settings = (school?.settings as Record<string, unknown> | undefined) ?? {};
    const notificationSettings = settings.notifications as { emailEnabled?: boolean } | undefined;
    if (notificationSettings?.emailEnabled === false) return;

    const recipients = await resolveRecipients(schoolId, notification);
    if (recipients.length === 0) return;

    const rawEmailSettings = settings.email as
      | { host?: string; port?: number; user?: string; password?: string; from?: string; secure?: boolean }
      | undefined;
    const emailOverride =
      rawEmailSettings?.host && rawEmailSettings.user && rawEmailSettings.password
        ? { host: rawEmailSettings.host, port: rawEmailSettings.port, user: rawEmailSettings.user, password: rawEmailSettings.password, from: rawEmailSettings.from, secure: rawEmailSettings.secure }
        : undefined;

    await emailService.sendNotificationEmail(notification, recipients, emailOverride);

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", notification.id);
    if (error) logger.error({ error }, "Failed to stamp notification.email_sent_at");
  } catch (err) {
    logger.error({ err, notificationId: notification.id }, "Notification email dispatch failed");
  }
}
