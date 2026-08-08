import { Request, Response, NextFunction } from "express";
import * as studentActivityService from "../services/studentActivity.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function getActivityTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentActivityService.getActivityTimeline(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}
