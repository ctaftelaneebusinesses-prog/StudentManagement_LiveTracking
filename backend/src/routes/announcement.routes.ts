import { Router } from "express";
import * as announcementController from "../controllers/announcement.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listAnnouncementsSchema,
  announcementIdParamSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "../validators/announcement.validator";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("announcements.view"), validate(listAnnouncementsSchema), announcementController.listAnnouncements);
router.get(
  "/:id",
  requirePermission("announcements.view"),
  validate(announcementIdParamSchema),
  announcementController.getAnnouncement
);
router.post(
  "/",
  requirePermission("announcements.manage"),
  validate(createAnnouncementSchema),
  announcementController.createAnnouncement
);
router.patch(
  "/:id",
  requirePermission("announcements.manage"),
  validate(updateAnnouncementSchema),
  announcementController.updateAnnouncement
);
router.delete(
  "/:id",
  requirePermission("announcements.manage"),
  validate(announcementIdParamSchema),
  announcementController.deleteAnnouncement
);

export default router;
