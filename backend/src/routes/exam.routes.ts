import { Router } from "express";
import * as examController from "../controllers/exam.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listExamsSchema,
  createExamSchema,
  updateExamSchema,
  publishExamSchema,
  createScheduleEntrySchema,
  updateScheduleEntrySchema,
  scheduleIdParamSchema,
  addExamDocumentSchema,
  deleteExamDocumentSchema,
  publishExamDocumentSchema,
  upsertMarksSchema,
  examIdParamSchema,
  classSubjectStatusSchema,
  marksReminderSchema,
  classIdParamSchema,
} from "../validators/exam.validator";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("marks.view"), validate(listExamsSchema), examController.listExams);
router.post("/", requirePermission("marks.manage"), validate(createExamSchema), examController.createExam);

router.get("/analytics/performance", requirePermission("marks.view"), examController.getPerformanceAnalytics);

router.patch(
  "/:id",
  requirePermission("marks.manage"),
  validate(updateExamSchema),
  examController.updateExam
);
router.delete(
  "/:id",
  requirePermission("marks.manage"),
  validate(examIdParamSchema),
  examController.deleteExam
);

router.patch(
  "/:id/publish",
  requirePermission("marks.manage"),
  validate(publishExamSchema),
  examController.publishExam
);

router.get(
  "/:id/schedule",
  requirePermission("marks.view"),
  validate(examIdParamSchema),
  examController.listSchedule
);
router.post(
  "/:id/schedule",
  requirePermission("marks.manage"),
  validate(createScheduleEntrySchema),
  examController.createScheduleEntry
);
router.patch(
  "/:id/schedule/:scheduleId",
  requirePermission("marks.manage"),
  validate(updateScheduleEntrySchema),
  examController.updateScheduleEntry
);
router.delete(
  "/:id/schedule/:scheduleId",
  requirePermission("marks.manage"),
  validate(scheduleIdParamSchema),
  examController.deleteScheduleEntry
);

router.get(
  "/:id/documents",
  requirePermission("marks.view"),
  validate(examIdParamSchema),
  examController.listExamDocuments
);
router.post(
  "/:id/documents",
  requirePermission("marks.manage"),
  validate(addExamDocumentSchema),
  examController.addExamDocument
);
router.delete(
  "/:id/documents/:docId",
  requirePermission("marks.manage"),
  validate(deleteExamDocumentSchema),
  examController.deleteExamDocument
);
router.patch(
  "/:id/documents/:docId/publish",
  requirePermission("marks.manage"),
  validate(publishExamDocumentSchema),
  examController.publishExamDocument
);

router.get(
  "/:id/report",
  requirePermission("marks.view"),
  validate(examIdParamSchema),
  examController.getExamReport
);

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

router.get(
  "/:id/subject-status",
  requirePermission("marks.view"),
  validate(classSubjectStatusSchema),
  examController.getClassSubjectMarksStatus
);
router.post(
  "/:id/subjects/:subjectId/remind",
  requirePermission("marks.manage"),
  validate(marksReminderSchema),
  examController.sendMarksReminder
);

router.get(
  "/class/:classId/question-papers",
  requirePermission("marks.view"),
  validate(classIdParamSchema),
  examController.listQuestionPapersForClass
);

export default router;
