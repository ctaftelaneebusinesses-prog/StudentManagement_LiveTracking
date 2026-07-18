import { Request, Response, NextFunction } from "express";
import * as timetableService from "../services/timetable.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function listForClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { classId } = req.query as { classId: string };
    return sendSuccess(res, await timetableService.listForClass(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function upsertPeriod(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await timetableService.upsertPeriod(schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function deletePeriod(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await timetableService.deletePeriod(schoolId, req.params.id);
    return sendSuccess(res, { message: "Period deleted" });
  } catch (err) {
    return next(err);
  }
}

export async function getWeeklyForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await timetableService.getWeeklyForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}
