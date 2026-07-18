import { Request, Response, NextFunction } from "express";
import * as userService from "../services/user.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { role, search, page, pageSize } = req.query as unknown as {
      role?: string;
      search?: string;
      page: number;
      pageSize: number;
    };
    const result = await userService.listUsers(schoolId, { role, search, page, pageSize });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const user = await userService.getUser(schoolId, req.params.id);
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const user = await userService.inviteUser(schoolId, req.body);
    return sendSuccess(res, user, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const user = await userService.updateUser(schoolId, req.params.id, req.body);
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const user = await userService.deactivateUser(schoolId, req.params.id);
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const roles = await userService.assignRole(schoolId, req.params.id, req.body.role_id);
    return sendSuccess(res, roles, 201);
  } catch (err) {
    return next(err);
  }
}

export async function revokeRole(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const roles = await userService.revokeRole(req.params.id, Number(req.params.roleId), schoolId);
    return sendSuccess(res, roles);
  } catch (err) {
    return next(err);
  }
}
