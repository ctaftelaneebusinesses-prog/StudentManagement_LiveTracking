import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { assertClassInSchool, assertExamInSchool } from "../utils/scopeGuards";
import { logger } from "../config/logger";
import * as notificationService from "./notification.service";
import * as pushService from "./push.service";

export function calculateGrade(marksObtained: number, maxMarks: number): string {
  if (!Number.isFinite(marksObtained) || !Number.isFinite(maxMarks) || maxMarks <= 0) {
    return "N/A";
  }

  const percentage = (marksObtained / maxMarks) * 100;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "E";
}

function resolveGrade(inputGrade: string | undefined, marksObtained: number, maxMarks: number): string {
  const normalized = inputGrade?.trim();
  return normalized ? normalized : calculateGrade(marksObtained, maxMarks);
}

const EXAM_SELECT = "id, name, exam_date, class_id, academic_year_id, is_published, published_at, classes(name, section)";

export async function listExams(schoolId: string, classId?: string) {
  let query = supabaseAdmin
    .from("exams")
    .select(EXAM_SELECT)
    .eq("school_id", schoolId)
    .order("exam_date", { ascending: false });
  if (classId) query = query.eq("class_id", classId);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function createExam(
  schoolId: string,
  input: { class_id: string; academic_year_id?: string; name: string; exam_date?: string }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const { data, error } = await supabaseAdmin
    .from("exams")
    .insert({ school_id: schoolId, ...input })
    .select(EXAM_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

/**
 * "All classes" exam creation: fans out one `exams` row per active class in
 * the school (optionally narrowed to one academic year) rather than
 * introducing a many-classes-per-exam data model. Each class then owns its
 * own row, schedule, and marks exactly like any other exam — every existing
 * teacher/student visibility rule keeps working unchanged.
 */
export async function createExamForAllClasses(
  schoolId: string,
  input: { academic_year_id?: string; name: string; exam_date?: string }
) {
  let classesQuery = supabaseAdmin.from("classes").select("id").eq("school_id", schoolId).eq("status", "active");
  if (input.academic_year_id) classesQuery = classesQuery.eq("academic_year_id", input.academic_year_id);

  const { data: classes, error: classesError } = await classesQuery;
  if (classesError) throw ApiError.internal(classesError.message);
  if (!classes || classes.length === 0) {
    throw ApiError.badRequest("No active classes found to create this exam for");
  }

  const rows = classes.map((c) => ({
    school_id: schoolId,
    class_id: c.id,
    academic_year_id: input.academic_year_id,
    name: input.name,
    exam_date: input.exam_date,
  }));

  const { data, error } = await supabaseAdmin.from("exams").insert(rows).select(EXAM_SELECT);
  if (error) throw ApiError.internal(error.message);
  return data;
}

/**
 * "Selected classes/sections" exam creation — the same one-row-per-class fan
 * out as createExamForAllClasses, just scoped to an explicit subset. Since
 * each `classes` row is already a specific class+section combination, a list
 * of class_ids doubles as "selected sections" — no separate section concept
 * is needed in this schema.
 */
export async function createExamForSelectedClasses(
  schoolId: string,
  input: { class_ids: string[]; academic_year_id?: string; name: string; exam_date?: string }
) {
  const { data: classes, error: classesError } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", input.class_ids);
  if (classesError) throw ApiError.internal(classesError.message);
  if (!classes || classes.length !== input.class_ids.length) {
    throw ApiError.notFound("One or more selected classes were not found");
  }

  const rows = classes.map((c) => ({
    school_id: schoolId,
    class_id: c.id,
    academic_year_id: input.academic_year_id,
    name: input.name,
    exam_date: input.exam_date,
  }));

  const { data, error } = await supabaseAdmin.from("exams").insert(rows).select(EXAM_SELECT);
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function updateExam(
  schoolId: string,
  examId: string,
  patch: { class_id?: string; academic_year_id?: string; name?: string; exam_date?: string }
) {
  await assertExamInSchool(schoolId, examId);
  if (patch.class_id) await assertClassInSchool(schoolId, patch.class_id);

  const { data, error } = await supabaseAdmin
    .from("exams")
    .update(patch)
    .eq("id", examId)
    .eq("school_id", schoolId)
    .select(EXAM_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Teacher-created "assessments" — a single-subject exam row (class + subject
// + date + max marks + instructions) created from the Teacher Portal, reusing
// the same `exams` table the admin Exams module writes to (see
// 032_teacher_portal_extras.sql for the extra columns) rather than a
// parallel model. Any staff-created exam already shows up for the class via
// listUpcomingAssessmentsForClasses below, so teachers see the full picture.
// ---------------------------------------------------------------------------
const ASSESSMENT_SELECT =
  "id, name, exam_date, class_id, subject_id, max_marks, instructions, created_by, created_at, " +
  "classes(name, section), subjects(name, code)";

export async function createAssessment(
  schoolId: string,
  teacherId: string,
  input: { class_id: string; subject_id: string; name: string; exam_date: string; max_marks?: number; instructions?: string }
) {
  await assertClassInSchool(schoolId, input.class_id);

  const { data, error } = await supabaseAdmin
    .from("exams")
    .insert({ school_id: schoolId, created_by: teacherId, ...input })
    .select(ASSESSMENT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listAssessmentsCreatedByTeacher(schoolId: string, teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("exams")
    .select(ASSESSMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("created_by", teacherId)
    .order("exam_date", { ascending: true });
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Every exam scheduled today or later for a set of classes — staff-created or teacher-created alike — powers the "Upcoming Assessments" dashboard count/list. */
export async function listUpcomingAssessmentsForClasses(schoolId: string, classIds: string[]) {
  if (classIds.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("exams")
    .select(ASSESSMENT_SELECT)
    .eq("school_id", schoolId)
    .in("class_id", classIds)
    .gte("exam_date", today)
    .order("exam_date", { ascending: true });
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Upcoming exams for one student's own class — the portal dashboard's "Upcoming Exams" card, sliced to `limit` most imminent. */
export async function getUpcomingExamsForStudent(schoolId: string, studentId: string, limit = 5) {
  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!student?.class_id) return [];

  const upcoming = await listUpcomingAssessmentsForClasses(schoolId, [student.class_id]);
  return upcoming.slice(0, limit);
}

export async function deleteExam(schoolId: string, examId: string) {
  await assertExamInSchool(schoolId, examId);
  const { error } = await supabaseAdmin.from("exams").delete().eq("id", examId).eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

export async function publishExam(schoolId: string, examId: string, publishedBy: string, isPublished: boolean) {
  await assertExamInSchool(schoolId, examId);

  const { data, error } = await supabaseAdmin
    .from("exams")
    .update({
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      published_by: isPublished ? publishedBy : null,
    })
    .eq("id", examId)
    .eq("school_id", schoolId)
    .select("id, name, exam_date, class_id, is_published, published_at")
    .single();
  if (error) throw ApiError.internal(error.message);

  if (isPublished) {
    const { data: students } = await supabaseAdmin.from("exam_marks").select("student_id").eq("exam_id", examId);
    const studentIds = Array.from(new Set((students ?? []).map((r) => r.student_id)));
    if (studentIds.length > 0) {
      notifyMarksPublished(schoolId, examId, studentIds, publishedBy).catch((err) =>
        logger.error({ err }, "Failed to send results-published notifications")
      );
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Exam schedule ("Subject Schedule" editor / "Exam Timetable" view+export)
// ---------------------------------------------------------------------------
const SCHEDULE_SELECT = "id, exam_id, subject_id, exam_date, start_time, end_time, room, max_marks, subjects(name, code)";

export async function listSchedule(schoolId: string, examId: string) {
  await assertExamInSchool(schoolId, examId);
  const { data, error } = await supabaseAdmin
    .from("exam_schedule")
    .select(SCHEDULE_SELECT)
    .eq("school_id", schoolId)
    .eq("exam_id", examId)
    .order("exam_date")
    .order("start_time");
  if (error) throw ApiError.internal(error.message);
  return data;
}

/** Every exam scheduled for a student's own class (not just upcoming) — the portal Exams page's full list. */
export async function listExamsForStudent(schoolId: string, studentId: string) {
  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!student?.class_id) return [];

  return listExams(schoolId, student.class_id);
}

/** One exam's subject-wise schedule, for a student in that exam's own class — a read-only counterpart to the staff-only listSchedule above (assertExamInSchool alone doesn't confirm the exam is even for this student's class). */
export async function getExamScheduleForStudent(schoolId: string, studentId: string, examId: string) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);

  const { data: exam, error: examError } = await supabaseAdmin
    .from("exams")
    .select("id, class_id")
    .eq("id", examId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (examError) throw ApiError.internal(examError.message);
  if (!exam || !student?.class_id || exam.class_id !== student.class_id) {
    throw ApiError.notFound("Exam not found");
  }

  return listSchedule(schoolId, examId);
}

export async function createScheduleEntry(
  schoolId: string,
  examId: string,
  input: { subject_id: string; exam_date: string; start_time: string; end_time: string; room?: string; max_marks?: number }
) {
  await assertExamInSchool(schoolId, examId);

  const { data, error } = await supabaseAdmin
    .from("exam_schedule")
    .insert({ school_id: schoolId, exam_id: examId, ...input })
    .select(SCHEDULE_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("This subject is already scheduled for this exam");
    throw ApiError.internal(error.message);
  }
  return data;
}

export async function updateScheduleEntry(
  schoolId: string,
  examId: string,
  scheduleId: string,
  patch: { subject_id?: string; exam_date?: string; start_time?: string; end_time?: string; room?: string; max_marks?: number }
) {
  const { data, error } = await supabaseAdmin
    .from("exam_schedule")
    .update(patch)
    .eq("id", scheduleId)
    .eq("exam_id", examId)
    .eq("school_id", schoolId)
    .select(SCHEDULE_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("This subject is already scheduled for this exam");
    throw ApiError.internal(error.message);
  }
  if (!data) throw ApiError.notFound("Schedule entry not found");
  return data;
}

export async function deleteScheduleEntry(schoolId: string, examId: string, scheduleId: string) {
  const { error } = await supabaseAdmin
    .from("exam_schedule")
    .delete()
    .eq("id", scheduleId)
    .eq("exam_id", examId)
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);
}

// ---------------------------------------------------------------------------
// Exam documents (question papers, hall tickets, result sheets, ...)
// ---------------------------------------------------------------------------
const DOCUMENT_BUCKET = "exam-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Composed (written-in-browser) documents have no storage_path — skip the signed-URL round-trip for them. */
async function withSignedUrl<T extends { storage_path: string | null }>(doc: T) {
  if (!doc.storage_path) return { ...doc, url: null };
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...doc, url: error ? null : data?.signedUrl ?? null };
}

const DOCUMENT_SELECT =
  "id, doc_type, file_name, storage_path, content, notes, is_published, published_at, published_by, uploaded_at, uploaded_by";

/**
 * `onlyUploadedBy` restricts the result to one uploader's own documents — used
 * for a subject teacher who is neither staff nor the exam's class teacher, so
 * they only ever see the papers they personally wrote/uploaded, never a
 * colleague's (the Class Teacher and staff always get the unfiltered list).
 */
export async function listExamDocuments(schoolId: string, examId: string, options: { onlyUploadedBy?: string } = {}) {
  await assertExamInSchool(schoolId, examId);

  let query = supabaseAdmin
    .from("exam_documents")
    .select(DOCUMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("exam_id", examId)
    .order("uploaded_at", { ascending: false });
  if (options.onlyUploadedBy) query = query.eq("uploaded_by", options.onlyUploadedBy);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);

  return Promise.all((data ?? []).map(withSignedUrl));
}

/**
 * Records a question paper (or other exam document) either as a file the
 * frontend has already uploaded straight to the private `exam-documents`
 * bucket (keyed `{school_id}/{exam_id}/{filename}`), or as HTML the teacher
 * composed directly in the browser — exactly one of the two must be given.
 * Always starts unpublished; a Class Teacher/staff must explicitly publish it
 * (see publishExamDocument) before students/parents can see it.
 */
export async function addExamDocument(
  schoolId: string,
  examId: string,
  uploadedBy: string,
  input: { doc_type: string; file_name?: string; storage_path?: string; content?: string; notes?: string }
) {
  await assertExamInSchool(schoolId, examId);

  if (input.storage_path) {
    const expectedPrefix = `${schoolId}/${examId}/`;
    if (!input.storage_path.startsWith(expectedPrefix)) {
      throw ApiError.badRequest("storage_path must be under the exam's own folder");
    }
  } else if (!input.content) {
    throw ApiError.badRequest("Provide either an uploaded file or written content");
  }

  const { data, error } = await supabaseAdmin
    .from("exam_documents")
    .insert({
      school_id: schoolId,
      exam_id: examId,
      doc_type: input.doc_type,
      file_name: input.file_name ?? "Question Paper",
      storage_path: input.storage_path ?? null,
      content: input.content ?? null,
      notes: input.notes,
      uploaded_by: uploadedBy,
    })
    .select(DOCUMENT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);

  return withSignedUrl(data);
}

/** Class Teacher/staff-only: makes a question paper visible to the class's students/parents, or takes it back down. */
export async function publishExamDocument(
  schoolId: string,
  examId: string,
  documentId: string,
  publishedBy: string,
  isPublished: boolean
) {
  await assertExamInSchool(schoolId, examId);

  const { data, error } = await supabaseAdmin
    .from("exam_documents")
    .update({
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      published_by: isPublished ? publishedBy : null,
    })
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .eq("exam_id", examId)
    .select(DOCUMENT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Document not found");

  return withSignedUrl(data);
}

export async function deleteExamDocument(schoolId: string, examId: string, documentId: string) {
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from("exam_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .eq("exam_id", examId)
    .maybeSingle();
  if (fetchError) throw ApiError.internal(fetchError.message);
  if (!doc) throw ApiError.notFound("Document not found");

  if (doc.storage_path) {
    await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);
  }

  const { error } = await supabaseAdmin
    .from("exam_documents")
    .delete()
    .eq("id", documentId)
    .eq("school_id", schoolId)
    .eq("exam_id", examId);
  if (error) throw ApiError.internal(error.message);
}

// ---------------------------------------------------------------------------
// Exam report — per-student breakdown + class-wide stats for one exam.
// ---------------------------------------------------------------------------
const PASS_PERCENTAGE = 40;

export async function getExamReport(schoolId: string, examId: string) {
  await assertExamInSchool(schoolId, examId);

  const [{ data: exam, error: examError }, marks] = await Promise.all([
    supabaseAdmin
      .from("exams")
      .select("id, name, exam_date, is_published, class_id, classes(name, section)")
      .eq("id", examId)
      .eq("school_id", schoolId)
      .single(),
    listMarksForExam(schoolId, examId),
  ]);
  if (examError || !exam) throw ApiError.notFound("Exam not found");

  const rows = (marks ?? []) as unknown as Array<{
    student_id: string;
    subject_id: string;
    marks_obtained: number;
    max_marks: number;
    grade: string | null;
    students: { admission_no: string; users: { full_name: string } | null } | null;
    subjects: { name: string; code: string } | null;
  }>;

  const byStudent = new Map<
    string,
    {
      studentId: string;
      studentName: string;
      admissionNo: string;
      subjects: { subjectName: string; subjectCode: string; marksObtained: number; maxMarks: number; grade: string }[];
      obtained: number;
      max: number;
    }
  >();

  for (const row of rows) {
    if (!byStudent.has(row.student_id)) {
      byStudent.set(row.student_id, {
        studentId: row.student_id,
        studentName: row.students?.users?.full_name ?? "Student",
        admissionNo: row.students?.admission_no ?? "",
        subjects: [],
        obtained: 0,
        max: 0,
      });
    }
    const entry = byStudent.get(row.student_id)!;
    entry.subjects.push({
      subjectName: row.subjects?.name ?? "Subject",
      subjectCode: row.subjects?.code ?? "",
      marksObtained: Number(row.marks_obtained),
      maxMarks: Number(row.max_marks),
      grade: row.grade ?? calculateGrade(Number(row.marks_obtained), Number(row.max_marks)),
    });
    entry.obtained += Number(row.marks_obtained);
    entry.max += Number(row.max_marks);
  }

  const students = Array.from(byStudent.values())
    .map((s) => ({
      ...s,
      percentage: s.max > 0 ? Math.round((s.obtained / s.max) * 1000) / 10 : null,
      grade: s.max > 0 ? calculateGrade(s.obtained, s.max) : "N/A",
    }))
    .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));

  const withPercentage = students.filter((s) => s.percentage !== null);
  const passCount = withPercentage.filter((s) => (s.percentage ?? 0) >= PASS_PERCENTAGE).length;
  const percentages = withPercentage.map((s) => s.percentage as number);

  return {
    exam,
    students,
    stats: {
      totalStudents: students.length,
      averagePercentage: percentages.length > 0 ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10 : null,
      highestPercentage: percentages.length > 0 ? Math.max(...percentages) : null,
      lowestPercentage: percentages.length > 0 ? Math.min(...percentages) : null,
      passCount,
      failCount: withPercentage.length - passCount,
      passPercentage: withPercentage.length > 0 ? Math.round((passCount / withPercentage.length) * 1000) / 10 : null,
    },
  };
}

export async function upsertMarks(
  schoolId: string,
  examId: string,
  records: {
    student_id: string;
    subject_id: string;
    marks_obtained: number;
    max_marks?: number;
    grade?: string;
    remarks?: string;
  }[],
  recordedBy?: string
) {
  await assertExamInSchool(schoolId, examId);

  const now = new Date().toISOString();
  const rows = records.map((r) => ({
    school_id: schoolId,
    exam_id: examId,
    student_id: r.student_id,
    subject_id: r.subject_id,
    marks_obtained: r.marks_obtained,
    max_marks: r.max_marks ?? 100,
    grade: resolveGrade(r.grade, r.marks_obtained, r.max_marks ?? 100),
    remarks: r.remarks,
    updated_at: now,
  }));

  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .upsert(rows, { onConflict: "exam_id,student_id,subject_id" })
    .select();
  if (error) throw ApiError.internal(error.message);

  const studentIds = Array.from(new Set(records.map((r) => r.student_id)));
  if (studentIds.length > 0) {
    notifyMarksPublished(schoolId, examId, studentIds, recordedBy).catch((err) =>
      logger.error({ err }, "Failed to send marks notifications")
    );
  }

  const subjectIds = Array.from(new Set(records.map((r) => r.subject_id)));
  if (recordedBy && subjectIds.length > 0) {
    notifyClassTeacherOfMarksUpload(schoolId, examId, subjectIds, recordedBy).catch((err) =>
      logger.error({ err }, "Failed to notify class teacher of marks upload")
    );
  }

  return data;
}

/** Tells the exam's class's homeroom teacher that a subject teacher just uploaded marks — a no-op if the class has no class teacher, or the recorder *is* the class teacher. */
async function notifyClassTeacherOfMarksUpload(schoolId: string, examId: string, subjectIds: string[], recordedBy: string) {
  const { data: exam } = await supabaseAdmin
    .from("exams")
    .select("class_id, classes(name, section, class_teacher_id)")
    .eq("id", examId)
    .maybeSingle();
  const classInfo = exam?.classes as unknown as { name: string; section: string; class_teacher_id: string | null } | null;
  if (!classInfo?.class_teacher_id || classInfo.class_teacher_id === recordedBy) return;

  const [{ data: recorder }, { data: subjects }] = await Promise.all([
    supabaseAdmin.from("users").select("full_name").eq("id", recordedBy).maybeSingle(),
    supabaseAdmin.from("subjects").select("name").in("id", subjectIds),
  ]);

  const teacherName = recorder?.full_name ?? "A subject teacher";
  const subjectNames = (subjects ?? []).map((s) => s.name).join(", ") || "a subject";
  const className = `${classInfo.name} - ${classInfo.section}`;

  await notificationService.notifyUsers(schoolId, recordedBy, [classInfo.class_teacher_id], {
    title: "Marks uploaded",
    message: `${teacherName} has uploaded marks for ${subjectNames} — ${className}.`,
    type: "marks",
    metadata: { exam_id: examId },
  });
}

/** In-app notification (which itself dispatches email — see notification.service.ts's dispatchEmail) plus a browser push, so publishing reaches students through all three channels. */
async function notifyMarksPublished(schoolId: string, examId: string, studentIds: string[], recordedBy?: string) {
  const { data: examRow } = await supabaseAdmin.from("exams").select("name").eq("id", examId).maybeSingle();
  const examName = examRow?.name ?? "an exam";

  await notificationService.notifyStudents(schoolId, recordedBy ?? null, studentIds, {
    title: "New marks published",
    message: `Marks for "${examName}" have been published.`,
    type: "marks",
    metadata: { exam_id: examId },
  });

  pushService
    .sendToUserIds(studentIds, {
      title: "New marks published",
      body: `Marks for "${examName}" have been published.`,
      url: "/dashboard/student",
    })
    .catch((err) => logger.error({ err }, "Failed to send marks-published push notifications"));
}

// ---------------------------------------------------------------------------
// Class Teacher "Marks Overview" — per-subject completion status for one exam.
// ---------------------------------------------------------------------------

/** Every subject assigned to the class (with its teacher), each annotated with whether marks for `examId` are complete across the whole roster, and when they were last touched. */
export async function getClassSubjectMarksStatus(schoolId: string, classId: string, examId: string) {
  await assertExamInSchool(schoolId, examId);

  const [{ data: classSubjects, error: classSubjectsError }, { count: rosterCount, error: rosterError }] =
    await Promise.all([
      supabaseAdmin
        .from("class_subjects")
        .select("subject_id, teacher_id, subjects(name, code), users(full_name), classes!inner(school_id)")
        .eq("class_id", classId)
        .eq("classes.school_id", schoolId),
      supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("class_id", classId),
    ]);
  if (classSubjectsError) throw ApiError.internal(classSubjectsError.message);
  if (rosterError) throw ApiError.internal(rosterError.message);

  const subjectIds = (classSubjects ?? []).map((row) => row.subject_id as string);
  const { data: marksRows, error: marksError } =
    subjectIds.length > 0
      ? await supabaseAdmin
          .from("exam_marks")
          .select("subject_id, student_id, updated_at")
          .eq("school_id", schoolId)
          .eq("exam_id", examId)
          .in("subject_id", subjectIds)
      : { data: [], error: null };
  if (marksError) throw ApiError.internal(marksError.message);

  const bySubject = new Map<string, { studentIds: Set<string>; lastUpdated: string | null }>();
  for (const row of marksRows ?? []) {
    const entry = bySubject.get(row.subject_id as string) ?? { studentIds: new Set<string>(), lastUpdated: null };
    entry.studentIds.add(row.student_id as string);
    if (!entry.lastUpdated || row.updated_at > entry.lastUpdated) entry.lastUpdated = row.updated_at as string;
    bySubject.set(row.subject_id as string, entry);
  }

  const roster = rosterCount ?? 0;

  return (classSubjects ?? []).map((row) => {
    const subject = row.subjects as unknown as { name: string; code: string } | null;
    const teacher = row.users as unknown as { full_name: string } | null;
    const progress = bySubject.get(row.subject_id as string);
    const markedCount = progress?.studentIds.size ?? 0;
    return {
      subjectId: row.subject_id as string,
      subjectName: subject?.name ?? "Subject",
      subjectCode: subject?.code ?? "",
      teacherId: row.teacher_id as string | null,
      teacherName: teacher?.full_name ?? "Unassigned",
      status: roster > 0 && markedCount >= roster ? "completed" : "pending",
      markedCount,
      rosterCount: roster,
      lastUpdated: progress?.lastUpdated ?? null,
    };
  });
}

/** Class Teacher nudges a subject teacher who hasn't finished uploading marks for this exam. */
export async function sendMarksReminder(
  schoolId: string,
  senderId: string,
  classId: string,
  subjectId: string,
  examId: string
) {
  const [{ data: assignment, error: assignmentError }, { data: klass, error: classError }, { data: subject, error: subjectError }] =
    await Promise.all([
      supabaseAdmin.from("class_subjects").select("teacher_id").eq("class_id", classId).eq("subject_id", subjectId).maybeSingle(),
      supabaseAdmin.from("classes").select("name, section").eq("id", classId).eq("school_id", schoolId).maybeSingle(),
      supabaseAdmin.from("subjects").select("name").eq("id", subjectId).maybeSingle(),
    ]);
  if (assignmentError) throw ApiError.internal(assignmentError.message);
  if (classError) throw ApiError.internal(classError.message);
  if (subjectError) throw ApiError.internal(subjectError.message);
  if (!assignment?.teacher_id) throw ApiError.notFound("No teacher is assigned to this subject for this class");

  const className = klass ? `${klass.name} - ${klass.section}` : "your class";
  const subjectName = subject?.name ?? "the";

  return notificationService.notifyUsers(schoolId, senderId, [assignment.teacher_id], {
    title: "Marks upload reminder",
    message: `Please upload the ${subjectName} marks for ${className}.`,
    type: "marks",
    metadata: { exam_id: examId, subject_id: subjectId },
  });
}

// ---------------------------------------------------------------------------
// Question papers — Class Teacher's class-wide view + student access once published.
// ---------------------------------------------------------------------------

const QUESTION_PAPER_SELECT =
  "id, doc_type, file_name, storage_path, content, notes, is_published, published_at, uploaded_at, uploaded_by, " +
  "exams!inner(id, name, exam_date, subject_id, class_id, subjects(name, code))";

/** Every question paper uploaded for any exam belonging to this class, published or not — the Class Teacher's coordinator view (she decides whether/when to publish each one). */
export async function listQuestionPapersForClass(schoolId: string, classId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_documents")
    .select(QUESTION_PAPER_SELECT)
    .eq("school_id", schoolId)
    .eq("doc_type", "question_paper")
    .eq("exams.class_id", classId)
    .order("uploaded_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  return Promise.all((data ?? []).map((doc) => withSignedUrl(doc as unknown as { storage_path: string | null })));
}

/**
 * Question papers visible to one student — gated on the document's own
 * `is_published` flag (set explicitly by the Class Teacher/staff), NOT on
 * `exams.is_published` which means something unrelated ("marks released").
 */
export async function listPublishedQuestionPapersForStudent(schoolId: string, studentId: string) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw ApiError.internal(studentError.message);
  if (!student?.class_id) return [];

  const { data, error } = await supabaseAdmin
    .from("exam_documents")
    .select(QUESTION_PAPER_SELECT)
    .eq("school_id", schoolId)
    .eq("doc_type", "question_paper")
    .eq("exams.class_id", student.class_id)
    .eq("is_published", true)
    .order("uploaded_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);

  return Promise.all((data ?? []).map((doc) => withSignedUrl(doc as unknown as { storage_path: string | null })));
}

export async function listMarksForExam(schoolId: string, examId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .select(
      "id, student_id, subject_id, marks_obtained, max_marks, grade, remarks, students(admission_no, users(full_name)), subjects(name, code)"
    )
    .eq("school_id", schoolId)
    .eq("exam_id", examId);
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function listMarksForStudent(schoolId: string, studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .select(
      "id, marks_obtained, max_marks, grade, remarks, exam_id, exams(name, exam_date), subject_id, subjects(name, code)"
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("exam_id", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

interface ExamRow {
  exam_id: string;
  exams: { name: string; exam_date: string | null } | null;
  subject_id: string;
  subjects: { name: string; code: string } | null;
  marks_obtained: number;
  max_marks: number;
  grade: string | null;
}

/** Groups a student's marks by exam and computes each exam's overall percentage, most recent first. */
export async function getMarksSummaryForStudent(schoolId: string, studentId: string) {
  const rows = (await listMarksForStudent(schoolId, studentId)) as unknown as ExamRow[];

  const byExam = new Map<
    string,
    { examId: string; examName: string; examDate: string | null; subjects: ExamRow[]; obtained: number; max: number }
  >();

  for (const row of rows) {
    const key = row.exam_id;
    if (!byExam.has(key)) {
      byExam.set(key, {
        examId: row.exam_id,
        examName: row.exams?.name ?? "Exam",
        examDate: row.exams?.exam_date ?? null,
        subjects: [],
        obtained: 0,
        max: 0,
      });
    }
    const entry = byExam.get(key)!;
    entry.subjects.push(row);
    entry.obtained += Number(row.marks_obtained);
    entry.max += Number(row.max_marks);
  }

  const exams = Array.from(byExam.values())
    .map((e) => ({
      examId: e.examId,
      examName: e.examName,
      examDate: e.examDate,
      percentage: e.max > 0 ? Math.round((e.obtained / e.max) * 1000) / 10 : null,
      subjects: e.subjects.map((s) => ({
        subjectId: s.subject_id,
        subjectName: s.subjects?.name ?? "Subject",
        subjectCode: s.subjects?.code ?? "",
        marksObtained: Number(s.marks_obtained),
        maxMarks: Number(s.max_marks),
        grade: s.grade ?? calculateGrade(Number(s.marks_obtained), Number(s.max_marks)),
      })),
    }))
    .sort((a, b) => (b.examDate ?? "").localeCompare(a.examDate ?? ""));

  const latestExam = exams[0] ?? null;

  return { latestExam, exams };
}

export async function getPerformanceAnalytics(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("exam_marks")
    .select(
      "exam_id, student_id, marks_obtained, max_marks, exams(id, name, class_id, exam_date, classes(name, section)), subjects(name, code)"
    )
    .eq("school_id", schoolId);
  if (error) throw ApiError.internal(error.message);

  const rows = (data ?? []) as unknown as Array<{
    exam_id: string;
    student_id: string;
    marks_obtained: number;
    max_marks: number;
    exams: { id: string; name: string; class_id: string; exam_date: string | null; classes: { name: string; section: string } | null } | null;
    subjects: { name: string; code: string } | null;
  }>;

  const byClass = new Map<
    string,
    {
      classId: string;
      className: string;
      examIds: Set<string>;
      studentIds: Set<string>;
      totalObtained: number;
      totalMax: number;
    }
  >();

  const examIds = new Set<string>();
  const studentIds = new Set<string>();
  let totalObtained = 0;
  let totalMax = 0;

  for (const row of rows) {
    const exam = row.exams;
    const classId = exam?.class_id ?? "";
    if (!classId) continue;

    const className = [exam?.classes?.name, exam?.classes?.section].filter(Boolean).join(" ") || "Unassigned";
    if (!byClass.has(classId)) {
      byClass.set(classId, {
        classId,
        className,
        examIds: new Set<string>(),
        studentIds: new Set<string>(),
        totalObtained: 0,
        totalMax: 0,
      });
    }

    const entry = byClass.get(classId)!;
    entry.examIds.add(row.exam_id);
    entry.studentIds.add(row.student_id);
    entry.totalObtained += Number(row.marks_obtained);
    entry.totalMax += Number(row.max_marks);

    examIds.add(row.exam_id);
    studentIds.add(row.student_id);
    totalObtained += Number(row.marks_obtained);
    totalMax += Number(row.max_marks);
  }

  const byClassSummary = Array.from(byClass.values())
    .map((entry) => ({
      classId: entry.classId,
      className: entry.className,
      examCount: entry.examIds.size,
      studentCount: entry.studentIds.size,
      averagePercentage: entry.totalMax > 0 ? Math.round((entry.totalObtained / entry.totalMax) * 1000) / 10 : null,
    }))
    .sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1));

  return {
    totalExams: examIds.size,
    totalStudents: studentIds.size,
    averagePercentage: totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : null,
    byClass: byClassSummary,
  };
}

export async function generateReportCard(schoolId: string, studentId: string) {
  const [{ data: studentResultData, error: studentError }, attendance, marks] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("id, admission_no, users(full_name), classes(name, section)")
      .eq("school_id", schoolId)
      .eq("id", studentId)
      .single(),
    (async () => {
      const { getSummaryForStudent } = await import("./attendance.service");
      return getSummaryForStudent(schoolId, studentId);
    })(),
    getMarksSummaryForStudent(schoolId, studentId),
  ]);

  const studentResult = studentResultData;

  if (studentError || !studentResult) throw ApiError.notFound("Student not found");

  return { generated_at: new Date().toISOString(), student: studentResult, attendance, marks };
}
