import { Router } from "express";
import {
  login,
  refresh,
  me,
  forgotPassword,
  resetPasswordHandler,
  changePasswordHandler,
  recordLoginAttempt,
} from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { requireAuth, requireAuthAllowUnapproved } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rateLimit.middleware";
import {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validators/auth.validator";
import { submitRouter as registerRouter } from "./registration.routes";

const router = Router();

router.use("/register", registerRouter);

router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", authLimiter, validate(refreshSchema), refresh);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPasswordHandler);
// SEC-17: authenticated — records only the caller's own (verified) successful login.
router.post("/record-login-attempt", requireAuth, authLimiter, recordLoginAttempt);
router.get("/me", requireAuthAllowUnapproved, me);
router.post("/change-password", requireAuth, authLimiter, validate(changePasswordSchema), changePasswordHandler);

export default router;
