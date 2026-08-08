import { Router } from "express";
import * as studentProfileChangeRequestController from "../controllers/studentProfileChangeRequest.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listClassTeacherProfileChangeQueueSchema,
  reviewProfileChangeRequestSchema,
} from "../validators/studentProfileChangeRequest.validator";

/**
 * The class teacher's review queue for student profile change requests —
 * mirrors studentLeaveRequest.routes.ts exactly. Submission and history stay
 * nested under /students/:id/profile-change-requests (student.routes.ts)
 * since those are reachable by the student/parent themselves, not just staff.
 */
const router = Router();

router.use(requireAuth, requireRole("teacher"));

router.get("/", validate(listClassTeacherProfileChangeQueueSchema), studentProfileChangeRequestController.listForClassTeacher);
router.patch("/:id", validate(reviewProfileChangeRequestSchema), studentProfileChangeRequestController.review);

export default router;
