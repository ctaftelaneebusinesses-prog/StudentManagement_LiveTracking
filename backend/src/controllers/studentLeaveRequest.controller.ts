import { Request, Response, NextFunction } from "express";
import * as studentLeaveRequestService from "../services/studentLeaveRequest.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { ApiError } from "../utils/ApiError";

/** POST /students/:id/leave-requests — the student applying on their own behalf. Parents keep using the existing /parent-portal/leave-requests flow. */
export async function applyForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.id !== req.params.id) {
      throw ApiError.forbidden("Only the student themself can apply for leave here");
    }
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentLeaveRequestService.applyForLeave(schoolId, req.params.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

/** GET /students/:id/leave-requests — full history, reachable by the student, their parents, staff, and their class/subject teacher (assertStudentAccess). */
export async function listForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentLeaveRequestService.listForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

/** GET /student-leave-requests — the calling teacher's own class-teacher review queue. */
export async function listForClassTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { status } = req.query as { status?: "pending" | "approved" | "rejected" | "cancelled" };
    return sendSuccess(res, await studentLeaveRequestService.listForClassTeacher(schoolId, req.user!.id, { status }));
  } catch (err) {
    return next(err);
  }
}

/** PATCH /student-leave-requests/:id — approve/reject, class-teacher-only (enforced inside the service). */
export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentLeaveRequestService.review(schoolId, req.params.id, req.user!.id, req.body.status));
  } catch (err) {
    return next(err);
  }
}
