import { Request, Response, NextFunction } from "express";
import * as registrationService from "../services/registration.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { ApiError } from "../utils/ApiError";

/** GET /auth/register/meta?school_code=X — classes/subjects/activities for the registration form's pickers. Public, no requireAuth. */
export async function getMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const { school_code } = req.query as { school_code: string };
    return sendSuccess(res, await registrationService.getRegistrationMeta(school_code));
  } catch (err) {
    return next(err);
  }
}

export async function submitPrincipal(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await registrationService.registerPrincipal(req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function submitAccountant(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await registrationService.registerAccountant(req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function submitDriver(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await registrationService.registerDriver(req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function submitExtracurricularStaff(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await registrationService.registerExtracurricularStaff(req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function submitTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await registrationService.registerTeacher(req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function submitStudent(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await registrationService.registerStudent(req.body), 201);
  } catch (err) {
    return next(err);
  }
}

/** GET /registration-requests — queue scoped by the caller's own role (see routes for the permission gates that select which branch runs). */
export async function listQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { status } = req.query as { status?: "pending" | "approved" | "rejected" };
    const roles = req.user!.roles;

    if (roles.includes("teacher")) {
      return sendSuccess(res, await registrationService.listQueueForClassTeacher(schoolId, req.user!.id, status));
    }
    if (req.user!.permissions.includes("registration.review")) {
      return sendSuccess(res, await registrationService.listQueueForPrincipal(schoolId, status));
    }
    if (req.user!.permissions.includes("users.manage")) {
      return sendSuccess(res, await registrationService.listQueueForAdmin(schoolId, status));
    }
    throw ApiError.forbidden("You do not have a registration-approval queue");
  } catch (err) {
    return next(err);
  }
}

export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { action, notes } = req.body as { action: "approve" | "reject"; notes?: string };
    return sendSuccess(res, await registrationService.review(schoolId, req.params.id, req.user!.id, action, notes));
  } catch (err) {
    return next(err);
  }
}
