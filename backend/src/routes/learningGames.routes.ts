import { Router } from "express";
import * as learningGamesController from "../controllers/learningGames.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { submitAttemptSchema } from "../validators/learningGames.validator";

/**
 * Student-only self-service — no role-hierarchy monitoring here, per spec
 * (games are a student learning area, not a reported-upward assessment).
 */
const router = Router();
router.use(requireAuth, requireRole("student"));

router.get("/catalog", learningGamesController.getCatalog);
router.post("/attempts", validate(submitAttemptSchema), learningGamesController.submitAttempt);
router.get("/profile", learningGamesController.getProfile);

export default router;
