import { Request, Response, NextFunction } from "express";
import * as schoolService from "../services/school.service";
import * as backupService from "../services/backup.service";
import { logActivity } from "../services/auditLog.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { ApiError } from "../utils/ApiError";
import { assertCanViewSchool } from "../utils/schoolAccess";

export async function listSchools(_req: Request, res: Response, next: NextFunction) {
  try {
    const schools = await schoolService.listAllSchools();
    return sendSuccess(res, schools);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /schools/assigned — the schools this caller may switch between.
 * Everyone authenticated can call it; the result is scoped to their own reach,
 * so a principal gets exactly their own school and a school_admin gets their
 * assignments. Never leaks the existence of any other school (§17).
 */
export async function listAssignedSchools(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) throw ApiError.unauthorized();
    const schools = await schoolService.listAccessibleSchools(user.accessibleSchoolIds, user.isSuperAdmin);
    return sendSuccess(res, schools);
  } catch (err) {
    return next(err);
  }
}

/** GET /schools/lookup?code=XXX — public, used by the self-registration page. */
export async function lookupSchool(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.query as { code: string };
    return sendSuccess(res, await schoolService.lookupSchoolByCode(code));
  } catch (err) {
    return next(err);
  }
}

export async function createSchool(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await schoolService.createSchool(req.body);
    return sendSuccess(res, school, 201);
  } catch (err) {
    return next(err);
  }
}

export async function getSchoolById(req: Request, res: Response, next: NextFunction) {
  try {
    assertCanViewSchool(req, req.params.id);
    return sendSuccess(res, await schoolService.getSchool(req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function updateSchoolById(req: Request, res: Response, next: NextFunction) {
  try {
    const school = await schoolService.updateSchool(req.params.id, req.body);
    void logActivity(req.params.id, req.user?.id ?? null, "school.profile_updated");
    return sendSuccess(res, school);
  } catch (err) {
    return next(err);
  }
}

export async function deleteSchoolById(req: Request, res: Response, next: NextFunction) {
  try {
    const force = (req.query as { force?: boolean }).force === true;
    return sendSuccess(res, await schoolService.deleteSchoolSafely(req.params.id, force));
  } catch (err) {
    return next(err);
  }
}

export async function getPlatformStats(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await schoolService.getPlatformStats());
  } catch (err) {
    return next(err);
  }
}

export async function getSchoolProfileStats(req: Request, res: Response, next: NextFunction) {
  try {
    assertCanViewSchool(req, req.params.id);
    return sendSuccess(res, await schoolService.getSchoolProfileStats(req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function getMySchool(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const school = await schoolService.getSchool(schoolId);
    return sendSuccess(res, school);
  } catch (err) {
    return next(err);
  }
}

export async function updateMySchool(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const school = await schoolService.updateSchool(schoolId, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "school.profile_updated");
    return sendSuccess(res, school);
  } catch (err) {
    return next(err);
  }
}

export async function updateSchoolSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { key, value } = req.body as { key: string; value: unknown };
    if (!schoolService.isSchoolSettingsKey(key)) throw ApiError.badRequest(`Unsupported settings key: ${key}`);
    const school = await schoolService.updateSchoolSettings(schoolId, key, value);
    void logActivity(schoolId, req.user?.id ?? null, "school.settings_updated", { metadata: { key } });
    return sendSuccess(res, school);
  } catch (err) {
    return next(err);
  }
}

export async function listAcademicYears(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const years = await schoolService.listAcademicYears(schoolId);
    return sendSuccess(res, years);
  } catch (err) {
    return next(err);
  }
}

export async function createAcademicYear(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const year = await schoolService.createAcademicYear(schoolId, req.body);
    return sendSuccess(res, year, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateAcademicYear(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const year = await schoolService.updateAcademicYear(schoolId, req.params.id, req.body);
    return sendSuccess(res, year);
  } catch (err) {
    return next(err);
  }
}

export async function setCurrentAcademicYear(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const year = await schoolService.setCurrentAcademicYear(schoolId, req.params.id);
    return sendSuccess(res, year);
  } catch (err) {
    return next(err);
  }
}

export async function listBranches(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const branches = await schoolService.listBranches(schoolId);
    return sendSuccess(res, branches);
  } catch (err) {
    return next(err);
  }
}

export async function createBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const branch = await schoolService.createBranch(schoolId, req.body);
    return sendSuccess(res, branch, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const branch = await schoolService.updateBranch(schoolId, req.params.id, req.body);
    return sendSuccess(res, branch);
  } catch (err) {
    return next(err);
  }
}

export async function deactivateBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const branch = await schoolService.deactivateBranch(schoolId, req.params.id);
    return sendSuccess(res, branch);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function listDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await schoolService.listDepartments(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const department = await schoolService.createDepartment(schoolId, req.body);
    return sendSuccess(res, department, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const department = await schoolService.updateDepartment(schoolId, req.params.id, req.body);
    return sendSuccess(res, department);
  } catch (err) {
    return next(err);
  }
}

export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await schoolService.deleteDepartment(schoolId, req.params.id);
    return sendSuccess(res, { message: "Department deleted" });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

export async function listHolidays(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await schoolService.listHolidays(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function createHoliday(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const holiday = await schoolService.createHoliday(schoolId, req.body);
    return sendSuccess(res, holiday, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateHoliday(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const holiday = await schoolService.updateHoliday(schoolId, req.params.id, req.body);
    return sendSuccess(res, holiday);
  } catch (err) {
    return next(err);
  }
}

export async function deleteHoliday(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await schoolService.deleteHoliday(schoolId, req.params.id);
    return sendSuccess(res, { message: "Holiday deleted" });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export async function exportSchoolData(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const bundle = await backupService.exportSchoolData(schoolId);
    void logActivity(schoolId, req.user?.id ?? null, "school.data_exported");
    return sendSuccess(res, bundle);
  } catch (err) {
    return next(err);
  }
}
