import { Router } from "express";
import * as staffController from "../controllers/extracurricularStaff.controller";
import * as achievementController from "../controllers/extracurricularAchievement.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createExtracurricularStaffSchema,
  updateExtracurricularStaffSchema,
  listExtracurricularStaffQuerySchema,
  staffIdParamSchema,
  updateStaffStatusSchema,
  assignActivitiesSchema,
  createBatchSchema,
  updateBatchSchema,
  batchIdParamSchema,
  addBatchStudentsSchema,
  removeBatchStudentSchema,
  scheduleSlotSchema,
  slotIdParamSchema,
} from "../validators/extracurricularStaff.validator";
import {
  addAchievementSchema,
  listAchievementsQuerySchema,
  deleteAchievementSchema,
} from "../validators/extracurricularAchievement.validator";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("extracurricular_staff.manage"));

// Must come before "/:id" so "dashboard-stats" isn't swallowed as an :id.
router.get("/dashboard-stats", staffController.getDashboardStats);

router.get("/", validate(listExtracurricularStaffQuerySchema), staffController.listStaff);
router.post("/", validate(createExtracurricularStaffSchema), staffController.createStaff);

router.get("/:id", validate(staffIdParamSchema), staffController.getStaff);
router.patch("/:id", validate(updateExtracurricularStaffSchema), staffController.updateStaff);
router.patch("/:id/status", validate(updateStaffStatusSchema), staffController.setStaffStatus);
router.put("/:id/activities", validate(assignActivitiesSchema), staffController.assignActivities);

router.get("/:id/batches", validate(staffIdParamSchema), staffController.listBatches);
router.post("/:id/batches", validate(createBatchSchema), staffController.createBatch);
router.patch("/batches/:batchId", validate(updateBatchSchema), staffController.updateBatch);
router.delete("/batches/:batchId", validate(batchIdParamSchema), staffController.deleteBatch);
router.post("/batches/:batchId/students", validate(addBatchStudentsSchema), staffController.addBatchStudents);
router.delete(
  "/batches/:batchId/students/:studentId",
  validate(removeBatchStudentSchema),
  staffController.removeBatchStudent
);

router.get("/:id/schedule", validate(staffIdParamSchema), staffController.listScheduleSlots);
router.post("/schedule", validate(scheduleSlotSchema), staffController.createScheduleSlot);
router.delete("/schedule/:slotId", validate(slotIdParamSchema), staffController.deleteScheduleSlot);

// Achievements — nested under the staff member, gated by the same
// requirePermission("extracurricular_staff.manage") applied above; kept
// in this file (rather than a mounted sub-router) to stay under the
// spec's ~150-line guidance while reusing the parent's ":id" param.
router.get("/:id/achievements", validate(listAchievementsQuerySchema), achievementController.listAchievements);
router.post("/:id/achievements", validate(addAchievementSchema), achievementController.addAchievement);
router.delete(
  "/:id/achievements/:achievementId",
  validate(deleteAchievementSchema),
  achievementController.deleteAchievement
);

export default router;
