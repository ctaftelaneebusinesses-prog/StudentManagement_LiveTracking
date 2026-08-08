import { Router } from "express";
import * as extracurricularPortalController from "../controllers/extracurricularPortal.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  batchIdParamSchema,
  activityIdParamSchema,
  updateProfileSchema,
  markAttendanceSchema,
  attendanceSummaryQuerySchema,
  createPracticeWorkSchema,
  listPracticeWorkQuerySchema,
  createEventSchema,
  createAchievementSchema,
} from "../validators/extracurricularPortal.validator";

/**
 * Self-service endpoints for the calling Extracurricular Staff member's own
 * portal (dashboard, batches, schedule, attendance, practice work, events,
 * achievements). Mounted at a distinct `/extracurricular-portal` prefix —
 * never nested under the admin-only `/extracurricular-staff` management API
 * (requirePermission "extracurricular_staff.manage") — so no permission gate
 * is needed beyond requireAuth: every query here is already scoped to
 * req.user.id / ownership-checked, matching teacherPortal.routes.ts's
 * documented rationale exactly.
 */
const router = Router();

router.use(requireAuth);

router.get("/dashboard", extracurricularPortalController.getDashboard);
router.get("/timetable", extracurricularPortalController.getWeeklyTimetable);

router.get("/profile", extracurricularPortalController.getProfile);
router.patch("/profile", validate(updateProfileSchema), extracurricularPortalController.updateProfile);

router.get("/activities", extracurricularPortalController.getMyActivities);
router.patch(
  "/activities/:activityId/complete",
  validate(activityIdParamSchema),
  extracurricularPortalController.markActivityCompleted
);

router.get("/batches", extracurricularPortalController.getMyBatches);
router.get(
  "/batches/:batchId/students",
  validate(batchIdParamSchema),
  extracurricularPortalController.getBatchStudents
);

router.get("/schedule/today", extracurricularPortalController.getTodaySchedule);
router.get("/schedule", extracurricularPortalController.getWeeklySchedule);

router.post("/attendance", validate(markAttendanceSchema), extracurricularPortalController.markAttendance);
router.get(
  "/attendance/summary",
  validate(attendanceSummaryQuerySchema),
  extracurricularPortalController.getAttendanceSummary
);

router.get(
  "/practice-work",
  validate(listPracticeWorkQuerySchema),
  extracurricularPortalController.listPracticeWork
);
router.post(
  "/practice-work",
  validate(createPracticeWorkSchema),
  extracurricularPortalController.addPracticeWork
);

router.get("/events", extracurricularPortalController.listEvents);
router.post("/events", validate(createEventSchema), extracurricularPortalController.createEvent);

router.get("/achievements", extracurricularPortalController.listAchievements);
router.post("/achievements", validate(createAchievementSchema), extracurricularPortalController.addAchievement);

export default router;
