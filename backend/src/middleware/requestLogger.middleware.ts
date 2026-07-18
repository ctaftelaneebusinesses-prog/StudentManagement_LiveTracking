import pinoHttp from "pino-http";
import { logger } from "../config/logger";

/** Structured per-request access log (method, path, status, latency, request id). */
export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  redact: ["req.headers.authorization"],
});
