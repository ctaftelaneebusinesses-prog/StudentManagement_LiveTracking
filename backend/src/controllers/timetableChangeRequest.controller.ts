import { Request, Response, NextFunction } from "express";
import * as timetableChangeRequestService from "../services/timetableChangeRequest.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertTeacherOwnsClass } from "../utils/teacherAccess";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsClass(req, req.body.class_id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await timetableChangeRequestService.create(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listOpen(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await timetableChangeRequestService.listOpenForSchool(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await timetableChangeRequestService.listMine(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await timetableChangeRequestService.review(schoolId, req.params.id, req.user!.id, req.body.status)
    );
  } catch (err) {
    return next(err);
  }
}
