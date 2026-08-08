import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";

/** Catches unmatched routes and forwards a consistent 404 into the error handler. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Turns a ZodError's issues into a readable "field: reason" message (e.g.
 * "mother_email: Invalid email") instead of the uninformative generic
 * "Validation failed" the client used to see for every validation error
 * regardless of cause. `issue.path` is `["body"|"query"|"params", ...field]`
 * — the first segment is dropped since it's just which part of the request
 * failed, not useful to a user.
 */
function formatZodError(err: ZodError): string {
  const messages = err.issues.map((issue) => {
    const field = issue.path.slice(1).join(".");
    return field ? `${field}: ${issue.message}` : issue.message;
  });
  return messages.join("; ") || "Validation failed";
}

/**
 * Centralized error handler. Every thrown ApiError, ZodError, or unexpected
 * exception passed to next() ends up here and is turned into one consistent
 * JSON error shape — no route should format its own error responses.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: formatZodError(err),
      details: err.flatten(),
    });
  }

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, err.message);
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
