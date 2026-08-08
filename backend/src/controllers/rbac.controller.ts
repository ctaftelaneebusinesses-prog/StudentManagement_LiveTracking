import { Request, Response, NextFunction } from "express";
import * as rbacService from "../services/rbac.service";
import { sendSuccess } from "../utils/ApiResponse";

export async function listRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await rbacService.listRoles());
  } catch (err) {
    return next(err);
  }
}

export async function listPermissions(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await rbacService.listPermissions());
  } catch (err) {
    return next(err);
  }
}

export async function listRolePermissionMatrix(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await rbacService.listRolePermissionMatrix());
  } catch (err) {
    return next(err);
  }
}
