import { Router } from "express";
import * as schoolRequestController from "../controllers/schoolRequest.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createSchoolRequestSchema,
  listSchoolRequestsSchema,
  requestIdParamSchema,
  reviewSchoolRequestSchema,
} from "../validators/schoolRequest.validator";

const router = Router();
router.use(requireAuth);

// school_admin side — submit and track their own requests.
router.post(
  "/",
  requirePermission("schools.request_creation"),
  validate(createSchoolRequestSchema),
  schoolRequestController.createRequest
);
router.get("/mine", requirePermission("schools.request_creation"), schoolRequestController.listMyRequests);

// super_admin side — review queue. Reuses platform.manage_schools, the same
// capability that already governs direct school creation.
router.get(
  "/",
  requirePermission("platform.manage_schools"),
  validate(listSchoolRequestsSchema),
  schoolRequestController.listAllRequests
);
router.post(
  "/:id/approve",
  requirePermission("platform.manage_schools"),
  validate(reviewSchoolRequestSchema),
  schoolRequestController.approveRequest
);
router.post(
  "/:id/reject",
  requirePermission("platform.manage_schools"),
  validate(reviewSchoolRequestSchema),
  schoolRequestController.rejectRequest
);
router.get(
  "/:id",
  requirePermission("platform.manage_schools"),
  validate(requestIdParamSchema),
  schoolRequestController.getRequest
);

export default router;
