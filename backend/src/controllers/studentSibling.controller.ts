import { Request, Response, NextFunction } from "express";
import * as studentSiblingService from "../services/studentSibling.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function listSiblings(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentSiblingService.listSiblings(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function searchSiblingCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search } = req.query as { search?: string };
    return sendSuccess(res, await studentSiblingService.searchSiblingCandidates(schoolId, req.params.id, search));
  } catch (err) {
    return next(err);
  }
}

export async function linkSibling(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await studentSiblingService.linkSibling(schoolId, req.params.id, req.body.sibling_student_id),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function unlinkSibling(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentSiblingService.unlinkSibling(schoolId, req.params.id, req.params.siblingId));
  } catch (err) {
    return next(err);
  }
}
