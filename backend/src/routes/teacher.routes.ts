import { Router } from "express";
import * as teacherController from "../controllers/teacher.controller";
import * as teacherDocumentController from "../controllers/teacherDocument.controller";
import * as teacherAttendanceController from "../controllers/teacherAttendance.controller";
import * as leaveRequestController from "../controllers/leaveRequest.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createTeacherSchema,
  updateTeacherSchema,
  listTeachersQuerySchema,
  assignTeacherToClassSchema,
  setHomeroomTeacherSchema,
  clearHomeroomTeacherSchema,
  bulkAssignSubjectsSchema,
} from "../validators/teacher.validator";
import { addTeacherDocumentSchema, deleteTeacherDocumentSchema } from "../validators/teacherDocument.validator";
import {
  listTeacherAttendanceSchema,
  teacherIdParamSchema,
} from "../validators/teacherAttendance.validator";
import { listLeaveRequestsForTeacherSchema } from "../validators/leaveRequest.validator";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("teachers.manage"));

router.get("/", validate(listTeachersQuerySchema), teacherController.listTeachers);
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
router.delete(
  "/:id/homeroom",
  validate(clearHomeroomTeacherSchema),
  teacherController.clearHomeroomTeacher
);
router.post(
  "/:id/assignments/bulk",
  validate(bulkAssignSubjectsSchema),
  teacherController.bulkAssignSubjects
);

router.get("/:id/documents", teacherDocumentController.listDocuments);
router.post("/:id/documents", validate(addTeacherDocumentSchema), teacherDocumentController.addDocument);
router.delete("/:id/documents/:docId", validate(deleteTeacherDocumentSchema), teacherDocumentController.deleteDocument);

router.get("/:id/attendance", validate(listTeacherAttendanceSchema), teacherAttendanceController.listForTeacher);
router.get("/:id/attendance/summary", validate(teacherIdParamSchema), teacherAttendanceController.getSummaryForTeacher);

router.get("/:id/leave-requests", validate(listLeaveRequestsForTeacherSchema), leaveRequestController.listForTeacher);

export default router;
