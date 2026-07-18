import { Router } from "express";
import * as teacherController from "../controllers/teacher.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createTeacherSchema,
  updateTeacherSchema,
  assignTeacherToClassSchema,
  setHomeroomTeacherSchema,
} from "../validators/teacher.validator";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("teachers.manage"));

router.get("/", teacherController.listTeachers);
router.get("/:id", teacherController.getTeacher);
router.post("/", validate(createTeacherSchema), teacherController.createTeacher);
router.patch("/:id", validate(updateTeacherSchema), teacherController.updateTeacher);
router.delete("/:id", teacherController.deactivateTeacher);

router.get("/:id/assignments", teacherController.listAssignments);
router.post(
  "/:id/assignments",
  validate(assignTeacherToClassSchema),
  teacherController.assignToClassSubject
);
router.post(
  "/:id/homeroom",
  validate(setHomeroomTeacherSchema),
  teacherController.setHomeroomTeacher
);

export default router;
