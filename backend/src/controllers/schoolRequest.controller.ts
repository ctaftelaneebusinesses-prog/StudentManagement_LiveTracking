import { Request, Response, NextFunction } from "express";
import * as schoolRequestService from "../services/schoolRequest.service";
import * as platformAudit from "../services/platformAudit.service";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

/**
 * School-creation request queue — a school_admin's path to adding a school
 * now that only super_admin can create one directly (066_super_admin_multi_school.sql).
 * See schoolRequest.service.ts for the approve/reject mechanics.
 */

export async function createRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw ApiError.unauthorized();

    const request = await schoolRequestService.createRequest(userId, req.body);
    await platformAudit.logPlatformAction(req, {
      action: "school_request.created",
      targetType: "school",
      targetId: request.id,
      targetLabel: req.body.name,
      metadata: { requestedBy: req.user?.email },
    });
    return sendSuccess(res, request, 201);
  } catch (err) {
    return next(err);
  }
}

export async function listMyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw ApiError.unauthorized();
    return sendSuccess(res, await schoolRequestService.listMyRequests(userId));
  } catch (err) {
    return next(err);
  }
}

export async function listAllRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.query as { status?: "pending" | "approved" | "rejected" };
    return sendSuccess(res, await schoolRequestService.listAllRequests(status));
  } catch (err) {
    return next(err);
  }
}

export async function getRequest(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await schoolRequestService.getRequest(req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function approveRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewerId = req.user?.id;
    if (!reviewerId) throw ApiError.unauthorized();

    const { request, school } = await schoolRequestService.approveRequest(
      req.params.id,
      reviewerId,
      req.body.reviewer_notes
    );
    await platformAudit.logPlatformAction(req, {
      action: "school_request.approved",
      targetType: "school",
      targetId: school.id,
      targetLabel: school.name,
      schoolId: school.id,
      schoolName: school.name,
      metadata: { requestId: request.id, requestedBy: request.users?.email },
    });
    return sendSuccess(res, { request, school });
  } catch (err) {
    return next(err);
  }
}

export async function rejectRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewerId = req.user?.id;
    if (!reviewerId) throw ApiError.unauthorized();

    const request = await schoolRequestService.rejectRequest(req.params.id, reviewerId, req.body.reviewer_notes);
    await platformAudit.logPlatformAction(req, {
      action: "school_request.rejected",
      targetType: "school",
      targetId: request.id,
      targetLabel: (request.payload as { name?: string })?.name ?? null,
      metadata: { requestedBy: request.users?.email, reviewerNotes: req.body.reviewer_notes },
    });
    return sendSuccess(res, request);
  } catch (err) {
    return next(err);
  }
}
