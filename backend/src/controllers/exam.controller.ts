import { Request, Response, NextFunction } from "express";
import * as examService from "../services/exam.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { assertTeacherOwnsClass, assertTeacherOwnsClassSubject, assertTeacherOwnsExam } from "../utils/teacherAccess";

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
    await assertTeacherOwnsClass(req, req.body.class_id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.createExam(schoolId, req.body), 201);
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
    return sendSuccess(res, await examService.upsertMarks(schoolId, req.params.id, req.body.records), 201);
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
