import { Router } from "express";
import * as schoolController from "../controllers/school.controller";
import { requireAuth, requirePermission } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createSchoolSchema,
  updateSchoolSchema,
  updateSchoolByIdSchema,
  schoolIdParamSchema,
  deleteSchoolSchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  createBranchSchema,
  updateBranchSchema,
  updateSchoolSettingsSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdParamSchema,
  createHolidaySchema,
  updateHolidaySchema,
  holidayIdParamSchema,
  schoolLookupQuerySchema,
} from "../validators/school.validator";

const router = Router();

// Public — the self-registration page resolves a school_id from a school
// code before any account (and therefore any req.user) exists. Must stay
// above `router.use(requireAuth)` below.
router.get("/lookup", validate(schoolLookupQuerySchema), schoolController.lookupSchool);

router.use(requireAuth);

// Platform-level — super_admin only.
router.get("/", requirePermission("platform.manage_schools"), schoolController.listSchools);
router.post(
  "/",
  requirePermission("platform.manage_schools"),
  validate(createSchoolSchema),
  schoolController.createSchool
);

// The caller's own switchable school list (their school + any school_admin
// assignments). Must stay above `/:id` and needs no permission — the response
// is scoped to the caller's own reach inside the controller.
router.get("/assigned", schoolController.listAssignedSchools);

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

// Settings (email/notifications/backup/workingDays — namespaced jsonb keys).
router.patch(
  "/me/settings",
  requirePermission("school.manage_settings"),
  validate(updateSchoolSettingsSchema),
  schoolController.updateSchoolSettings
);

// Departments.
router.get("/me/departments", schoolController.listDepartments);
router.post(
  "/me/departments",
  requirePermission("departments.manage"),
  validate(createDepartmentSchema),
  schoolController.createDepartment
);
router.patch(
  "/me/departments/:id",
  requirePermission("departments.manage"),
  validate(updateDepartmentSchema),
  schoolController.updateDepartment
);
router.delete(
  "/me/departments/:id",
  requirePermission("departments.manage"),
  validate(departmentIdParamSchema),
  schoolController.deleteDepartment
);

// Holidays.
router.get("/me/holidays", schoolController.listHolidays);
router.post(
  "/me/holidays",
  requirePermission("calendar.manage"),
  validate(createHolidaySchema),
  schoolController.createHoliday
);
router.patch(
  "/me/holidays/:id",
  requirePermission("calendar.manage"),
  validate(updateHolidaySchema),
  schoolController.updateHoliday
);
router.delete(
  "/me/holidays/:id",
  requirePermission("calendar.manage"),
  validate(holidayIdParamSchema),
  schoolController.deleteHoliday
);

// Backup.
router.get("/me/backup/export", requirePermission("school.manage_settings"), schoolController.exportSchoolData);

// Platform-level School Management (super_admin only, via platform.manage_schools).
// Registered last — Express matches routes in order, and `/:id` would
// otherwise shadow the literal `/me` / `/platform/stats` paths above.
router.get("/platform/stats", requirePermission("platform.manage_schools"), schoolController.getPlatformStats);
// GET /:id and /:id/stats have no route-level permission requirement — a
// principal may read their own school here (never anyone else's platform.
// manage_schools would also unlock cross-school targeting, which principal
// must never have). Row-level ownership is enforced in the controller via
// assertCanViewSchool.
router.get("/:id", validate(schoolIdParamSchema), schoolController.getSchoolById);
router.patch(
  "/:id",
  requirePermission("platform.manage_schools"),
  validate(updateSchoolByIdSchema),
  schoolController.updateSchoolById
);
router.delete(
  "/:id",
  requirePermission("platform.manage_schools"),
  validate(deleteSchoolSchema),
  schoolController.deleteSchoolById
);
router.get("/:id/stats", validate(schoolIdParamSchema), schoolController.getSchoolProfileStats);

export default router;
