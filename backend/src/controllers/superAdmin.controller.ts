import { Request, Response, NextFunction } from "express";
import * as superAdminService from "../services/superAdmin.service";
import * as schoolService from "../services/school.service";
import * as platformAudit from "../services/platformAudit.service";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

/**
 * Every handler here sits behind requirePermission("platform.*") in
 * superAdmin.routes.ts, which only super_admin holds after
 * 066_super_admin_multi_school.sql. Access-changing actions write a
 * platform_audit_logs entry (§22) after the change succeeds.
 */

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboard(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await superAdminService.getPlatformDashboard());
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------
export async function listSchools(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await superAdminService.listSchoolsWithDetail());
  } catch (err) {
    return next(err);
  }
}

export async function getSchoolOverview(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await superAdminService.getSchoolOverview(req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createSchool(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await schoolService.createSchool(req.body);
    await platformAudit.logPlatformAction(req, {
      action: "school.created",
      targetType: "school",
      targetId: school.id,
      targetLabel: school.name,
      schoolId: school.id,
      schoolName: school.name,
      metadata: { code: school.code },
    });
    return sendSuccess(res, school, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateSchool(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await schoolService.updateSchool(req.params.id, req.body);
    await platformAudit.logPlatformAction(req, {
      action: "school.updated",
      targetType: "school",
      targetId: school.id,
      targetLabel: school.name,
      schoolId: school.id,
      schoolName: school.name,
      metadata: { fields: Object.keys(req.body) },
    });
    return sendSuccess(res, school);
  } catch (err) {
    return next(err);
  }
}

/** Preview only — shows what a (bulk) deactivation would affect. Changes nothing. */
export async function previewSchoolsImpact(req: Request, res: Response, next: NextFunction) {
  try {
    const { school_ids } = req.body as { school_ids: string[] };
    return sendSuccess(res, await superAdminService.getSchoolsDeactivationImpact(school_ids));
  } catch (err) {
    return next(err);
  }
}

/** Activate/deactivate one or many schools (§13). Cascades to their users; deletes nothing. */
export async function setSchoolsActive(req: Request, res: Response, next: NextFunction) {
  try {
    const { school_ids, is_active } = req.body as { school_ids: string[]; is_active: boolean };
    const impact = await superAdminService.getSchoolsDeactivationImpact(school_ids);
    const result = await superAdminService.setSchoolsActive(school_ids, is_active);

    const bulk = school_ids.length > 1;
    await platformAudit.logPlatformAction(req, {
      action: is_active
        ? bulk
          ? "school.bulk_activated"
          : "school.activated"
        : bulk
          ? "school.bulk_deactivated"
          : "school.deactivated",
      targetType: "school",
      targetId: school_ids.length === 1 ? school_ids[0] : null,
      targetLabel: impact.schools.map((s) => s.name).join(", "),
      schoolId: school_ids.length === 1 ? school_ids[0] : null,
      schoolName: school_ids.length === 1 ? impact.schools[0]?.name : null,
      metadata: {
        schoolCount: school_ids.length,
        schools: impact.schools.map((s) => ({ id: s.id, name: s.name })),
        usersAffected: result.usersAffected,
      },
    });

    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function deleteSchool(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await schoolService.getSchool(req.params.id);
    const force = req.query.force === "true";
    const result = await schoolService.deleteSchoolSafely(req.params.id, force);
    await platformAudit.logPlatformAction(req, {
      action: result.action === "deleted" ? "school.deleted" : "school.deactivated",
      targetType: "school",
      targetId: school.id,
      targetLabel: school.name,
      schoolName: school.name,
      metadata: { outcome: result.action, force },
    });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// School admins
// ---------------------------------------------------------------------------
export async function listSchoolAdmins(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, status, school_id } = req.query as {
      search?: string;
      status?: "active" | "inactive";
      school_id?: string;
    };
    return sendSuccess(
      res,
      await superAdminService.listSchoolAdmins({ search, status, schoolId: school_id })
    );
  } catch (err) {
    return next(err);
  }
}

export async function getSchoolAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await superAdminService.getSchoolAdmin(req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createSchoolAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await superAdminService.createSchoolAdmin(req.body);
    await platformAudit.logPlatformAction(req, {
      action: "school_admin.created",
      targetType: "school_admin",
      targetId: admin.id,
      targetLabel: admin.full_name,
      metadata: { email: admin.email, schools: admin.schools.map((s) => s.name) },
    });
    return sendSuccess(res, admin, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateSchoolAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await superAdminService.updateSchoolAdmin(req.params.id, req.body);
    await platformAudit.logPlatformAction(req, {
      action: "school_admin.updated",
      targetType: "school_admin",
      targetId: admin.id,
      targetLabel: admin.full_name,
      metadata: { fields: Object.keys(req.body) },
    });
    return sendSuccess(res, admin);
  } catch (err) {
    return next(err);
  }
}

export async function resetSchoolAdminPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await superAdminService.resetSchoolAdminPassword(req.params.id, req.body.password);
    await platformAudit.logPlatformAction(req, {
      action: "school_admin.password_reset",
      targetType: "school_admin",
      targetId: admin.id,
      targetLabel: admin.full_name,
    });
    // The plaintext is never echoed back or stored — the caller already has
    // the value they submitted, and it exists nowhere else after this point.
    return sendSuccess(res, { id: admin.id });
  } catch (err) {
    return next(err);
  }
}

export async function assignSchools(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.user?.id;
    if (!actorId) throw ApiError.unauthorized();

    const result = await superAdminService.replaceAssignments(
      req.params.id,
      req.body.school_ids,
      actorId
    );
    const admin = await superAdminService.getSchoolAdmin(req.params.id);

    await platformAudit.logPlatformAction(req, {
      action: "school_admin.schools_assigned",
      targetType: "assignment",
      targetId: admin.id,
      targetLabel: admin.full_name,
      metadata: {
        added: result.added.length,
        removed: result.removed.length,
        schools: admin.schools.map((s) => s.name),
      },
    });
    return sendSuccess(res, admin);
  } catch (err) {
    return next(err);
  }
}

export async function removeAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    await superAdminService.removeAssignment(req.params.id, req.params.schoolId);
    const admin = await superAdminService.getSchoolAdmin(req.params.id);
    await platformAudit.logPlatformAction(req, {
      action: "school_admin.school_removed",
      targetType: "assignment",
      targetId: admin.id,
      targetLabel: admin.full_name,
      schoolId: req.params.schoolId,
      metadata: { remaining: admin.schools.map((s) => s.name) },
    });
    return sendSuccess(res, admin);
  } catch (err) {
    return next(err);
  }
}

/** Preview only — powers the "this admin manages N schools / M users" dialog (§10). */
export async function previewSchoolAdminImpact(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await superAdminService.getSchoolAdminDeactivationImpact(req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function deactivateSchoolAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.id === req.params.id) {
      throw ApiError.badRequest("You cannot deactivate your own account");
    }
    const result = await superAdminService.deactivateSchoolAdmin(req.params.id);
    await platformAudit.logPlatformAction(req, {
      action: "school_admin.deactivated",
      targetType: "school_admin",
      targetId: result.admin.id,
      targetLabel: result.admin.full_name,
      metadata: {
        schoolsDeactivated: result.schoolsDeactivated.map((s) => s.name),
        usersAffected: result.usersAffected,
      },
    });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function activateSchoolAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await superAdminService.activateSchoolAdmin(req.params.id);
    await platformAudit.logPlatformAction(req, {
      action: "school_admin.activated",
      targetType: "school_admin",
      targetId: result.admin.id,
      targetLabel: result.admin.full_name,
      metadata: {
        schoolsReactivated: result.schoolsReactivated.map((s) => s.name),
        skipped: result.skippedSchools.map((s) => s.name),
        usersAffected: result.usersAffected,
      },
    });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export async function listAuditLog(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, action, school_id, search, from, to } = req.query as unknown as {
      page: number;
      pageSize: number;
      action?: string;
      school_id?: string;
      search?: string;
      from?: string;
      to?: string;
    };
    return sendSuccess(
      res,
      await platformAudit.listPlatformAuditLog({ page, pageSize, action, schoolId: school_id, search, from, to })
    );
  } catch (err) {
    return next(err);
  }
}

export async function listAuditActions(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await platformAudit.listAuditActions());
  } catch (err) {
    return next(err);
  }
}
