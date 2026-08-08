import { Router } from "express";
import * as teacherAttendanceController from "../controllers/teacherAttendance.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  getDailyTeacherAttendanceSchema,
  getMonthlySummarySchema,
  markTeacherAttendanceSchema,
} from "../validators/teacherAttendance.validator";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("teachers.manage"));

router.get("/daily", validate(getDailyTeacherAttendanceSchema), teacherAttendanceController.getDaily);
router.get("/monthly-summary", validate(getMonthlySummarySchema), teacherAttendanceController.getMonthlySummary);
router.post("/mark", validate(markTeacherAttendanceSchema), teacherAttendanceController.mark);

export default router;
