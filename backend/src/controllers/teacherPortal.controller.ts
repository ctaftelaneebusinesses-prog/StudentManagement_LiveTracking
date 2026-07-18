import { Request, Response, NextFunction } from "express";
import * as teacherPortalService from "../services/teacherPortal.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertTeacherOwnsClass } from "../utils/teacherAccess";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.getDashboard(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function listStudentsForClass(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsClass(req, req.params.classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.listStudentsForClass(schoolId, req.params.classId));
  } catch (err) {
    return next(err);
  }
}
