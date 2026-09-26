import { Router } from "express";
import * as registrationController from "../controllers/registration.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authLimiter, registrationLimiter } from "../middleware/rateLimit.middleware";
import {
  registerPrincipalSchema,
  registerAccountantSchema,
  registerDriverSchema,
  registerExtracurricularStaffSchema,
  registerTeacherSchema,
  registerStudentSchema,
  listRegistrationRequestsQuerySchema,
  reviewRegistrationRequestSchema,
  registrationMetaQuerySchema,
} from "../validators/registration.validator";

/**
 * Public submission endpoints (POST /auth/register/*, mounted from
 * auth.routes.ts — no requireAuth, matching /auth/login's public-ness) plus
 * the authenticated approval-queue endpoints (mounted at /registration-requests
 * from routes/index.ts). Kept in one router since both halves share the same
 * service module; auth.routes.ts and routes/index.ts each mount the piece
 * they need.
 */
const submitRouter = Router();
submitRouter.get("/meta", validate(registrationMetaQuerySchema), registrationController.getMeta);
submitRouter.post("/principal", registrationLimiter, authLimiter, validate(registerPrincipalSchema), registrationController.submitPrincipal);
submitRouter.post("/accountant", registrationLimiter, authLimiter, validate(registerAccountantSchema), registrationController.submitAccountant);
submitRouter.post("/driver", registrationLimiter, authLimiter, validate(registerDriverSchema), registrationController.submitDriver);
submitRouter.post(
  "/extracurricular-staff",
  registrationLimiter,
  authLimiter,
  validate(registerExtracurricularStaffSchema),
  registrationController.submitExtracurricularStaff
);
submitRouter.post("/teacher", registrationLimiter, authLimiter, validate(registerTeacherSchema), registrationController.submitTeacher);
submitRouter.post("/student", registrationLimiter, authLimiter, validate(registerStudentSchema), registrationController.submitStudent);

const queueRouter = Router();
queueRouter.use(requireAuth);
queueRouter.get("/", validate(listRegistrationRequestsQuerySchema), registrationController.listQueue);
queueRouter.patch("/:id", validate(reviewRegistrationRequestSchema), registrationController.review);

export { submitRouter, queueRouter };
