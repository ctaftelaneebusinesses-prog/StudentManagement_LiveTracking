import { Router } from "express";
import { login, refresh, me, forgotPassword, resetPasswordHandler } from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPasswordHandler);
router.get("/me", requireAuth, me);

export default router;
