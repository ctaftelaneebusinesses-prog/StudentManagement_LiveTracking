import { Router } from "express";
import * as homeworkController from "../controllers/homework.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listHomeworkSchema,
  createHomeworkSchema,
  updateHomeworkSchema,
  homeworkIdParamSchema,
} from "../validators/homework.validator";

const router = Router();

router.use(requireAuth);

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
router.delete(
  "/:id",
  requirePermission("homework.manage"),
  validate(homeworkIdParamSchema),
  homeworkController.deleteHomework
);

export default router;
