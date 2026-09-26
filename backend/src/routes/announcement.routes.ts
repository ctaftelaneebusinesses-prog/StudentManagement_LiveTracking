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

// SEC-08: this is the staff-facing announcement management list/detail — it
// returns every announcement in the school regardless of audience. It must be
// gated on `announcements.manage` (school_admin/principal/teacher/super_admin),
// NOT `announcements.view` (which students/other roles also hold). Students
// receive announcements through the audience-scoped notification fan-out
// (publishAnnouncement -> notifyUsers -> /notifications/me,
// /students/:id/notifications), not through this endpoint.
router.get("/", requirePermission("announcements.manage"), validate(listAnnouncementsSchema), announcementController.listAnnouncements);
router.get(
  "/:id",
  requirePermission("announcements.manage"),
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
