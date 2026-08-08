import { Request, Response, NextFunction } from "express";
import * as evaluatedPaperService from "../services/evaluatedPaper.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { assertTeacherOwnsStudent, isStaff } from "../utils/teacherAccess";

export async function listForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await evaluatedPaperService.listForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

/** Upload is gated by evaluated_papers.manage at the route level; staff may act on any student, a teacher only on students in a class they teach. */
export async function addPaper(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isStaff(req.user!.roles)) {
      await assertTeacherOwnsStudent(req, req.params.id);
    }
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await evaluatedPaperService.addPaper(schoolId, req.params.id, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function deletePaper(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isStaff(req.user!.roles)) {
      await assertTeacherOwnsStudent(req, req.params.id);
    }
    const schoolId = resolveSchoolId(req);
    await evaluatedPaperService.deletePaper(schoolId, req.params.id, req.params.paperId);
    return sendSuccess(res, { message: "Evaluated paper deleted" });
  } catch (err) {
    return next(err);
  }
}
