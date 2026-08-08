import { Router } from "express";
import * as auditLogController from "../controllers/auditLog.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { listAuditQuerySchema } from "../validators/auditLog.validator";

const router = Router();

router.use(requireAuth);

router.get(
  "/login-history",
  requirePermission("security_logs.view"),
  validate(listAuditQuerySchema),
  auditLogController.getLoginHistory
);

router.get(
  "/activity-log",
  requirePermission("security_logs.view"),
  validate(listAuditQuerySchema),
  auditLogController.getActivityLog
);

export default router;
