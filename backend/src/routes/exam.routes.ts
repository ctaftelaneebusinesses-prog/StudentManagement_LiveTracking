import { Router } from "express";
import * as examController from "../controllers/exam.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { listExamsSchema, createExamSchema, upsertMarksSchema, examIdParamSchema } from "../validators/exam.validator";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("marks.view"), validate(listExamsSchema), examController.listExams);
router.post("/", requirePermission("marks.manage"), validate(createExamSchema), examController.createExam);

router.get(
  "/:id/marks",
  requirePermission("marks.view"),
  validate(examIdParamSchema),
  examController.listMarksForExam
);
router.post(
  "/:id/marks",
  requirePermission("marks.manage"),
  validate(upsertMarksSchema),
  examController.upsertMarks
);

export default router;
