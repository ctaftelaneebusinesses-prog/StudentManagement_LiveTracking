import { Router } from "express";
import * as registrationController from "../controllers/registration.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authLimiter } from "../middleware/rateLimit.middleware";
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
submitRouter.post("/principal", authLimiter, validate(registerPrincipalSchema), registrationController.submitPrincipal);
submitRouter.post("/accountant", authLimiter, validate(registerAccountantSchema), registrationController.submitAccountant);
submitRouter.post("/driver", authLimiter, validate(registerDriverSchema), registrationController.submitDriver);
submitRouter.post(
  "/extracurricular-staff",
  authLimiter,
  validate(registerExtracurricularStaffSchema),
  registrationController.submitExtracurricularStaff
);
submitRouter.post("/teacher", authLimiter, validate(registerTeacherSchema), registrationController.submitTeacher);
submitRouter.post("/student", authLimiter, validate(registerStudentSchema), registrationController.submitStudent);

const queueRouter = Router();
queueRouter.use(requireAuth);
queueRouter.get("/", validate(listRegistrationRequestsQuerySchema), registrationController.listQueue);
queueRouter.patch("/:id", validate(reviewRegistrationRequestSchema), registrationController.review);

export { submitRouter, queueRouter };
