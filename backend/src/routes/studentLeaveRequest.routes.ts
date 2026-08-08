import { Router } from "express";
import * as studentLeaveRequestController from "../controllers/studentLeaveRequest.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { listClassTeacherLeaveQueueSchema, reviewStudentLeaveSchema } from "../validators/studentLeaveRequest.validator";

/**
 * The class teacher's review queue for student leave — kept as its own
 * router/table (student_leave_requests, distinct from leave_requests) rather
 * than folded into /leave-requests, mirroring the DB split already
 * documented in 008_parent_module.sql. Teacher-only: admin/principal have no
 * approval role for student leave per spec, only visibility via the nested
 * /students/:id/leave-requests history endpoint.
 */
const router = Router();

router.use(requireAuth, requireRole("teacher"));

router.get("/", validate(listClassTeacherLeaveQueueSchema), studentLeaveRequestController.listForClassTeacher);
router.patch("/:id", validate(reviewStudentLeaveSchema), studentLeaveRequestController.review);

export default router;
