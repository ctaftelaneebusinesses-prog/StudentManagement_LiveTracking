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

// SEC-07: this is the staff-facing school-wide notification log (Emergency
// Alerts console) — listForSchool returns every notification in the school,
// including ones addressed to a specific user, using the service-role client.
// It must be gated on `notifications.manage` (staff), NOT `notifications.view`
// (which students also hold). A user's own notifications come from
// /notifications/me (RLS-scoped) and /students/:id/notifications
// (audience-filtered), which are unchanged.
router.get("/", requirePermission("notifications.manage"), notificationController.listForSchool);
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
