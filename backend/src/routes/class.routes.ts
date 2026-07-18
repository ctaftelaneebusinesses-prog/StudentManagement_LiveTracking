import { Router } from "express";
import * as classController from "../controllers/class.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createClassSchema,
  updateClassSchema,
  createSubjectSchema,
  updateSubjectSchema,
  assignSubjectToClassSchema,
} from "../validators/class.validator";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("classes.manage"));

router.get("/classes", classController.listClasses);
router.post("/classes", validate(createClassSchema), classController.createClass);
router.patch("/classes/:id", validate(updateClassSchema), classController.updateClass);
router.delete("/classes/:id", classController.deleteClass);

router.get("/classes/:classId/subjects", classController.listClassSubjects);
router.post(
  "/classes/:classId/subjects",
  validate(assignSubjectToClassSchema),
  classController.assignSubjectToClass
);
router.delete("/classes/:classId/subjects/:subjectId", classController.removeSubjectFromClass);

router.get("/subjects", classController.listSubjects);
router.post("/subjects", validate(createSubjectSchema), classController.createSubject);
router.patch("/subjects/:id", validate(updateSubjectSchema), classController.updateSubject);
router.delete("/subjects/:id", classController.deleteSubject);

export default router;
