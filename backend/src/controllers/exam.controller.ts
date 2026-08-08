import { Request, Response, NextFunction } from "express";
import * as examService from "../services/exam.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { ApiError } from "../utils/ApiError";
import { assertStudentAccess } from "../utils/studentAccess";
import {
  assertTeacherOwnsClass,
  assertTeacherOwnsClassSubject,
  assertTeacherOwnsExam,
  assertIsClassTeacher,
  isClassTeacherOf,
  isStaff,
} from "../utils/teacherAccess";
import { supabaseAdmin } from "../config/supabase";

export async function listExams(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.query as { classId?: string };
    if (classId) await assertTeacherOwnsClass(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listExams(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function createExam(req: Request, res: Response, next: NextFunction) {
  try {
    const { scope, class_id, class_ids, academic_year_id, name, exam_date } = req.body as {
      scope: "class" | "selected" | "all";
      class_id?: string;
      class_ids?: string[];
      academic_year_id?: string;
      name: string;
      exam_date?: string;
    };
    const schoolId = resolveSchoolId(req);

    if (scope === "all") {
      if (!isStaff(req.user!.roles)) throw ApiError.forbidden("Only school staff can create an all-classes exam");
      return sendSuccess(res, await examService.createExamForAllClasses(schoolId, { academic_year_id, name, exam_date }), 201);
    }

    if (scope === "selected") {
      if (!isStaff(req.user!.roles)) throw ApiError.forbidden("Only school staff can create a multi-class exam");
      return sendSuccess(
        res,
        await examService.createExamForSelectedClasses(schoolId, { class_ids: class_ids!, academic_year_id, name, exam_date }),
        201
      );
    }

    await assertTeacherOwnsClass(req, class_id!);
    return sendSuccess(res, await examService.createExam(schoolId, { class_id: class_id!, academic_year_id, name, exam_date }), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateExam(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    if (req.body.class_id) await assertTeacherOwnsClass(req, req.body.class_id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.updateExam(schoolId, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteExam(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    await examService.deleteExam(schoolId, req.params.id);
    return sendSuccess(res, { message: "Exam deleted" });
  } catch (err) {
    return next(err);
  }
}

export async function publishExam(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await examService.publishExam(schoolId, req.params.id, req.user!.id, req.body.is_published)
    );
  } catch (err) {
    return next(err);
  }
}

export async function listSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listSchedule(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createScheduleEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const classId = await assertTeacherOwnsExam(req, req.params.id);
    await assertTeacherOwnsClassSubject(req, classId, req.body.subject_id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.createScheduleEntry(schoolId, req.params.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateScheduleEntry(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await examService.updateScheduleEntry(schoolId, req.params.id, req.params.scheduleId, req.body)
    );
  } catch (err) {
    return next(err);
  }
}

export async function deleteScheduleEntry(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    await examService.deleteScheduleEntry(schoolId, req.params.id, req.params.scheduleId);
    return sendSuccess(res, { message: "Schedule entry deleted" });
  } catch (err) {
    return next(err);
  }
}

/**
 * A question paper is sensitive material — the Class Teacher and staff see
 * every document on the exam, but a plain subject teacher (who might merely
 * share a class with the exam's actual owner, per assertTeacherOwnsExam) only
 * ever sees documents they personally uploaded/wrote.
 */
export async function listExamDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const classId = await assertTeacherOwnsExam(req, req.params.id);
    const user = req.user!;
    const canSeeAll = isStaff(user.roles) || (await isClassTeacherOf(classId, user.id));
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await examService.listExamDocuments(schoolId, req.params.id, canSeeAll ? {} : { onlyUploadedBy: user.id })
    );
  } catch (err) {
    return next(err);
  }
}

/** For a subject-scoped teacher-created assessment (exams.subject_id set), also requires the caller teach that specific subject in the class — closes the gap where any subject teacher in the class could otherwise touch another subject's documents. Staff/class-level-only exams (subject_id null) are unaffected. */
async function assertOwnsExamSubjectIfSet(req: Request, classId: string): Promise<void> {
  const { data: exam, error } = await supabaseAdmin
    .from("exams")
    .select("subject_id")
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (exam?.subject_id) {
    await assertTeacherOwnsClassSubject(req, classId, exam.subject_id);
  }
}

export async function addExamDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const classId = await assertTeacherOwnsExam(req, req.params.id);
    await assertOwnsExamSubjectIfSet(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await examService.addExamDocument(schoolId, req.params.id, req.user!.id, req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function deleteExamDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const classId = await assertTeacherOwnsExam(req, req.params.id);
    await assertOwnsExamSubjectIfSet(req, classId);
    const schoolId = resolveSchoolId(req);
    await examService.deleteExamDocument(schoolId, req.params.id, req.params.docId);
    return sendSuccess(res, { message: "Document deleted" });
  } catch (err) {
    return next(err);
  }
}

/** Publishing a question paper to students is the Class Teacher's (or staff's) call — not the subject teacher who wrote it. */
export async function publishExamDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const classId = await assertTeacherOwnsExam(req, req.params.id);
    await assertIsClassTeacher(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await examService.publishExamDocument(schoolId, req.params.id, req.params.docId, req.user!.id, req.body.is_published)
    );
  } catch (err) {
    return next(err);
  }
}

export async function getClassSubjectMarksStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.query as { classId: string };
    await assertIsClassTeacher(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.getClassSubjectMarksStatus(schoolId, classId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function sendMarksReminder(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.body as { classId: string };
    await assertIsClassTeacher(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await examService.sendMarksReminder(schoolId, req.user!.id, classId, req.params.subjectId, req.params.id)
    );
  } catch (err) {
    return next(err);
  }
}

export async function listQuestionPapersForClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.params as { classId: string };
    await assertIsClassTeacher(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listQuestionPapersForClass(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function getExamReport(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.getExamReport(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function upsertMarks(req: Request, res: Response, next: NextFunction) {
  try {
    const classId = await assertTeacherOwnsExam(req, req.params.id);
    const records = req.body.records as { subject_id: string }[];
    const subjectIds = Array.from(new Set(records.map((r) => r.subject_id)));
    for (const subjectId of subjectIds) {
      await assertTeacherOwnsClassSubject(req, classId, subjectId);
    }
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.upsertMarks(schoolId, req.params.id, req.body.records, req.user!.id), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listMarksForExam(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsExam(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listMarksForExam(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function listQuestionPapersForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listPublishedQuestionPapersForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function listMarksForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listMarksForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function getMarksSummaryForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.getMarksSummaryForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function listUpcomingForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.getUpcomingExamsForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function listExamsForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listExamsForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function getExamScheduleForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.getExamScheduleForStudent(schoolId, req.params.id, req.params.examId));
  } catch (err) {
    return next(err);
  }
}

/** Same generator parentPortal.service.ts::getReportCard wraps for the parent-only route — exposed directly here so the student themself can also reach it (assertStudentAccess covers both). */
export async function getReportCardForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.generateReportCard(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function getPerformanceAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.getPerformanceAnalytics(schoolId));
  } catch (err) {
    return next(err);
  }
}
