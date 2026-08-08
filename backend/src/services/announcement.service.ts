import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool, assertTeacherInSchool, assertExtracurricularStaffInSchool } from "../utils/scopeGuards";
import { escapeOrFilterValue } from "../utils/searchFilter";
import * as pushService from "./push.service";
import { logger } from "../config/logger";
import { ROLE_ID } from "../config/roles";

export type AudienceType =
  | "all"
  | "teachers"
  | "students"
  | "classes"
  | "principal"
  | "specific_teachers"
  | "accountants"
  | "extracurricular_staff"
  | "specific_extracurricular_staff";
export type AttachmentFileType = "pdf" | "image" | "document";

const ATTACHMENT_BUCKET = "announcement-attachments";
const ANNOUNCEMENT_SELECT = "id, school_id, title, body, audience_type, publish_at, notified_at, created_by, created_at, updated_at";

interface AttachmentInput {
  storage_path: string;
  file_name: string;
  file_type: AttachmentFileType;
  file_size?: number;
}

interface CreateAnnouncementInput {
  id: string;
  title: string;
  body: string;
  audience_type: AudienceType;
  class_ids?: string[];
  teacher_ids?: string[];
  ec_staff_ids?: string[];
  publish_at?: string;
  attachments?: AttachmentInput[];
}

interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  audience_type?: AudienceType;
  class_ids?: string[];
  teacher_ids?: string[];
  ec_staff_ids?: string[];
  publish_at?: string;
  new_attachments?: AttachmentInput[];
  remove_attachment_ids?: string[];
}

interface AnnouncementRow {
  id: string;
  school_id: string;
  title: string;
  body: string;
  audience_type: AudienceType;
  publish_at: string;
  notified_at: string | null;
}

function computeStatus(publishAt: string): "scheduled" | "published" {
  return new Date(publishAt) > new Date() ? "scheduled" : "published";
}

/** Plain-text excerpt of the rich-text body, used for the bell/push preview. */
function stripHtmlToExcerpt(html: string, maxLen = 300): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

async function getAnnouncementClassIds(announcementId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("announcement_classes").select("class_id").eq("announcement_id", announcementId);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((r) => r.class_id as string);
}

async function getAnnouncementTeacherIds(announcementId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("announcement_teachers").select("teacher_id").eq("announcement_id", announcementId);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((r) => r.teacher_id as string);
}

async function getAnnouncementEcStaffIds(announcementId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("announcement_extracurricular_staff")
    .select("staff_id")
    .eq("announcement_id", announcementId);
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((r) => r.staff_id as string);
}

/**
 * Resolves an audience into concrete recipient user ids — used only for the
 * push fan-out (a direct send to stored subscriptions, unlike the bell/
 * Realtime pipeline which relies on RLS instead of an explicit recipient
 * list). `students`/`teachers` map straight onto their tables (all keyed
 * `id = users.id`, per schema.sql); `classes` resolves to the students in
 * those classes.
 */
async function resolveAudienceUserIds(
  schoolId: string,
  audienceType: AudienceType,
  classIds: string[],
  teacherIds: string[] = [],
  ecStaffIds: string[] = []
): Promise<string[]> {
  if (audienceType === "specific_teachers") {
    return teacherIds;
  }
  if (audienceType === "specific_extracurricular_staff") {
    return ecStaffIds;
  }
  if (audienceType === "accountants") {
    const { data, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("school_id", schoolId).eq("role_id", ROLE_ID.ACCOUNTANT);
    if (error) throw ApiError.internal(error.message);
    return (data ?? []).map((r) => r.user_id as string);
  }
  if (audienceType === "extracurricular_staff") {
    const { data, error } = await supabaseAdmin.from("extracurricular_staff").select("id").eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
    return (data ?? []).map((s) => s.id as string);
  }
  if (audienceType === "all") {
    const { data, error } = await supabaseAdmin.from("users").select("id").eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
    return (data ?? []).map((u) => u.id);
  }
  if (audienceType === "teachers") {
    const { data, error } = await supabaseAdmin.from("teachers").select("id").eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
    return (data ?? []).map((t) => t.id);
  }
  if (audienceType === "students") {
    const { data, error } = await supabaseAdmin.from("students").select("id").eq("school_id", schoolId);
    if (error) throw ApiError.internal(error.message);
    return (data ?? []).map((s) => s.id);
  }
  if (audienceType === "principal") {
    // No dedicated `principals` table (unlike teachers/parents/students) —
    // resolve via user_roles (multi-role aware) rather than users.role_id
    // (just the "primary" role), so a user holding principal as a secondary
    // role is still included.
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("role_id", ROLE_ID.PRINCIPAL);
    if (error) throw ApiError.internal(error.message);
    return (data ?? []).map((r) => r.user_id as string);
  }

  // classes
  if (classIds.length === 0) return [];
  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .in("class_id", classIds);
  if (studentsError) throw ApiError.internal(studentsError.message);

  const studentIds = (students ?? []).map((s) => s.id as string);
  return studentIds;
}

async function insertNotificationRows(
  schoolId: string,
  announcement: { id: string; title: string },
  excerpt: string,
  classIds: string[],
  audienceType: AudienceType,
  teacherIds: string[] = [],
  ecStaffIds: string[] = []
) {
  const roleByAudience: Partial<Record<AudienceType, string>> = {
    teachers: "teacher",
    students: "student",
    principal: "principal",
    accountants: "accountant",
    extracurricular_staff: "extracurricular_staff",
  };

  const rows =
    audienceType === "all"
      ? [{ audience_scope: "school" as const, audience_class_id: null, audience_role: null, audience_user_id: null }]
      : audienceType === "classes"
        ? classIds.map((classId) => ({ audience_scope: "class" as const, audience_class_id: classId, audience_role: null, audience_user_id: null }))
        : audienceType === "specific_teachers"
          ? teacherIds.map((teacherId) => ({ audience_scope: "user" as const, audience_class_id: null, audience_role: null, audience_user_id: teacherId }))
          : audienceType === "specific_extracurricular_staff"
            ? ecStaffIds.map((staffId) => ({ audience_scope: "user" as const, audience_class_id: null, audience_role: null, audience_user_id: staffId }))
            : [{ audience_scope: "role" as const, audience_class_id: null, audience_role: roleByAudience[audienceType]!, audience_user_id: null }];

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("notifications").insert(
    rows.map((r) => ({
      school_id: schoolId,
      title: announcement.title,
      message: excerpt,
      audience_scope: r.audience_scope,
      audience_class_id: r.audience_class_id,
      audience_role: r.audience_role,
      audience_user_id: r.audience_user_id,
      type: "announcement" as const,
      priority: "normal" as const,
      related_announcement_id: announcement.id,
      metadata: { announcement_id: announcement.id },
    }))
  );
  if (error) throw ApiError.internal(error.message);
}

/**
 * The one-time fan-out that happens when an announcement's publish_at is
 * reached (immediately on create/"publish now", or later via the scheduler):
 * inserts the corresponding notifications row(s) (bell + Realtime + existing
 * foreground browser notifications) and sends a real push notification to
 * every subscribed device of the resolved audience. Stamps `notified_at` so
 * this never runs twice for the same announcement.
 */
export async function publishAnnouncement(schoolId: string, announcement: { id: string; title: string; body: string; audience_type: AudienceType }) {
  const classIds = announcement.audience_type === "classes" ? await getAnnouncementClassIds(announcement.id) : [];
  const teacherIds = announcement.audience_type === "specific_teachers" ? await getAnnouncementTeacherIds(announcement.id) : [];
  const ecStaffIds = announcement.audience_type === "specific_extracurricular_staff" ? await getAnnouncementEcStaffIds(announcement.id) : [];
  const excerpt = stripHtmlToExcerpt(announcement.body);

  await insertNotificationRows(schoolId, announcement, excerpt, classIds, announcement.audience_type, teacherIds, ecStaffIds);

  const userIds = await resolveAudienceUserIds(schoolId, announcement.audience_type, classIds, teacherIds, ecStaffIds);
  pushService.sendToUserIds(userIds, { title: announcement.title, body: excerpt, url: "/dashboard/profile" }).catch((err) => {
    logger.error({ err, announcementId: announcement.id }, "Push fan-out failed");
  });

  const { error } = await supabaseAdmin
    .from("announcements")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", announcement.id);
  if (error) throw ApiError.internal(error.message);
}

export async function listAnnouncements(schoolId: string, filters: { search?: string; page: number; pageSize: number }) {
  let query = supabaseAdmin
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT, { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (filters.search) {
    query = query.ilike("title", escapeOrFilterValue(`%${filters.search}%`));
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw ApiError.internal(error.message);

  const items = await Promise.all(
    (data ?? []).map(async (a) => {
      const [{ count: attachmentCount }, classRows, teacherRows, ecStaffRows] = await Promise.all([
        supabaseAdmin.from("announcement_attachments").select("id", { count: "exact", head: true }).eq("announcement_id", a.id),
        a.audience_type === "classes"
          ? supabaseAdmin.from("announcement_classes").select("classes(name, section)").eq("announcement_id", a.id)
          : Promise.resolve({ data: [] as { classes: { name: string; section: string } | null }[] }),
        a.audience_type === "specific_teachers"
          ? supabaseAdmin.from("announcement_teachers").select("teachers(users(full_name))").eq("announcement_id", a.id)
          : Promise.resolve({ data: [] as { teachers: { users: { full_name: string } | null } | null }[] }),
        a.audience_type === "specific_extracurricular_staff"
          ? supabaseAdmin
              .from("announcement_extracurricular_staff")
              .select("extracurricular_staff(users(full_name))")
              .eq("announcement_id", a.id)
          : Promise.resolve({ data: [] as { extracurricular_staff: { users: { full_name: string } | null } | null }[] }),
      ]);

      const classNames = ((classRows.data ?? []) as { classes: { name: string; section: string } | null }[])
        .map((c) => (c.classes ? [c.classes.name, c.classes.section].filter(Boolean).join(" ") : null))
        .filter((n): n is string => !!n);

      const teacherNames = ((teacherRows.data ?? []) as { teachers: { users: { full_name: string } | null } | null }[])
        .map((t) => t.teachers?.users?.full_name ?? null)
        .filter((n): n is string => !!n);

      const ecStaffNames = ((ecStaffRows.data ?? []) as { extracurricular_staff: { users: { full_name: string } | null } | null }[])
        .map((s) => s.extracurricular_staff?.users?.full_name ?? null)
        .filter((n): n is string => !!n);

      return {
        ...a,
        status: computeStatus(a.publish_at),
        attachmentCount: attachmentCount ?? 0,
        audienceSummary:
          a.audience_type === "classes"
            ? classNames.join(", ") || "Selected classes"
            : a.audience_type === "specific_teachers"
              ? teacherNames.join(", ") || "Selected teachers"
              : a.audience_type === "specific_extracurricular_staff"
                ? ecStaffNames.join(", ") || "Selected staff"
                : a.audience_type,
      };
    })
  );

  return { items, total: count ?? 0, page: filters.page, pageSize: filters.pageSize };
}

export async function getAnnouncement(schoolId: string, id: string) {
  const { data, error } = await supabaseAdmin.from("announcements").select(ANNOUNCEMENT_SELECT).eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Announcement not found");

  const [
    { data: classRows, error: classError },
    { data: teacherRows, error: teacherError },
    { data: ecStaffRows, error: ecStaffError },
    { data: attachmentRows, error: attachmentError },
  ] = await Promise.all([
    supabaseAdmin.from("announcement_classes").select("class_id, classes(name, section)").eq("announcement_id", id),
    supabaseAdmin.from("announcement_teachers").select("teacher_id, teachers(users(full_name))").eq("announcement_id", id),
    supabaseAdmin
      .from("announcement_extracurricular_staff")
      .select("staff_id, extracurricular_staff(users(full_name))")
      .eq("announcement_id", id),
    supabaseAdmin
      .from("announcement_attachments")
      .select("id, file_name, file_type, storage_path, file_size, created_at")
      .eq("announcement_id", id),
  ]);
  if (classError) throw ApiError.internal(classError.message);
  if (teacherError) throw ApiError.internal(teacherError.message);
  if (ecStaffError) throw ApiError.internal(ecStaffError.message);
  if (attachmentError) throw ApiError.internal(attachmentError.message);

  const attachments = await Promise.all(
    (attachmentRows ?? []).map(async (a) => {
      const { data: signed } = await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).createSignedUrl(a.storage_path, 60 * 60);
      return { ...a, url: signed?.signedUrl ?? null };
    })
  );

  const classList = (classRows ?? []) as unknown as { class_id: string; classes: { name: string; section: string } | null }[];
  const teacherList = (teacherRows ?? []) as unknown as { teacher_id: string; teachers: { users: { full_name: string } | null } | null }[];
  const ecStaffList = (ecStaffRows ?? []) as unknown as {
    staff_id: string;
    extracurricular_staff: { users: { full_name: string } | null } | null;
  }[];

  return {
    ...data,
    status: computeStatus(data.publish_at),
    classes: classList.map((c) => ({
      id: c.class_id,
      name: c.classes?.name ?? null,
      section: c.classes?.section ?? null,
    })),
    teachers: teacherList.map((t) => ({
      id: t.teacher_id,
      full_name: t.teachers?.users?.full_name ?? null,
    })),
    ecStaff: ecStaffList.map((s) => ({
      id: s.staff_id,
      full_name: s.extracurricular_staff?.users?.full_name ?? null,
    })),
    attachments,
  };
}

export async function createAnnouncement(schoolId: string, createdBy: string, input: CreateAnnouncementInput) {
  if (input.audience_type === "classes") {
    const classIds = input.class_ids ?? [];
    if (classIds.length === 0) throw ApiError.badRequest("Select at least one class");
    for (const classId of classIds) {
      await assertClassInSchool(schoolId, classId);
    }
  }

  if (input.audience_type === "specific_teachers") {
    const teacherIds = input.teacher_ids ?? [];
    if (teacherIds.length === 0) throw ApiError.badRequest("Select at least one teacher");
    for (const teacherId of teacherIds) {
      await assertTeacherInSchool(schoolId, teacherId);
    }
  }

  if (input.audience_type === "specific_extracurricular_staff") {
    const ecStaffIds = input.ec_staff_ids ?? [];
    if (ecStaffIds.length === 0) throw ApiError.badRequest("Select at least one staff member");
    for (const staffId of ecStaffIds) {
      await assertExtracurricularStaffInSchool(schoolId, staffId);
    }
  }

  const publishAt = input.publish_at ?? new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .insert({
      id: input.id,
      school_id: schoolId,
      title: input.title,
      body: input.body,
      audience_type: input.audience_type,
      publish_at: publishAt,
      created_by: createdBy,
    })
    .select(ANNOUNCEMENT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  if (input.audience_type === "classes" && input.class_ids && input.class_ids.length > 0) {
    const { error: classError } = await supabaseAdmin
      .from("announcement_classes")
      .insert(input.class_ids.map((classId) => ({ announcement_id: input.id, class_id: classId })));
    if (classError) throw ApiError.internal(classError.message);
  }

  if (input.audience_type === "specific_teachers" && input.teacher_ids && input.teacher_ids.length > 0) {
    const { error: teacherError } = await supabaseAdmin
      .from("announcement_teachers")
      .insert(input.teacher_ids.map((teacherId) => ({ announcement_id: input.id, teacher_id: teacherId })));
    if (teacherError) throw ApiError.internal(teacherError.message);
  }

  if (input.audience_type === "specific_extracurricular_staff" && input.ec_staff_ids && input.ec_staff_ids.length > 0) {
    const { error: ecStaffError } = await supabaseAdmin
      .from("announcement_extracurricular_staff")
      .insert(input.ec_staff_ids.map((staffId) => ({ announcement_id: input.id, staff_id: staffId })));
    if (ecStaffError) throw ApiError.internal(ecStaffError.message);
  }

  if (input.attachments && input.attachments.length > 0) {
    const { error: attachmentError } = await supabaseAdmin.from("announcement_attachments").insert(
      input.attachments.map((a) => ({
        announcement_id: input.id,
        file_name: a.file_name,
        file_type: a.file_type,
        storage_path: a.storage_path,
        file_size: a.file_size,
      }))
    );
    if (attachmentError) throw ApiError.internal(attachmentError.message);
  }

  if (new Date(publishAt).getTime() <= Date.now()) {
    await publishAnnouncement(schoolId, data as AnnouncementRow);
  }

  return getAnnouncement(schoolId, input.id);
}

export async function updateAnnouncement(schoolId: string, id: string, input: UpdateAnnouncementInput) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("announcements")
    .select("id, publish_at, notified_at, audience_type")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!existing) throw ApiError.notFound("Announcement not found");

  const audienceType = input.audience_type ?? (existing.audience_type as AudienceType);
  if (audienceType === "classes" && input.class_ids) {
    for (const classId of input.class_ids) {
      await assertClassInSchool(schoolId, classId);
    }
  }
  if (audienceType === "specific_teachers" && input.teacher_ids) {
    for (const teacherId of input.teacher_ids) {
      await assertTeacherInSchool(schoolId, teacherId);
    }
  }
  if (audienceType === "specific_extracurricular_staff" && input.ec_staff_ids) {
    for (const staffId of input.ec_staff_ids) {
      await assertExtracurricularStaffInSchool(schoolId, staffId);
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;
  if (input.audience_type !== undefined) patch.audience_type = input.audience_type;
  if (input.publish_at !== undefined) patch.publish_at = input.publish_at;

  const { error: updateError } = await supabaseAdmin.from("announcements").update(patch).eq("id", id).eq("school_id", schoolId);
  if (updateError) throw ApiError.internal(updateError.message);

  if (input.audience_type !== undefined || input.class_ids !== undefined) {
    const { error: deleteClassesError } = await supabaseAdmin.from("announcement_classes").delete().eq("announcement_id", id);
    if (deleteClassesError) throw ApiError.internal(deleteClassesError.message);

    if (audienceType === "classes" && input.class_ids && input.class_ids.length > 0) {
      const { error: classError } = await supabaseAdmin
        .from("announcement_classes")
        .insert(input.class_ids.map((classId) => ({ announcement_id: id, class_id: classId })));
      if (classError) throw ApiError.internal(classError.message);
    }
  }

  if (input.audience_type !== undefined || input.teacher_ids !== undefined) {
    const { error: deleteTeachersError } = await supabaseAdmin.from("announcement_teachers").delete().eq("announcement_id", id);
    if (deleteTeachersError) throw ApiError.internal(deleteTeachersError.message);

    if (audienceType === "specific_teachers" && input.teacher_ids && input.teacher_ids.length > 0) {
      const { error: teacherError } = await supabaseAdmin
        .from("announcement_teachers")
        .insert(input.teacher_ids.map((teacherId) => ({ announcement_id: id, teacher_id: teacherId })));
      if (teacherError) throw ApiError.internal(teacherError.message);
    }
  }

  if (input.audience_type !== undefined || input.ec_staff_ids !== undefined) {
    const { error: deleteEcStaffError } = await supabaseAdmin.from("announcement_extracurricular_staff").delete().eq("announcement_id", id);
    if (deleteEcStaffError) throw ApiError.internal(deleteEcStaffError.message);

    if (audienceType === "specific_extracurricular_staff" && input.ec_staff_ids && input.ec_staff_ids.length > 0) {
      const { error: ecStaffError } = await supabaseAdmin
        .from("announcement_extracurricular_staff")
        .insert(input.ec_staff_ids.map((staffId) => ({ announcement_id: id, staff_id: staffId })));
      if (ecStaffError) throw ApiError.internal(ecStaffError.message);
    }
  }

  if (input.remove_attachment_ids && input.remove_attachment_ids.length > 0) {
    const { data: toRemove } = await supabaseAdmin
      .from("announcement_attachments")
      .select("storage_path")
      .in("id", input.remove_attachment_ids);
    if (toRemove && toRemove.length > 0) {
      await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).remove(toRemove.map((r) => r.storage_path));
    }
    const { error: removeError } = await supabaseAdmin.from("announcement_attachments").delete().in("id", input.remove_attachment_ids);
    if (removeError) throw ApiError.internal(removeError.message);
  }

  if (input.new_attachments && input.new_attachments.length > 0) {
    const { error: attachmentError } = await supabaseAdmin.from("announcement_attachments").insert(
      input.new_attachments.map((a) => ({
        announcement_id: id,
        file_name: a.file_name,
        file_type: a.file_type,
        storage_path: a.storage_path,
        file_size: a.file_size,
      }))
    );
    if (attachmentError) throw ApiError.internal(attachmentError.message);
  }

  // "Publish now": only fan out if this edit moves publish_at into the past
  // and it hasn't already been notified — never re-notify a delivered one.
  const newPublishAt = input.publish_at !== undefined ? input.publish_at : existing.publish_at;
  if (!existing.notified_at && new Date(newPublishAt as string).getTime() <= Date.now()) {
    const updated = await getAnnouncement(schoolId, id);
    await publishAnnouncement(schoolId, updated);
  }

  return getAnnouncement(schoolId, id);
}

export async function deleteAnnouncement(schoolId: string, id: string) {
  const { data: attachments, error: fetchError } = await supabaseAdmin
    .from("announcement_attachments")
    .select("storage_path")
    .eq("announcement_id", id);
  if (fetchError) throw ApiError.internal(fetchError.message);

  if (attachments && attachments.length > 0) {
    await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).remove(attachments.map((a) => a.storage_path));
  }

  const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

/** Scheduled announcements whose publish_at has arrived but haven't been fanned out yet — used by announcementScheduler.ts. */
export async function listDueScheduled(): Promise<AnnouncementRow[]> {
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("id, school_id, title, body, audience_type, publish_at, notified_at")
    .is("notified_at", null)
    .lte("publish_at", new Date().toISOString());
  if (error) throw ApiError.internal(error.message);
  return (data ?? []) as unknown as AnnouncementRow[];
}
