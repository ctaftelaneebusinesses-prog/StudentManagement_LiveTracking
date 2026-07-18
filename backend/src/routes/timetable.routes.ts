import { Router } from "express";
import * as timetableController from "../controllers/timetable.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { listTimetableSchema, upsertPeriodSchema, periodIdParamSchema } from "../validators/timetable.validator";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission("timetable.view"),
  validate(listTimetableSchema),
  timetableController.listForClass
);
router.post(
  "/",
  requirePermission("timetable.manage"),
  validate(upsertPeriodSchema),
  timetableController.upsertPeriod
);
router.delete(
  "/:id",
  requirePermission("timetable.manage"),
  validate(periodIdParamSchema),
  timetableController.deletePeriod
);

export default router;
