import { Request, Response, NextFunction } from "express";
import * as teacherAttendanceService from "../services/teacherAttendance.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function getDaily(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { date } = req.query as { date: string };
    return sendSuccess(res, await teacherAttendanceService.getDailyAttendance(schoolId, date));
  } catch (err) {
    return next(err);
  }
}

export async function mark(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherAttendanceService.markAttendance(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listForTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { from, to } = req.query as { from?: string; to?: string };
    return sendSuccess(res, await teacherAttendanceService.listForTeacher(schoolId, req.params.id, from, to));
  } catch (err) {
    return next(err);
  }
}

export async function getSummaryForTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherAttendanceService.getSummaryForTeacher(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function getMonthlySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { month } = req.query as { month: string };
    return sendSuccess(res, await teacherAttendanceService.getMonthlySummary(schoolId, month));
  } catch (err) {
    return next(err);
  }
}
