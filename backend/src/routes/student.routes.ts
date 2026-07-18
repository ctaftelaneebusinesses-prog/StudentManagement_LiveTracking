import { Router } from "express";
import * as studentController from "../controllers/student.controller";
import * as parentController from "../controllers/parent.controller";
import * as studentDocumentController from "../controllers/studentDocument.controller";
import * as attendanceController from "../controllers/attendance.controller";
import * as examController from "../controllers/exam.controller";
import * as homeworkController from "../controllers/homework.controller";
import * as timetableController from "../controllers/timetable.controller";
import * as notificationController from "../controllers/notification.controller";
import * as studentDashboardController from "../controllers/studentDashboard.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createStudentSchema,
  updateStudentSchema,
  assignClassSchema,
  listStudentsQuerySchema,
} from "../validators/student.validator";
import {
  createAndLinkParentSchema,
  linkExistingParentSchema,
  updateLinkedParentSchema,
  unlinkParentSchema,
} from "../validators/parent.validator";
import { addDocumentSchema, deleteDocumentSchema } from "../validators/studentDocument.validator";
import { listStudentAttendanceSchema } from "../validators/attendance.validator";
import { studentIdParamSchema } from "../validators/exam.validator";
import { markReadSchema } from "../validators/notification.validator";

const router = Router();

router.use(requireAuth);

// --- Core student CRUD (staff-only) ---------------------------------------
router.get("/", requirePermission("students.view"), validate(listStudentsQuerySchema), studentController.listStudents);
router.post(
  "/",
  requirePermission("students.manage"),
  validate(createStudentSchema),
  studentController.createStudent
);

// GET /:id is reachable by staff, the student themself, their linked
// parents, and a teacher of their class — see assertStudentAccess.
router.get("/:id", studentController.getStudentProfile);

router.patch(
  "/:id",
  requirePermission("students.manage"),
  validate(updateStudentSchema),
  studentController.updateStudent
);
router.patch(
  "/:id/class",
  requirePermission("students.manage"),
  validate(assignClassSchema),
  studentController.assignClass
);
router.delete("/:id", requirePermission("students.manage"), studentController.deactivateStudent);

// --- Parent details ---------------------------------------------------------
router.get("/:id/parents", parentController.listParentsForStudent);
router.post(
  "/:id/parents",
  requirePermission("students.manage"),
  validate(createAndLinkParentSchema),
  parentController.createAndLinkParent
);
router.post(
  "/:id/parents/link",
  requirePermission("students.manage"),
  validate(linkExistingParentSchema),
  parentController.linkExistingParent
);
router.patch(
  "/:id/parents/:parentId",
  requirePermission("students.manage"),
  validate(updateLinkedParentSchema),
  parentController.updateLinkedParent
);
router.delete(
  "/:id/parents/:parentId",
  requirePermission("students.manage"),
  validate(unlinkParentSchema),
  parentController.unlinkParent
);

// --- Documents ---------------------------------------------------------------
router.get("/:id/documents", studentDocumentController.listDocuments);
router.post(
  "/:id/documents",
  requirePermission("students.manage"),
  validate(addDocumentSchema),
  studentDocumentController.addDocument
);
router.delete(
  "/:id/documents/:docId",
  requirePermission("students.manage"),
  validate(deleteDocumentSchema),
  studentDocumentController.deleteDocument
);

// --- Dashboard (aggregates everything below in one call) --------------------
router.get("/:id/dashboard", studentDashboardController.getDashboard);

// --- Individual dashboard widgets (deep-linkable "view all" endpoints) ------
router.get("/:id/attendance", validate(listStudentAttendanceSchema), attendanceController.listForStudent);
router.get("/:id/attendance/summary", validate(listStudentAttendanceSchema), attendanceController.getSummaryForStudent);
router.get("/:id/marks", validate(studentIdParamSchema), examController.listMarksForStudent);
router.get("/:id/marks/summary", validate(studentIdParamSchema), examController.getMarksSummaryForStudent);
router.get("/:id/homework", validate(studentIdParamSchema), homeworkController.listUpcomingForStudent);
router.get("/:id/timetable", validate(studentIdParamSchema), timetableController.getWeeklyForStudent);
router.get("/:id/notifications", validate(studentIdParamSchema), notificationController.listForStudent);
router.post(
  "/:id/notifications/:notificationId/read",
  validate(markReadSchema),
  notificationController.markRead
);

export default router;
