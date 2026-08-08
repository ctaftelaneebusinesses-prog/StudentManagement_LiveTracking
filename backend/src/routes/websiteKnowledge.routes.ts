import { Router } from "express";
import * as questionController from "../controllers/websiteKnowledgeQuestion.controller";
import * as attemptController from "../controllers/websiteKnowledgeAttempt.controller";
import * as monitoringController from "../controllers/websiteKnowledgeMonitoring.controller";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  idParamSchema,
  listQuestionsSchema,
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionSetsSchema,
  createQuestionSetSchema,
  updateQuestionSetSchema,
  addQuestionToSetSchema,
  removeQuestionFromSetSchema,
  updateSettingsSchema,
  submitAnswerSchema,
  attemptIdParamSchema,
  userIdParamSchema,
} from "../validators/websiteKnowledge.validator";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Self-service: take the quiz, view own history/certificate. No extra role
// gate — every quiz-eligible role reaches these, and the controller resolves
// "which role am I taking this as" from the caller's own roles, never from
// client input (see requireOwnQuizRole in the controller).
// ---------------------------------------------------------------------------
router.get("/settings", questionController.getSettings);
router.post("/attempts/start", attemptController.startAttempt);
router.get("/attempts", attemptController.listMyAttempts);
router.get("/attempts/:id", validate(attemptIdParamSchema), attemptController.getAttemptDetail);
router.post("/attempts/:id/answers", validate(submitAnswerSchema), attemptController.submitAnswer);
router.post("/attempts/:id/complete", validate(attemptIdParamSchema), attemptController.completeAttempt);
router.get("/certificate", attemptController.getMyCertificate);

// ---------------------------------------------------------------------------
// Monitoring: role-hierarchy result visibility (spec §15-21).
// ---------------------------------------------------------------------------
router.get("/monitoring/summary", monitoringController.getMySummary);

router.get("/monitoring/students", requireRole("teacher"), monitoringController.listStudents);
router.get(
  "/monitoring/students/:studentId/history",
  requireRole("teacher"),
  validate(userIdParamSchema("studentId")),
  monitoringController.getStudentHistory
);
router.get("/monitoring/class-summary", requireRole("teacher"), monitoringController.getClassTeacherSummary);

router.get("/monitoring/teachers", requireRole("principal", "super_admin"), monitoringController.listTeachers);
router.get(
  "/monitoring/teachers/:teacherId/history",
  requireRole("principal", "super_admin"),
  validate(userIdParamSchema("teacherId")),
  monitoringController.getTeacherHistory
);
router.get("/monitoring/principal-summary", requireRole("principal"), monitoringController.getPrincipalSummary);

router.get("/monitoring/principals", requireRole("school_admin", "super_admin"), monitoringController.listPrincipals);
router.get(
  "/monitoring/principals/:principalId/history",
  requireRole("school_admin", "super_admin"),
  validate(userIdParamSchema("principalId")),
  monitoringController.getPrincipalHistory
);

router.get("/monitoring/school-admins", requireRole("super_admin"), monitoringController.listSchoolAdmins);
router.get(
  "/monitoring/school-admins/:schoolAdminId/history",
  requireRole("super_admin"),
  validate(userIdParamSchema("schoolAdminId")),
  monitoringController.getSchoolAdminHistory
);
router.get("/monitoring/global-stats", requireRole("super_admin"), monitoringController.getGlobalStats);

// ---------------------------------------------------------------------------
// Admin: Question Bank + platform settings (super_admin only).
// ---------------------------------------------------------------------------
const manageQuestions = requirePermission("assessment.manage_questions");
const manageSettings = requirePermission("assessment.manage_settings");

router.get("/admin/questions", manageQuestions, validate(listQuestionsSchema), questionController.listQuestions);
router.post("/admin/questions", manageQuestions, validate(createQuestionSchema), questionController.createQuestion);
router.patch("/admin/questions/:id", manageQuestions, validate(updateQuestionSchema), questionController.updateQuestion);
router.delete("/admin/questions/:id", manageQuestions, validate(idParamSchema), questionController.deleteQuestion);

router.get("/admin/question-sets", manageQuestions, validate(listQuestionSetsSchema), questionController.listQuestionSets);
router.post("/admin/question-sets", manageQuestions, validate(createQuestionSetSchema), questionController.createQuestionSet);
router.patch("/admin/question-sets/:id", manageQuestions, validate(updateQuestionSetSchema), questionController.updateQuestionSet);
router.delete("/admin/question-sets/:id", manageQuestions, validate(idParamSchema), questionController.deleteQuestionSet);
router.get("/admin/question-sets/:id/items", manageQuestions, validate(idParamSchema), questionController.getQuestionSetItems);
router.post("/admin/question-sets/:id/items", manageQuestions, validate(addQuestionToSetSchema), questionController.addQuestionToSet);
router.delete(
  "/admin/question-sets/:id/items/:questionId",
  manageQuestions,
  validate(removeQuestionFromSetSchema),
  questionController.removeQuestionFromSet
);

router.patch("/admin/settings", manageSettings, validate(updateSettingsSchema), questionController.updateSettings);

export default router;
