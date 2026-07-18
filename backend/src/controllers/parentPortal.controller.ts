import { NextFunction, Request, Response } from "express";
import * as parentPortalService from "../services/parentPortal.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { ApiError } from "../utils/ApiError";

function assertParent(req: Request) {
  if (!req.user?.roles.includes("parent")) throw ApiError.forbidden("Requires parent role");
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    assertParent(req);
    return sendSuccess(res, await parentPortalService.getDashboard(resolveSchoolId(req), req.user!.id));
  } catch (error) { return next(error); }
}

export async function createLeaveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    assertParent(req);
    await assertStudentAccess(req, req.body.student_id);
    return sendSuccess(res, await parentPortalService.createLeaveRequest(resolveSchoolId(req), req.user!.id, req.body), 201);
  } catch (error) { return next(error); }
}

export async function listLeaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    assertParent(req);
    return sendSuccess(res, await parentPortalService.listLeaveRequests(resolveSchoolId(req), req.user!.id));
  } catch (error) { return next(error); }
}

export async function getReportCard(req: Request, res: Response, next: NextFunction) {
  try {
    assertParent(req);
    await assertStudentAccess(req, req.params.studentId);
    return sendSuccess(res, await parentPortalService.getReportCard(resolveSchoolId(req), req.params.studentId));
  } catch (error) { return next(error); }
}
