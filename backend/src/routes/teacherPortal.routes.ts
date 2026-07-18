import { Router } from "express";
import * as teacherPortalController from "../controllers/teacherPortal.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { classIdParamSchema } from "../validators/teacherPortal.validator";

/**
 * Self-service endpoints for the calling teacher's own portal (dashboard +
 * class roster). Mounted at a distinct `/teacher-portal` prefix — never
 * nested under `/teachers`, which is staff-only (requirePermission
 * "teachers.manage")) — so no permission gate is needed beyond requireAuth:
 * every query here is already scoped to req.user.id / ownership-checked.
 */
const router = Router();

router.use(requireAuth);

router.get("/dashboard", teacherPortalController.getDashboard);
router.get(
  "/classes/:classId/students",
  validate(classIdParamSchema),
  teacherPortalController.listStudentsForClass
);

export default router;
