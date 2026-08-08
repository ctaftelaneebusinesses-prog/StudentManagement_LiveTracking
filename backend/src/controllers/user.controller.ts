import { Request, Response, NextFunction } from "express";
import * as userService from "../services/user.service";
import { logActivity } from "../services/auditLog.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertPrincipalMayManageUser, assertPrincipalMayAssignRole } from "../utils/userAccess";

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { role, search, status, page, pageSize } = req.query as unknown as {
      role?: string;
      search?: string;
      status?: "active" | "inactive";
      page: number;
      pageSize: number;
    };
    const result = await userService.listUsers(schoolId, { role, search, status, page, pageSize });
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
    await assertPrincipalMayAssignRole(req, req.body.role_id);
    const schoolId = resolveSchoolId(req);
    const user = await userService.createUser(schoolId, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "user.created", { targetType: "user", targetId: user.id });
    return sendSuccess(res, user, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    await assertPrincipalMayManageUser(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    const user = await userService.updateUser(schoolId, req.params.id, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "user.updated", { targetType: "user", targetId: req.params.id });
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    await assertPrincipalMayManageUser(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    const user = await userService.deactivateUser(schoolId, req.params.id);
    void logActivity(schoolId, req.user?.id ?? null, "user.deactivated", { targetType: "user", targetId: req.params.id });
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await assertPrincipalMayManageUser(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    await userService.resetPassword(schoolId, req.params.id, req.body.password);
    return sendSuccess(res, { message: "Password reset" });
  } catch (err) {
    return next(err);
  }
}

export async function bulkActivate(req: Request, res: Response, next: NextFunction) {
  try {
    for (const id of req.body.userIds as string[]) {
      await assertPrincipalMayManageUser(req, id);
    }
    const schoolId = resolveSchoolId(req);
    const result = await userService.bulkSetActive(schoolId, req.body.userIds, true);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function bulkDeactivate(req: Request, res: Response, next: NextFunction) {
  try {
    for (const id of req.body.userIds as string[]) {
      await assertPrincipalMayManageUser(req, id);
    }
    const schoolId = resolveSchoolId(req);
    const result = await userService.bulkSetActive(schoolId, req.body.userIds, false);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function bulkCreateUsers(req: Request, res: Response, next: NextFunction) {
  try {
    for (const row of req.body.users as { role_id: number }[]) {
      await assertPrincipalMayAssignRole(req, row.role_id);
    }
    const schoolId = resolveSchoolId(req);
    const result = await userService.bulkCreateUsers(schoolId, req.body.users);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return next(err);
  }
}

export async function bulkDeleteUsers(req: Request, res: Response, next: NextFunction) {
  try {
    for (const id of req.body.userIds as string[]) {
      await assertPrincipalMayManageUser(req, id);
    }
    const schoolId = resolveSchoolId(req);
    const result = await userService.bulkDeleteUsers(schoolId, req.body.userIds);
    void logActivity(schoolId, req.user?.id ?? null, "user.bulk_deleted", { targetType: "user" });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function listUserRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await userService.listUserRoles(req.params.id);
    return sendSuccess(res, roles);
  } catch (err) {
    return next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    await assertPrincipalMayManageUser(req, req.params.id);
    await assertPrincipalMayAssignRole(req, req.body.role_id);
    const schoolId = resolveSchoolId(req);
    const roles = await userService.assignRole(schoolId, req.params.id, req.body.role_id);
    void logActivity(schoolId, req.user?.id ?? null, "user.role_assigned", {
      targetType: "user",
      targetId: req.params.id,
      metadata: { role_id: req.body.role_id },
    });
    return sendSuccess(res, roles, 201);
  } catch (err) {
    return next(err);
  }
}

export async function revokeRole(req: Request, res: Response, next: NextFunction) {
  try {
    await assertPrincipalMayManageUser(req, req.params.id);
    await assertPrincipalMayAssignRole(req, Number(req.params.roleId));
    const schoolId = resolveSchoolId(req);
    const roles = await userService.revokeRole(req.params.id, Number(req.params.roleId), schoolId);
    void logActivity(schoolId, req.user?.id ?? null, "user.role_revoked", {
      targetType: "user",
      targetId: req.params.id,
      metadata: { role_id: Number(req.params.roleId) },
    });
    return sendSuccess(res, roles);
  } catch (err) {
    return next(err);
  }
}
