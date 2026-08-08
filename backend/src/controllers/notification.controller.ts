import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notification.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

/** "My notifications" — works for any authenticated role, RLS-scoped via req.supabase. */
export async function listForMe(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await notificationService.listForUser(req.supabase!, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

/** Marks one notification read for the caller, regardless of role. */
export async function markReadForMe(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markReadForUser(req.supabase!, req.params.notificationId, req.user!.id);
    return sendSuccess(res, { message: "Marked as read" });
  } catch (err) {
    return next(err);
  }
}

/** "Clear all" — marks every notification visible to the caller as read in one call. */
export async function markAllReadForMe(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markAllReadForUser(req.supabase!, req.user!.id);
    return sendSuccess(res, { message: "All notifications marked as read" });
  } catch (err) {
    return next(err);
  }
}

/** School-wide, critical-priority broadcast — gated to admin/principal roles at the route level. */
export async function createEmergencyAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await notificationService.createEmergencyAlert(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function createNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await notificationService.createNotification(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listForSchool(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await notificationService.listForSchool(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function listForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await notificationService.listForStudent(schoolId, req.params.id, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    await notificationService.markRead(req.params.notificationId, req.user!.id);
    return sendSuccess(res, { message: "Marked as read" });
  } catch (err) {
    return next(err);
  }
}
