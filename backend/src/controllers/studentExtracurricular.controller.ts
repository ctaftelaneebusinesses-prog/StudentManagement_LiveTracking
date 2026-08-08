import { Request, Response, NextFunction } from "express";
import * as studentExtracurricularService from "../services/studentExtracurricular.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentExtracurricularService.getOverview(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}
