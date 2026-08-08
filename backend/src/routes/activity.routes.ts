import { Router } from "express";
import * as activityController from "../controllers/activity.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createActivitySchema,
  updateActivitySchema,
  listActivitiesQuerySchema,
  activityIdParamSchema,
} from "../validators/activity.validator";

const router = Router();

// Only requireAuth at the router level — GET must stay readable by any
// authenticated in-school user (extracurricular staff need this list for
// their own "Staff Type" / "Assign Activities" dropdowns), not just admins.
// requirePermission("activities.manage") is applied per-route below, only
// on the write endpoints.
router.use(requireAuth);

router.get("/", validate(listActivitiesQuerySchema), activityController.listActivities);
router.get(
  "/:id/assignments",
  requirePermission("activities.manage"),
  validate(activityIdParamSchema),
  activityController.listAssignments
);
router.post(
  "/",
  requirePermission("activities.manage"),
  validate(createActivitySchema),
  activityController.createActivity
);
router.patch(
  "/:id",
  requirePermission("activities.manage"),
  validate(updateActivitySchema),
  activityController.updateActivity
);
router.delete(
  "/:id",
  requirePermission("activities.manage"),
  validate(activityIdParamSchema),
  activityController.deactivateActivity
);

export default router;
