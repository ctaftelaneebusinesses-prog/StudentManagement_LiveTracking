import { Router } from "express";
import * as studentController from "../controllers/student.controller";
import * as studentDocumentController from "../controllers/studentDocument.controller";
import * as evaluatedPaperController from "../controllers/evaluatedPaper.controller";
import * as attendanceController from "../controllers/attendance.controller";
import * as examController from "../controllers/exam.controller";
import * as homeworkController from "../controllers/homework.controller";
import * as timetableController from "../controllers/timetable.controller";
import * as notificationController from "../controllers/notification.controller";
import * as studentDashboardController from "../controllers/studentDashboard.controller";
import * as feesController from "../controllers/fees.controller";
import * as transportController from "../controllers/transport.controller";
import * as studentSiblingController from "../controllers/studentSibling.controller";
import * as studentActivityController from "../controllers/studentActivity.controller";
import * as studentLeaveRequestController from "../controllers/studentLeaveRequest.controller";
import * as studentProfileChangeRequestController from "../controllers/studentProfileChangeRequest.controller";
import * as studentExtracurricularController from "../controllers/studentExtracurricular.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { requireStudentWriteAccess, requireStudentManageAccess, requireStaffOnly } from "../utils/teacherAccess";
import { validate } from "../middleware/validate.middleware";
import {
  createStudentSchema,
  updateStudentSchema,
  assignClassSchema,
  listStudentsQuerySchema,
  bulkCreateStudentsSchema,
  bulkAssignClassSchema,
  bulkDeleteStudentsSchema,
} from "../validators/student.validator";
import { addDocumentSchema, deleteDocumentSchema } from "../validators/studentDocument.validator";
import {
  addEvaluatedPaperSchema,
  listEvaluatedPapersSchema,
  deleteEvaluatedPaperSchema,
} from "../validators/evaluatedPaper.validator";
import { listStudentAttendanceSchema } from "../validators/attendance.validator";
import { studentIdParamSchema, studentExamParamSchema } from "../validators/exam.validator";
import { markReadSchema, listStudentNotificationsSchema } from "../validators/notification.validator";
import {
  recordPaymentSchema,
  studentIdParamSchema as feeStudentIdParamSchema,
  upsertStudentFeeOverrideSchema,
  studentFeeOverrideParamSchema,
} from "../validators/fees.validator";
import { assignStudentTransportSchema } from "../validators/transport.validator";
import {
  searchSiblingCandidatesSchema,
  linkSiblingSchema,
  unlinkSiblingSchema,
} from "../validators/studentSibling.validator";
import { applyStudentLeaveSchema, listStudentLeaveSchema } from "../validators/studentLeaveRequest.validator";
import {
  submitChangeRequestSchema,
  listStudentProfileChangeRequestsSchema,
} from "../validators/studentProfileChangeRequest.validator";

const router = Router();

router.use(requireAuth);

// --- Core student CRUD (staff-only, except create/update below which a
//     class/subject teacher may also do for their own students) -----------
router.get("/", requirePermission("students.view"), validate(listStudentsQuerySchema), studentController.listStudents);
router.post(
  "/",
  requireStudentWriteAccess,
  validate(createStudentSchema),
  studentController.createStudent
);

// --- Bulk operations (must precede /:id so "bulk*" isn't swallowed by it) ---
router.post(
  "/bulk",
  requirePermission("students.manage"),
  requireStaffOnly,
  validate(bulkCreateStudentsSchema),
  studentController.bulkCreateStudents
);
router.post(
  "/bulk-assign-class",
  requirePermission("students.manage"),
  requireStaffOnly,
  validate(bulkAssignClassSchema),
  studentController.bulkAssignClass
);
router.post(
  "/bulk-delete",
  requirePermission("students.manage"),
  requireStaffOnly,
  validate(bulkDeleteStudentsSchema),
  studentController.bulkDeleteStudents
);

// GET /:id is reachable by staff, the student themself, and a teacher of
// their class — see assertStudentAccess.
router.get("/:id", studentController.getStudentProfile);

router.patch(
  "/:id",
  requireStudentWriteAccess,
  validate(updateStudentSchema),
  studentController.updateStudent
);
router.patch(
  "/:id/class",
  requirePermission("students.manage"),
  requireStaffOnly,
  validate(assignClassSchema),
  studentController.assignClass
);
router.delete("/:id", requirePermission("students.manage"), requireStaffOnly, studentController.deactivateStudent);
router.post("/:id/activate", requirePermission("students.manage"), requireStaffOnly, studentController.activateStudent);
router.delete(
  "/:id/permanent",
  requirePermission("students.manage"),
  requireStaffOnly,
  studentController.permanentlyDeleteStudent
);

// --- Documents ---------------------------------------------------------------
router.get("/:id/documents", studentDocumentController.listDocuments);
router.post(
  "/:id/documents",
  requireStudentManageAccess,
  validate(addDocumentSchema),
  studentDocumentController.addDocument
);
router.delete(
  "/:id/documents/:docId",
  requireStudentManageAccess,
  validate(deleteDocumentSchema),
  studentDocumentController.deleteDocument
);

// --- Evaluated papers (corrected/graded answer sheets) -----------------------
router.get("/:id/evaluated-papers", validate(listEvaluatedPapersSchema), evaluatedPaperController.listForStudent);
router.post(
  "/:id/evaluated-papers",
  requirePermission("evaluated_papers.manage"),
  validate(addEvaluatedPaperSchema),
  evaluatedPaperController.addPaper
);
router.delete(
  "/:id/evaluated-papers/:paperId",
  requirePermission("evaluated_papers.manage"),
  validate(deleteEvaluatedPaperSchema),
  evaluatedPaperController.deletePaper
);

// --- Fee summary --------------------------------------------------------------
router.get("/:id/fees/summary", validate(feeStudentIdParamSchema), feesController.getFeeSummaryForStudent);
router.get("/:id/fees/payments", validate(feeStudentIdParamSchema), feesController.listPaymentsForStudent);
router.post(
  "/:id/fees/payments",
  requirePermission("fees.manage"),
  validate(recordPaymentSchema),
  feesController.recordPaymentForStudent
);
router.put(
  "/:id/fees/structures/:feeStructureId/override",
  requirePermission("fees.manage"),
  validate(upsertStudentFeeOverrideSchema),
  feesController.upsertStudentFeeOverride
);
router.delete(
  "/:id/fees/structures/:feeStructureId/override",
  requirePermission("fees.manage"),
  validate(studentFeeOverrideParamSchema),
  feesController.deleteStudentFeeOverride
);

// --- Transport details ---------------------------------------------------------
router.get("/:id/transport", validate(studentIdParamSchema), transportController.getStudentTransport);
router.patch(
  "/:id/transport",
  requirePermission("transport.manage"),
  validate(assignStudentTransportSchema),
  transportController.assignStudentTransport
);
router.delete(
  "/:id/transport",
  requirePermission("transport.manage"),
  validate(studentIdParamSchema),
  transportController.unassignStudentTransport
);

// --- Siblings -----------------------------------------------------------------
router.get("/:id/siblings", studentSiblingController.listSiblings);
router.get(
  "/:id/siblings/search",
  requireStudentManageAccess,
  validate(searchSiblingCandidatesSchema),
  studentSiblingController.searchSiblingCandidates
);
router.post(
  "/:id/siblings/link",
  requireStudentManageAccess,
  validate(linkSiblingSchema),
  studentSiblingController.linkSibling
);
router.delete(
  "/:id/siblings/:siblingId",
  requireStudentManageAccess,
  validate(unlinkSiblingSchema),
  studentSiblingController.unlinkSibling
);

// --- Activity timeline ---------------------------------------------------------
router.get("/:id/activity", studentActivityController.getActivityTimeline);

// --- Dashboard (aggregates everything below in one call) --------------------
router.get("/:id/dashboard", studentDashboardController.getDashboard);

// --- Individual dashboard widgets (deep-linkable "view all" endpoints) ------
router.get("/:id/attendance", validate(listStudentAttendanceSchema), attendanceController.listForStudent);
router.get("/:id/attendance/summary", validate(listStudentAttendanceSchema), attendanceController.getSummaryForStudent);
router.get("/:id/marks", validate(studentIdParamSchema), examController.listMarksForStudent);
router.get("/:id/marks/summary", validate(studentIdParamSchema), examController.getMarksSummaryForStudent);
router.get("/:id/exams/upcoming", validate(studentIdParamSchema), examController.listUpcomingForStudent);
router.get("/:id/exams", validate(studentIdParamSchema), examController.listExamsForStudent);
router.get("/:id/exams/:examId/schedule", validate(studentExamParamSchema), examController.getExamScheduleForStudent);
router.get("/:id/report-card", validate(studentIdParamSchema), examController.getReportCardForStudent);
router.get("/:id/question-papers", validate(studentIdParamSchema), examController.listQuestionPapersForStudent);
router.get("/:id/homework", validate(studentIdParamSchema), homeworkController.listUpcomingForStudent);
router.get("/:id/homework/all", validate(studentIdParamSchema), homeworkController.listAllForStudent);
router.get("/:id/timetable", validate(studentIdParamSchema), timetableController.getWeeklyForStudent);
router.get("/:id/extracurricular", validate(studentIdParamSchema), studentExtracurricularController.getOverview);
router.get("/:id/notifications", validate(listStudentNotificationsSchema), notificationController.listForStudent);
router.post(
  "/:id/notifications/:notificationId/read",
  validate(markReadSchema),
  notificationController.markRead
);

// --- Leave requests (student self-service; see also /student-leave-requests
//     for the class teacher's review queue) --------------------------------
router.get("/:id/leave-requests", validate(listStudentLeaveSchema), studentLeaveRequestController.listForStudent);
router.post("/:id/leave-requests", validate(applyStudentLeaveSchema), studentLeaveRequestController.applyForStudent);

// --- Profile change requests (student self-service; see also
//     /profile-change-requests for the class teacher's review queue) --------
router.get(
  "/:id/profile-change-requests",
  validate(listStudentProfileChangeRequestsSchema),
  studentProfileChangeRequestController.listForStudent
);
router.post(
  "/:id/profile-change-requests",
  validate(submitChangeRequestSchema),
  studentProfileChangeRequestController.submitForStudent
);

export default router;
