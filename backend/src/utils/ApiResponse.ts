import { Response } from "express";

/** Consistent success envelope so every frontend call site parses responses the same way. */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}
