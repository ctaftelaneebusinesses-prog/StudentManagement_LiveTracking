import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  upsertAttendanceSchema,
  bulkUpsertAttendanceSchema,
  listClassAttendanceSchema,
  listClassAttendanceHistorySchema,
} from "../validators/attendance.validator";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission("attendance.view"),
  validate(listClassAttendanceSchema),
  attendanceController.listForClass
);
router.get(
  "/history",
  requirePermission("attendance.view"),
  validate(listClassAttendanceHistorySchema),
  attendanceController.listHistoryForClass
);
router.post(
  "/",
  requirePermission("attendance.manage"),
  validate(upsertAttendanceSchema),
  attendanceController.upsertAttendance
);
router.post(
  "/bulk",
  requirePermission("attendance.manage"),
  validate(bulkUpsertAttendanceSchema),
  attendanceController.bulkUpsertAttendance
);

export default router;
