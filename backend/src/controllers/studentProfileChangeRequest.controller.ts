import { Request, Response, NextFunction } from "express";
import * as studentProfileChangeRequestService from "../services/studentProfileChangeRequest.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { ApiError } from "../utils/ApiError";

/** POST /students/:id/profile-change-requests — the student themself proposing a change (assertStudentAccess covers self/staff/teacher). */
export async function submitForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const user = req.user!;
    if (user.id !== req.params.id) {
      throw ApiError.forbidden("Only the student can request a profile change");
    }
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await studentProfileChangeRequestService.submitChangeRequest(schoolId, req.params.id, user.id, "student", req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}

/** GET /students/:id/profile-change-requests — full history, reachable by the student, staff, and their class/subject teacher. */
export async function listForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentProfileChangeRequestService.listForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

/** GET /profile-change-requests — the calling teacher's own class-teacher review queue. */
export async function listForClassTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { status } = req.query as { status?: "pending" | "approved" | "rejected" | "cancelled" };
    return sendSuccess(
      res,
      await studentProfileChangeRequestService.listForClassTeacher(schoolId, req.user!.id, { status })
    );
  } catch (err) {
    return next(err);
  }
}

/** PATCH /profile-change-requests/:id — approve/reject, class-teacher-only (enforced inside the service). */
export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await studentProfileChangeRequestService.review(
        schoolId,
        req.params.id,
        req.user!.id,
        req.body.status,
        req.body.reviewer_notes
      )
    );
  } catch (err) {
    return next(err);
  }
}
