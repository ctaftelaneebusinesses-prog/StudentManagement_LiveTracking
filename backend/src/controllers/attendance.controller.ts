import { Request, Response, NextFunction } from "express";
import * as attendanceService from "../services/attendance.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { assertTeacherOwnsClass } from "../utils/teacherAccess";

export async function upsertAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsClass(req, req.body.class_id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await attendanceService.upsertAttendance(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function bulkUpsertAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsClass(req, req.body.class_id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await attendanceService.bulkUpsertAttendance(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listForClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId, date } = req.query as { classId: string; date: string };
    await assertTeacherOwnsClass(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await attendanceService.listForClass(schoolId, classId, date));
  } catch (err) {
    return next(err);
  }
}

export async function listHistoryForClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId, from, to } = req.query as { classId: string; from?: string; to?: string };
    await assertTeacherOwnsClass(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await attendanceService.listHistoryForClass(schoolId, classId, from, to));
  } catch (err) {
    return next(err);
  }
}

export async function listForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    return sendSuccess(res, await attendanceService.listForStudent(schoolId, req.params.id, from, to));
  } catch (err) {
    return next(err);
  }
}

export async function getSummaryForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    return sendSuccess(res, await attendanceService.getSummaryForStudent(schoolId, req.params.id, from, to));
  } catch (err) {
    return next(err);
  }
}
