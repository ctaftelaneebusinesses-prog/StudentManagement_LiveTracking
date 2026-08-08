import { Router } from "express";
import * as feesController from "../controllers/fees.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listFeeStructuresSchema,
  createFeeStructureSchema,
  updateFeeStructureSchema,
  feeStructureIdParamSchema,
  feeDashboardQuerySchema,
  feeAnalyticsQuerySchema,
  listStudentFeeDetailsSchema,
  listPaymentHistorySchema,
  receiptParamSchema,
  recentActivitySchema,
  collectionReportSchema,
  classWiseCollectionSchema,
  bulkAssignFeesSchema,
  bulkUpdateFeesSchema,
  bulkRemoveFeesSchema,
} from "../validators/fees.validator";

const router = Router();

router.use(requireAuth);

router.get("/classes", requirePermission("fees.view"), validate(feeDashboardQuerySchema), feesController.listClassesForFees);

router.get("/structures", requirePermission("fees.view"), validate(listFeeStructuresSchema), feesController.listFeeStructures);
router.post(
  "/structures",
  requirePermission("fees.manage"),
  validate(createFeeStructureSchema),
  feesController.createFeeStructure
);
router.patch(
  "/structures/:id",
  requirePermission("fees.manage"),
  validate(updateFeeStructureSchema),
  feesController.updateFeeStructure
);
router.delete(
  "/structures/:id",
  requirePermission("fees.manage"),
  validate(feeStructureIdParamSchema),
  feesController.deleteFeeStructure
);

router.get("/dashboard", requirePermission("fees.view"), validate(feeDashboardQuerySchema), feesController.getDashboardStats);
router.get("/analytics", requirePermission("fees.view"), validate(feeAnalyticsQuerySchema), feesController.getAnalytics);
router.get("/students", requirePermission("fees.view"), validate(listStudentFeeDetailsSchema), feesController.listStudentFeeDetails);
router.get("/payments", requirePermission("fees.view"), validate(listPaymentHistorySchema), feesController.listPaymentHistory);
router.get(
  "/payments/:paymentId/receipt",
  requirePermission("fees.view"),
  validate(receiptParamSchema),
  feesController.getReceipt
);

router.get("/recent-activity", requirePermission("fees.view"), validate(recentActivitySchema), feesController.getRecentActivity);
router.get("/reports/collection", requirePermission("fees.view"), validate(collectionReportSchema), feesController.getCollectionReport);
router.get("/reports/class-wise", requirePermission("fees.view"), validate(classWiseCollectionSchema), feesController.getClassWiseCollection);

router.post("/bulk/assign", requirePermission("fees.manage"), validate(bulkAssignFeesSchema), feesController.bulkAssignFees);
router.patch("/bulk/update", requirePermission("fees.manage"), validate(bulkUpdateFeesSchema), feesController.bulkUpdateFees);
router.delete("/bulk/remove", requirePermission("fees.manage"), validate(bulkRemoveFeesSchema), feesController.bulkRemoveFees);

export default router;
