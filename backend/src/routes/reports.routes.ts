import { Router } from "express";
import * as reportsController from "../controllers/reports.controller";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  attendanceReportQuerySchema,
  classPerformanceQuerySchema,
  studentProgressParamSchema,
  studentReportQuerySchema,
  teacherReportQuerySchema,
  transportReportQuerySchema,
} from "../validators/reports.validator";

const router = Router();

router.use(requireAuth);

router.get(
  "/admin/overview",
  requireRole("school_admin", "super_admin", "principal"),
  reportsController.getAdminOverview
);

router.get(
  "/admin/dashboard-overview",
  requireRole("school_admin", "super_admin", "principal"),
  reportsController.getDashboardOverview
);

router.get(
  "/principal/school-analytics",
  requireRole("principal", "school_admin", "super_admin"),
  reportsController.getSchoolAnalytics
);

router.get(
  "/teacher/class-performance",
  requireRole("teacher", "principal", "school_admin", "super_admin"),
  validate(classPerformanceQuerySchema),
  reportsController.getClassPerformance
);

// Reachable by the student themself, staff, and a teacher of their class —
// see assertStudentAccess.
router.get(
  "/student-progress/:id",
  validate(studentProgressParamSchema),
  reportsController.getStudentProgress
);

// ---------------------------------------------------------------------------
// Reports console — Attendance/Student/Teacher/Fee/Transport/Exam tabs.
// ---------------------------------------------------------------------------

router.get(
  "/hub/attendance",
  requirePermission("reports.view"),
  validate(attendanceReportQuerySchema),
  reportsController.getAttendanceReport
);

router.get(
  "/hub/students",
  requirePermission("reports.view"),
  validate(studentReportQuerySchema),
  reportsController.getStudentReport
);

router.get(
  "/hub/teachers",
  requirePermission("reports.view"),
  validate(teacherReportQuerySchema),
  reportsController.getTeacherReport
);

router.get("/hub/fees", requirePermission("reports.view"), reportsController.getFeeReport);

router.get(
  "/hub/transport",
  requirePermission("reports.view"),
  validate(transportReportQuerySchema),
  reportsController.getTransportReport
);

router.get("/hub/exams", requirePermission("reports.view"), reportsController.getExamReportSummary);

export default router;
