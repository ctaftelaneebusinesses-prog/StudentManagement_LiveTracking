import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import * as controller from "../controllers/parentPortal.controller";
import { createLeaveRequestSchema, parentStudentParamsSchema } from "../validators/parentPortal.validator";

const router = Router();
router.use(requireAuth, requireRole("parent"));
router.get("/dashboard", controller.getDashboard);
router.get("/leave-requests", controller.listLeaveRequests);
router.post("/leave-requests", validate(createLeaveRequestSchema), controller.createLeaveRequest);
router.get("/students/:studentId/report-card", validate(parentStudentParamsSchema), controller.getReportCard);
export default router;
