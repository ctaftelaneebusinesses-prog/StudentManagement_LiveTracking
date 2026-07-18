import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";

/** Catches unmatched routes and forwards a consistent 404 into the error handler. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
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
      message: "Validation failed",
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
