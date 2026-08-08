import { Router } from "express";
import * as controller from "../controllers/timetableChangeRequest.controller";
import { requireAuth, requireRole, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createSuggestionSchema, reviewSuggestionSchema } from "../validators/timetableChangeRequest.validator";

const router = Router();

router.use(requireAuth);

// Teacher self-service — suggest a change, view my own suggestions.
router.post("/", requireRole("teacher"), validate(createSuggestionSchema), controller.create);
router.get("/mine", requireRole("teacher"), controller.listMine);

// Admin review queue.
router.get("/", requirePermission("timetable.manage"), controller.listOpen);
router.patch("/:id", requirePermission("timetable.manage"), validate(reviewSuggestionSchema), controller.review);

export default router;
