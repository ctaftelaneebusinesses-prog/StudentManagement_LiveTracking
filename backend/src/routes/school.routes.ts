import { Router } from "express";
import * as schoolController from "../controllers/school.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createSchoolSchema,
  updateSchoolSchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  createBranchSchema,
  updateBranchSchema,
} from "../validators/school.validator";

const router = Router();

router.use(requireAuth);

// Platform-level — super_admin only.
router.get("/", requirePermission("platform.manage_schools"), schoolController.listSchools);
router.post(
  "/",
  requirePermission("platform.manage_schools"),
  validate(createSchoolSchema),
  schoolController.createSchool
);

// Own-school profile/settings.
router.get("/me", schoolController.getMySchool);
router.patch(
  "/me",
  requirePermission("school.manage_settings"),
  validate(updateSchoolSchema),
  schoolController.updateMySchool
);

// Academic years.
router.get("/me/academic-years", schoolController.listAcademicYears);
router.post(
  "/me/academic-years",
  requirePermission("academic_years.manage"),
  validate(createAcademicYearSchema),
  schoolController.createAcademicYear
);
router.patch(
  "/me/academic-years/:id",
  requirePermission("academic_years.manage"),
  validate(updateAcademicYearSchema),
  schoolController.updateAcademicYear
);
router.post(
  "/me/academic-years/:id/set-current",
  requirePermission("academic_years.manage"),
  schoolController.setCurrentAcademicYear
);

// Branches.
router.get("/me/branches", schoolController.listBranches);
router.post(
  "/me/branches",
  requirePermission("branches.manage"),
  validate(createBranchSchema),
  schoolController.createBranch
);
router.patch(
  "/me/branches/:id",
  requirePermission("branches.manage"),
  validate(updateBranchSchema),
  schoolController.updateBranch
);
router.delete("/me/branches/:id", requirePermission("branches.manage"), schoolController.deactivateBranch);

export default router;
