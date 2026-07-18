import { Request, Response, NextFunction } from "express";
import * as studentDashboardService from "../services/studentDashboard.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await studentDashboardService.getDashboard(schoolId, req.params.id, req.user!.id)
    );
  } catch (err) {
    return next(err);
  }
}
