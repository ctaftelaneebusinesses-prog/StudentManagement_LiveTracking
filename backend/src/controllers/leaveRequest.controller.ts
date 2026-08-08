import { Request, Response, NextFunction } from "express";
import * as leaveRequestService from "../services/leaveRequest.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { ApiError } from "../utils/ApiError";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { teacherId, status, applicantRole, page, pageSize } = req.query as unknown as {
      teacherId?: string;
      status?: "pending" | "approved" | "rejected";
      applicantRole?: "teacher" | "principal";
      page: number;
      pageSize: number;
    };
    return sendSuccess(
      res,
      await leaveRequestService.listLeaveRequests(schoolId, {
        teacherId,
        status,
        applicantRole,
        page,
        pageSize,
        viewerRole: req.user!.roleName,
      })
    );
  } catch (err) {
    return next(err);
  }
}

export async function listForTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await leaveRequestService.listForTeacher(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await leaveRequestService.createLeaveRequest(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await leaveRequestService.reviewLeaveRequest(schoolId, req.params.id, req.user!.id, req.user!.roleName, req.body.status)
    );
  } catch (err) {
    return next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await leaveRequestService.deleteLeaveRequest(schoolId, req.params.id);
    return sendSuccess(res, { message: "Leave request deleted" });
  } catch (err) {
    return next(err);
  }
}

/** Self-service (teacher or principal applying on their own behalf) — mounted at /leave-requests/me. */
function selfApplicantRole(roleName: string): "teacher" | "principal" {
  if (roleName === "teacher" || roleName === "principal") return roleName;
  throw ApiError.forbidden("Only a teacher or principal can apply for this kind of leave");
}

export async function getMySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await leaveRequestService.getLeaveSummary(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await leaveRequestService.listForTeacher(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function applyMine(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const role = selfApplicantRole(req.user!.roleName);
    return sendSuccess(res, await leaveRequestService.applyForLeave(schoolId, req.user!.id, role, req.body), 201);
  } catch (err) {
    return next(err);
  }
}
