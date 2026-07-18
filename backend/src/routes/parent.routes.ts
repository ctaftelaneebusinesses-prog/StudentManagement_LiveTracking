import { Router } from "express";
import * as parentController from "../controllers/parent.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { searchParentsSchema } from "../validators/parent.validator";

const router = Router();

router.use(requireAuth);

// Search for an already-registered parent (e.g. linking a sibling's guardian to another child).
router.get("/", requirePermission("students.manage"), validate(searchParentsSchema), parentController.searchParents);

export default router;
