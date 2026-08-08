import { Router } from "express";
import * as homeworkController from "../controllers/homework.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listHomeworkSchema,
  createHomeworkSchema,
  updateHomeworkSchema,
  homeworkIdParamSchema,
  submitHomeworkSchema,
  reviewHomeworkSchema,
  requestChangesSchema,
} from "../validators/homework.validator";

const router = Router();

router.use(requireAuth);

router.get(
  "/review",
  requirePermission("homework.manage"),
  validate(reviewHomeworkSchema),
  homeworkController.listForReview
);
router.get("/", requirePermission("homework.view"), validate(listHomeworkSchema), homeworkController.listForClass);
router.post(
  "/",
  requirePermission("homework.manage"),
  validate(createHomeworkSchema),
  homeworkController.createHomework
);
router.patch(
  "/:id",
  requirePermission("homework.manage"),
  validate(updateHomeworkSchema),
  homeworkController.updateHomework
);
router.patch(
  "/:id/approve",
  requirePermission("homework.manage"),
  validate(homeworkIdParamSchema),
  homeworkController.approveHomework
);
router.patch(
  "/:id/request-changes",
  requirePermission("homework.manage"),
  validate(requestChangesSchema),
  homeworkController.requestChanges
);
router.delete(
  "/:id",
  requirePermission("homework.manage"),
  validate(homeworkIdParamSchema),
  homeworkController.deleteHomework
);

router.post(
  "/:id/submit",
  requirePermission("homework.submit"),
  validate(submitHomeworkSchema),
  homeworkController.submitHomework
);
router.get(
  "/:id/submissions",
  requirePermission("homework.manage"),
  validate(homeworkIdParamSchema),
  homeworkController.listSubmissionsForHomework
);

export default router;
