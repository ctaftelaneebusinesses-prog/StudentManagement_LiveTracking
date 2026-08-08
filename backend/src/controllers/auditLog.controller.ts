import { Request, Response, NextFunction } from "express";
import * as auditLogService from "../services/auditLog.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function getLoginHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    return sendSuccess(res, await auditLogService.listLoginHistory(schoolId, { page, pageSize }));
  } catch (err) {
    return next(err);
  }
}

export async function getActivityLog(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    return sendSuccess(res, await auditLogService.listActivityLog(schoolId, { page, pageSize }));
  } catch (err) {
    return next(err);
  }
}
