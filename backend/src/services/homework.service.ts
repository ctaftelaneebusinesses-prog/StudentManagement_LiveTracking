import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool } from "../utils/scopeGuards";
import { logger } from "../config/logger";
import * as notificationService from "./notification.service";
import * as pushService from "./push.service";

const HOMEWORK_SELECT =
  "id, class_id, subject_id, teacher_id, title, description, due_date, attachment_url, created_at, " +
  "status, reviewed_by, reviewed_at, review_note, " +
  "classes(name, section), subjects(name, code), users!homework_teacher_id_fkey(full_name)";

interface HomeworkRow {
  id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  attachment_url: string | null;
  created_at: string;
  status: "pending" | "approved" | "needs_changes";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  classes: { name: string; section: string } | null;
  subjects: { name: string; code: string } | null;
  users: { full_name: string } | null;
}

interface SubmissionRow {
  id: string;
  homework_id: string;
  submission_text: string | null;
  attachment_url: string | null;
  submitted_at: string;
}

export async function listForClass(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("homework")
    .select(HOMEWORK_SELECT)
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("due_date", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Notifies the class's students/parents (in-app + push) that a homework item is now visible — shared by auto-approve-at-create and explicit Class Teacher approval. */
function publishHomeworkNotifications(schoolId: string, teacherId: string, homework: HomeworkRow) {
  const teacherName = homework.users?.full_name ?? "Your teacher";
  const subjectName = homework.subjects?.name;
  const notificationTitle = subjectName
    ? `📚 ${subjectName} homework added`
    : `📚 New homework added`;
  const notificationMessage = `${subjectName ? `Your ${subjectName} teacher` : teacherName} has added new homework — "${homework.title}", due ${homework.due_date}.${homework.description ? ` ${homework.description}` : ""}`;

  notificationService
    .createNotification(schoolId, teacherId, {
      title: notificationTitle,
      message: notificationMessage,
      audience_scope: "class",
      audience_class_id: homework.class_id,
      type: "homework",
      metadata: { homework_id: homework.id, teacher_name: teacherName, subject_name: subjectName ?? null },
    })
    .catch((err) => logger.error({ err }, "Failed to send homework notification"));

  notificationService
    .resolveClassUserIds(homework.class_id)
    .then((userIds) => pushService.sendToUserIds(userIds, { title: notificationTitle, body: notificationMessage }))
    .catch((err) => logger.error({ err }, "Failed to send homework push notification"));
}

/** True when `teacherId` is the homeroom (Class Teacher) for `classId` — the auto-approve rule for homework they create themselves. */
async function isClassTeacherOfClass(classId: string, teacherId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, class_teacher_id")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  return data?.class_teacher_id === teacherId;
}

export async function createHomework(
  schoolId: string,
  teacherId: string,
  input: { class_id: string; subject_id?: string; title: string; description?: string; due_date: string; attachment_url?: string }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const isClassTeacher = await isClassTeacherOfClass(input.class_id, teacherId);
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("homework")
    .insert({
      school_id: schoolId,
      teacher_id: teacherId,
      ...input,
      status: isClassTeacher ? "approved" : "pending",
      reviewed_by: isClassTeacher ? teacherId : null,
      reviewed_at: isClassTeacher ? now : null,
    })
    .select(HOMEWORK_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  const homework = data as unknown as HomeworkRow;

  if (isClassTeacher) {
    publishHomeworkNotifications(schoolId, teacherId, homework);
  } else {
    await notifyClassTeacherOfPendingHomework(schoolId, teacherId, homework);
  }

  return homework;
}

/** Tells the class's homeroom teacher a subject teacher's homework is waiting for review — a no-op if the class has no class teacher assigned yet. */
async function notifyClassTeacherOfPendingHomework(schoolId: string, submittedBy: string, homework: HomeworkRow) {
  const { data: klass, error } = await supabaseAdmin
    .from("classes")
    .select("class_teacher_id")
    .eq("id", homework.class_id)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!klass?.class_teacher_id) return;

  const teacherName = homework.users?.full_name ?? "A subject teacher";
  const className = homework.classes ? `${homework.classes.name} - ${homework.classes.section}` : "your class";

  notificationService
    .notifyUsers(schoolId, submittedBy, [klass.class_teacher_id], {
      title: "Homework awaiting your review",
      message: `${teacherName} submitted "${homework.title}" for ${className} — review it before it reaches students.`,
      type: "homework",
      metadata: { homework_id: homework.id },
    })
    .catch((err) => logger.error({ err }, "Failed to notify class teacher of pending homework"));
}

/** Class Teacher's review queue for one class — every status, newest first. */
export async function listForReview(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("homework")
    .select(HOMEWORK_SELECT)
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function approveHomework(schoolId: string, homeworkId: string, reviewerId: string) {
  const { data, error } = await supabaseAdmin
    .from("homework")
    .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_note: null })
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .select(HOMEWORK_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Homework not found");

  const homework = data as unknown as HomeworkRow;
  publishHomeworkNotifications(schoolId, reviewerId, homework);

  if (homework.teacher_id && homework.teacher_id !== reviewerId) {
    notificationService
      .notifyUsers(schoolId, reviewerId, [homework.teacher_id], {
        title: "Homework approved",
        message: `Your homework "${homework.title}" was approved and is now visible to students.`,
        type: "homework",
        metadata: { homework_id: homework.id },
      })
      .catch((err) => logger.error({ err }, "Failed to notify teacher of homework approval"));
  }

  return homework;
}

export async function requestChanges(schoolId: string, homeworkId: string, reviewerId: string, note: string) {
  const { data, error } = await supabaseAdmin
    .from("homework")
    .update({ status: "needs_changes", reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_note: note })
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .select(HOMEWORK_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Homework not found");

  const homework = data as unknown as HomeworkRow;

  if (homework.teacher_id && homework.teacher_id !== reviewerId) {
    notificationService
      .notifyUsers(schoolId, reviewerId, [homework.teacher_id], {
        title: "Homework needs changes",
        message: `Please revise "${homework.title}": ${note}`,
        type: "homework",
        metadata: { homework_id: homework.id },
      })
      .catch((err) => logger.error({ err }, "Failed to notify teacher of requested homework changes"));
  }

  return homework;
}

/**
 * Editing homework you were asked to revise resubmits it for review — unless
 * the editor is the class teacher themself (their own edits stay approved,
 * matching the auto-approve rule at creation time).
 */
export async function updateHomework(schoolId: string, homeworkId: string, editorId: string, patch: Record<string, unknown>) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("homework")
    .select("class_id, status")
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);
  if (!existing) throw ApiError.notFound("Homework not found");

  const fullPatch = { ...patch } as Record<string, unknown>;
  if (existing.status === "needs_changes" && !(await isClassTeacherOfClass(existing.class_id, editorId))) {
    fullPatch.status = "pending";
    fullPatch.review_note = null;
  }

  const { data, error } = await supabaseAdmin
    .from("homework")
    .update(fullPatch)
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .select(HOMEWORK_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Homework not found");
  return data;
}

export async function deleteHomework(schoolId: string, homeworkId: string) {
  const { error } = await supabaseAdmin.from("homework").delete().eq("id", homeworkId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

/** Upcoming homework for the student's own class, soonest due first — the dashboard view. */
export async function listUpcomingForStudent(schoolId: string, studentId: string, limit = 10) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student?.class_id) return [];

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("homework")
    .select(HOMEWORK_SELECT)
    .eq("school_id", schoolId)
    .eq("class_id", student.class_id)
    .eq("status", "approved")
    .gte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(limit);
  if (error) throw ApiError.internal(error.message);
  return data;
}

const SUBMISSION_SELECT =
  "id, homework_id, student_id, submission_text, attachment_url, submitted_at, updated_at, " +
  "students(admission_no, users(full_name))";

/**
 * Creates or replaces the caller's own submission for one homework item
 * (one row per student per homework — resubmission just overwrites it).
 * Verifies the homework is actually assigned to the student's class before
 * accepting it, since there's no natural FK linking the two.
 */
export async function submitHomework(
  schoolId: string,
  studentId: string,
  homeworkId: string,
  input: { submission_text?: string; attachment_url?: string }
) {
  if (!input.submission_text && !input.attachment_url) {
    throw ApiError.badRequest("Provide submission text or an attachment");
  }

  const { data: homework, error: homeworkError } = await supabaseAdmin
    .from("homework")
    .select("id, class_id")
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (homeworkError) throw ApiError.internal(homeworkError.message);
  if (!homework) throw ApiError.notFound("Homework not found");

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student || student.class_id !== homework.class_id) {
    throw ApiError.forbidden("This homework is not assigned to your class");
  }

  const { data, error } = await supabaseAdmin
    .from("homework_submissions")
    .upsert(
      {
        school_id: schoolId,
        homework_id: homeworkId,
        student_id: studentId,
        submitted_at: new Date().toISOString(),
        ...input,
      },
      { onConflict: "homework_id,student_id" }
    )
    .select(SUBMISSION_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** All submissions for one homework item, most recent first — the teacher's grading/monitoring view. */
export async function listSubmissionsForHomework(schoolId: string, homeworkId: string) {
  const { data, error } = await supabaseAdmin
    .from("homework_submissions")
    .select(SUBMISSION_SELECT)
    .eq("school_id", schoolId)
    .eq("homework_id", homeworkId)
    .order("submitted_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

/**
 * Full homework history for the student's class (not just upcoming), each
 * item annotated with that student's own submission if one exists — powers
 * the student "My Homework" page and the parent "Monitor Homework" page.
 */
export async function listAllForStudent(schoolId: string, studentId: string) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student?.class_id) return [];

  const [{ data: homeworkRows, error: homeworkError }, { data: submissionRows, error: submissionError }] =
    await Promise.all([
      supabaseAdmin
        .from("homework")
        .select(HOMEWORK_SELECT)
        .eq("school_id", schoolId)
        .eq("class_id", student.class_id)
        .eq("status", "approved")
        .order("due_date", { ascending: false }),
      supabaseAdmin
        .from("homework_submissions")
        .select("id, homework_id, submission_text, attachment_url, submitted_at")
        .eq("school_id", schoolId)
        .eq("student_id", studentId),
    ]);
  if (homeworkError) throw ApiError.internal(homeworkError.message);
  if (submissionError) throw ApiError.internal(submissionError.message);

  const homework = (homeworkRows ?? []) as unknown as HomeworkRow[];
  const submissions = (submissionRows ?? []) as unknown as SubmissionRow[];
  const submissionByHomework = new Map(submissions.map((s) => [s.homework_id, s]));

  return homework.map((hw) => ({
    ...hw,
    submission: submissionByHomework.get(hw.id) ?? null,
  }));
}
