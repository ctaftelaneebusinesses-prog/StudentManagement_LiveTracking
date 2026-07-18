import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createNotificationSchema } from "../validators/notification.validator";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("notifications.view"), notificationController.listForSchool);
router.post(
  "/",
  requirePermission("notifications.manage"),
  validate(createNotificationSchema),
  notificationController.createNotification
);

export default router;
