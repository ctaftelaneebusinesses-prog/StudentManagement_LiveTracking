import { Router } from "express";
import * as superAdminController from "../controllers/superAdmin.controller";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createSchoolSchema, updateSchoolByIdSchema } from "../validators/school.validator";
import {
  listSchoolAdminsSchema,
  userIdParamSchema,
  schoolIdParamSchema,
  createSchoolAdminSchema,
  updateSchoolAdminSchema,
  resetSchoolAdminPasswordSchema,
  assignSchoolsSchema,
  removeAssignmentSchema,
  schoolIdsBodySchema,
  setSchoolsActiveSchema,
  auditLogQuerySchema,
} from "../validators/superAdmin.validator";

/**
 * Platform tier — super_admin only (066_super_admin_multi_school.sql).
 *
 * Guarded twice on purpose: requireRole("super_admin") is a blunt gate on the
 * whole router so no handler can be reached by a lower tier even if a
 * permission grant is later mis-seeded, and each route additionally names the
 * specific platform.* permission it needs.
 */
const router = Router();

router.use(requireAuth, requireRole("super_admin"));

// Dashboard (§4)
router.get("/dashboard", requirePermission("platform.manage_schools"), superAdminController.getDashboard);

// Schools (§8, §9, §13, §20)
router.get("/schools", requirePermission("platform.manage_schools"), superAdminController.listSchools);
router.post(
  "/schools",
  requirePermission("platform.manage_schools"),
  validate(createSchoolSchema),
  superAdminController.createSchool
);
router.post(
  "/schools/impact",
  requirePermission("platform.manage_schools"),
  validate(schoolIdsBodySchema),
  superAdminController.previewSchoolsImpact
);
router.post(
  "/schools/set-active",
  requirePermission("platform.manage_schools"),
  validate(setSchoolsActiveSchema),
  superAdminController.setSchoolsActive
);
router.get(
  "/schools/:id",
  requirePermission("platform.manage_schools"),
  validate(schoolIdParamSchema),
  superAdminController.getSchoolOverview
);
router.patch(
  "/schools/:id",
  requirePermission("platform.manage_schools"),
  validate(updateSchoolByIdSchema),
  superAdminController.updateSchool
);
router.delete(
  "/schools/:id",
  requirePermission("platform.manage_schools"),
  validate(schoolIdParamSchema),
  superAdminController.deleteSchool
);

// School admins (§5, §6, §7, §10, §12)
router.get(
  "/school-admins",
  requirePermission("platform.manage_school_admins"),
  validate(listSchoolAdminsSchema),
  superAdminController.listSchoolAdmins
);
router.post(
  "/school-admins",
  requirePermission("platform.manage_school_admins"),
  validate(createSchoolAdminSchema),
  superAdminController.createSchoolAdmin
);
router.get(
  "/school-admins/:id",
  requirePermission("platform.manage_school_admins"),
  validate(userIdParamSchema),
  superAdminController.getSchoolAdmin
);
router.patch(
  "/school-admins/:id",
  requirePermission("platform.manage_school_admins"),
  validate(updateSchoolAdminSchema),
  superAdminController.updateSchoolAdmin
);
router.post(
  "/school-admins/:id/reset-password",
  requirePermission("platform.manage_school_admins"),
  validate(resetSchoolAdminPasswordSchema),
  superAdminController.resetSchoolAdminPassword
);
router.put(
  "/school-admins/:id/schools",
  requirePermission("platform.manage_school_admins"),
  validate(assignSchoolsSchema),
  superAdminController.assignSchools
);
router.delete(
  "/school-admins/:id/schools/:schoolId",
  requirePermission("platform.manage_school_admins"),
  validate(removeAssignmentSchema),
  superAdminController.removeAssignment
);
router.get(
  "/school-admins/:id/impact",
  requirePermission("platform.manage_school_admins"),
  validate(userIdParamSchema),
  superAdminController.previewSchoolAdminImpact
);
router.post(
  "/school-admins/:id/deactivate",
  requirePermission("platform.manage_school_admins"),
  validate(userIdParamSchema),
  superAdminController.deactivateSchoolAdmin
);
router.post(
  "/school-admins/:id/activate",
  requirePermission("platform.manage_school_admins"),
  validate(userIdParamSchema),
  superAdminController.activateSchoolAdmin
);

// Audit log (§22)
router.get(
  "/audit-log",
  requirePermission("platform.view_audit_log"),
  validate(auditLogQuerySchema),
  superAdminController.listAuditLog
);
router.get("/audit-log/actions", requirePermission("platform.view_audit_log"), superAdminController.listAuditActions);

export default router;
