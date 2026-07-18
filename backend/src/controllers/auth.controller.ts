import { Request, Response, NextFunction } from "express";
import {
  loginWithPassword,
  refreshSession,
  sendPasswordResetEmail,
  resetPassword,
} from "../services/auth.service";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await loginWithPassword(email, password);
    return sendSuccess(res, result);
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
