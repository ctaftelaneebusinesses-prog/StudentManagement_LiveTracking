import { Request, Response, NextFunction } from "express";
import * as activityService from "../services/activity.service";
import { listActivityAssignments } from "../services/extracurricularStaff.service";
import { logActivity } from "../services/auditLog.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search, is_active, page, pageSize } = req.query as unknown as {
      search?: string;
      is_active?: boolean;
      page: number;
      pageSize: number;
    };
    return sendSuccess(res, await activityService.listActivities(schoolId, { search, is_active, page, pageSize }));
  } catch (err) {
    return next(err);
  }
}

export async function listAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await listActivityAssignments(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const activity = await activityService.createActivity(schoolId, req.user!.id, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "activity.created", {
      targetType: "activity",
      targetId: activity.id,
      metadata: { name: activity.name },
    });
    return sendSuccess(res, activity, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const activity = await activityService.updateActivity(schoolId, req.params.id, req.user!.id, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "activity.updated", {
      targetType: "activity",
      targetId: req.params.id,
    });
    return sendSuccess(res, activity);
  } catch (err) {
    return next(err);
  }
}

export async function deactivateActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const activity = await activityService.deactivateActivity(schoolId, req.params.id, req.user!.id);
    void logActivity(schoolId, req.user?.id ?? null, "activity.deactivated", {
      targetType: "activity",
      targetId: req.params.id,
    });
    return sendSuccess(res, activity);
  } catch (err) {
    return next(err);
  }
}
