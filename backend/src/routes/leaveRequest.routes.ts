import { Router } from "express";
import * as leaveRequestController from "../controllers/leaveRequest.controller";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listLeaveRequestsSchema,
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
  deleteLeaveRequestSchema,
  applySelfLeaveSchema,
} from "../validators/leaveRequest.validator";

const router = Router();

// Self-service — a principal applying for their own leave (reviewed only by
// admin/super_admin, never another principal; see leaveRequest.service.ts).
// Mounted before the permission-gated admin router below so it isn't shadowed
// by requirePermission("teachers.manage").
const meRouter = Router();
meRouter.use(requireAuth, requireRole("teacher", "principal"));
meRouter.get("/summary", leaveRequestController.getMySummary);
meRouter.get("/", leaveRequestController.listMine);
meRouter.post("/", validate(applySelfLeaveSchema), leaveRequestController.applyMine);
router.use("/me", meRouter);

router.use(requireAuth);
router.use(requirePermission("teachers.manage"));

router.get("/", validate(listLeaveRequestsSchema), leaveRequestController.list);
router.post("/", validate(createLeaveRequestSchema), leaveRequestController.create);
router.patch("/:id", validate(reviewLeaveRequestSchema), leaveRequestController.review);
router.delete("/:id", validate(deleteLeaveRequestSchema), leaveRequestController.remove);

export default router;
