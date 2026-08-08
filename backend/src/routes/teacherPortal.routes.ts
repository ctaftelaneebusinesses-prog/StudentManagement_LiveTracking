import { Router } from "express";
import * as teacherPortalController from "../controllers/teacherPortal.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  classIdParamSchema,
  listMyStudentsSchema,
  studentIdParamSchema,
  createAssessmentSchema,
  enhanceHomeworkSchema,
  applyForLeaveSchema,
  updateProfileSchema,
} from "../validators/teacherPortal.validator";

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
router.get("/my-assignments", teacherPortalController.listMyAssignments);
router.get(
  "/classes/:classId/students",
  validate(classIdParamSchema),
  teacherPortalController.listStudentsForClass
);

router.get("/profile", teacherPortalController.getProfile);
router.patch("/profile", validate(updateProfileSchema), teacherPortalController.updateProfile);
router.get("/students", validate(listMyStudentsSchema), teacherPortalController.listMyStudents);
router.get("/students/:studentId", validate(studentIdParamSchema), teacherPortalController.getStudentDetail);

router.get("/timetable/today", teacherPortalController.getTodayTimetable);
router.get("/timetable", teacherPortalController.getWeeklyTimetable);

router.get("/assessments", teacherPortalController.listMyAssessments);
router.post("/assessments", validate(createAssessmentSchema), teacherPortalController.createAssessment);

router.post("/homework/ai-enhance", validate(enhanceHomeworkSchema), teacherPortalController.enhanceHomework);

router.get("/leave-summary", teacherPortalController.getLeaveSummary);
router.get("/leave-requests", teacherPortalController.listMyLeaveRequests);
router.post("/leave-requests", validate(applyForLeaveSchema), teacherPortalController.applyForLeave);

router.get("/attendance/today", teacherPortalController.getTodayAttendance);
router.post("/attendance/check-in", teacherPortalController.checkIn);
router.post("/attendance/check-out", teacherPortalController.checkOut);

export default router;
