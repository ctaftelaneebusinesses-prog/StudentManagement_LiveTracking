import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createNotificationSchema, markReadForMeSchema, emergencyAlertSchema } from "../validators/notification.validator";

const router = Router();

router.use(requireAuth);

// Generic inbox — any authenticated role, RLS decides what they can see.
router.get("/me", notificationController.listForMe);
router.put("/read-all", notificationController.markAllReadForMe);
router.put("/:notificationId/read", validate(markReadForMeSchema), notificationController.markReadForMe);

router.get("/", requirePermission("notifications.view"), notificationController.listForSchool);
router.post(
  "/",
  requirePermission("notifications.manage"),
  validate(createNotificationSchema),
  notificationController.createNotification
);

// Emergency alerts are a school-wide, critical broadcast — restricted to
// admin/principal roles regardless of who else holds notifications.manage.
router.post(
  "/emergency",
  requireRole("school_admin", "super_admin", "principal"),
  requirePermission("notifications.manage"),
  validate(emergencyAlertSchema),
  notificationController.createEmergencyAlert
);

export default router;
