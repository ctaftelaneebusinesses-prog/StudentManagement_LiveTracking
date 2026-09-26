import { Request, Response, NextFunction } from "express";
import * as registrationService from "../services/registration.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { ApiError } from "../utils/ApiError";

/**
 * SEC-19: the public self-registration endpoints must not reveal whether an
 * email is already registered (account enumeration). This runs a submit and,
 * if provisioning fails only because the email already exists, returns the
 * SAME generic "pending" response as a fresh submission — so an attacker can't
 * distinguish existing accounts. Every other error propagates normally.
 * (Authenticated admin create paths are unaffected and still 409.)
 */
async function submitRegistrationPublicly(
  res: Response,
  next: NextFunction,
  run: () => Promise<{ user_id: string; status: "pending" }>
) {
  try {
    return sendSuccess(res, await run(), 201);
  } catch (err) {
    if ((err as { code?: string }).code === "EMAIL_EXISTS") {
      // Generic response: no user_id, indistinguishable from a real submission.
      return sendSuccess(res, { status: "pending" as const }, 201);
    }
    return next(err);
  }
}

/** GET /auth/register/meta?school_code=X — classes/subjects/activities for the registration form's pickers. Public, no requireAuth. */
export async function getMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const { school_code } = req.query as { school_code: string };
    return sendSuccess(res, await registrationService.getRegistrationMeta(school_code));
  } catch (err) {
    return next(err);
  }
}

export function submitPrincipal(req: Request, res: Response, next: NextFunction) {
  return submitRegistrationPublicly(res, next, () => registrationService.registerPrincipal(req.body));
}

export function submitAccountant(req: Request, res: Response, next: NextFunction) {
  return submitRegistrationPublicly(res, next, () => registrationService.registerAccountant(req.body));
}

export function submitDriver(req: Request, res: Response, next: NextFunction) {
  return submitRegistrationPublicly(res, next, () => registrationService.registerDriver(req.body));
}

export function submitExtracurricularStaff(req: Request, res: Response, next: NextFunction) {
  return submitRegistrationPublicly(res, next, () => registrationService.registerExtracurricularStaff(req.body));
}

export function submitTeacher(req: Request, res: Response, next: NextFunction) {
  return submitRegistrationPublicly(res, next, () => registrationService.registerTeacher(req.body));
}

export function submitStudent(req: Request, res: Response, next: NextFunction) {
  return submitRegistrationPublicly(res, next, () => registrationService.registerStudent(req.body));
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
    const reviewer = { id: req.user!.id, roles: req.user!.roles, permissions: req.user!.permissions };
    return sendSuccess(res, await registrationService.review(schoolId, req.params.id, reviewer, action, notes));
  } catch (err) {
    return next(err);
  }
}
