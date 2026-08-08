import { Request, Response, NextFunction } from "express";
import {
  loginWithPassword,
  refreshSession,
  sendPasswordResetEmail,
  resetPassword,
  changePassword,
} from "../services/auth.service";
import { logLoginAttempt, logActivity } from "../services/auditLog.service";
import { getApprovalStatus } from "../services/registration.service";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export async function login(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body;
  const meta = { ip: req.ip, userAgent: req.headers["user-agent"] };
  try {
    const result = await loginWithPassword(email, password);
    void logLoginAttempt(email, true, { ...meta, userId: result.user.id, schoolId: result.user.school_id });
    return sendSuccess(res, result);
  } catch (err) {
    void logLoginAttempt(email, false, meta);
    return next(err);
  }
}

/**
 * The login form authenticates directly against Supabase Auth from the
 * browser (see frontend/src/services/auth.service.ts), never through
 * login() above — this endpoint lets it still report the outcome so Login
 * History reflects real attempts. Public/unauthenticated by design (a failed
 * login has no token to send), rate-limited the same as /login.
 */
export async function recordLoginAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, success } = req.body;
    void logLoginAttempt(email, success, { ip: req.ip, userAgent: req.headers["user-agent"] });
    return sendSuccess(res, { message: "Recorded" });
  } catch (err) {
    return next(err);
  }
}

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const { currentPassword, newPassword } = req.body;
    await changePassword(req.user.id, req.user.email, currentPassword, newPassword);
    if (req.user.schoolId) {
      void logActivity(req.user.schoolId, req.user.id, "user.password_changed", { targetType: "user", targetId: req.user.id });
    }
    return sendSuccess(res, { message: "Password updated successfully." });
  } catch (err) {
    return next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const result = await refreshSession(refreshToken);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.status !== "approved") {
      const approval = await getApprovalStatus(req.user.id);
      return sendSuccess(res, { ...req.user, approval });
    }
    return sendSuccess(res, req.user);
  } catch (err) {
    return next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, redirectTo } = req.body;
    await sendPasswordResetEmail(email, redirectTo);
    // Always a generic success message — never reveal whether the email exists.
    return sendSuccess(res, { message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    return next(err);
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { accessToken, newPassword } = req.body;
    await resetPassword(accessToken, newPassword);
    return sendSuccess(res, { message: "Password updated successfully." });
  } catch (err) {
    return next(err);
  }
}
