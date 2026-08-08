import { Request, Response, NextFunction } from "express";
import * as monitoringService from "../services/websiteKnowledgeMonitoring.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

// ---------------------------------------------------------------------------
// Class Teacher -> Students
// ---------------------------------------------------------------------------

export async function listStudents(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await monitoringService.listStudentsForClassTeacher(req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function getStudentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    await monitoringService.getStudentDetailForClassTeacher(req.user!.id, req.params.studentId);
    return sendSuccess(res, await monitoringService.getAttemptHistoryForUser(req.params.studentId, "student"));
  } catch (err) {
    return next(err);
  }
}

export async function getClassTeacherSummary(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await monitoringService.getClassTeacherSummary(req.user!.id));
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Teacher -> Principal
// ---------------------------------------------------------------------------

export async function listTeachers(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await monitoringService.listTeachersForPrincipal(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getTeacherHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await monitoringService.assertTeacherInPrincipalSchool(schoolId, req.params.teacherId);
    return sendSuccess(res, await monitoringService.getAttemptHistoryForUser(req.params.teacherId, "teacher"));
  } catch (err) {
    return next(err);
  }
}

export async function getPrincipalSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await monitoringService.getPrincipalSummary(schoolId));
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Principal -> School Admin
// ---------------------------------------------------------------------------

export async function listPrincipals(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolIds = req.user!.isSuperAdmin ? await monitoringService.listAllSchoolIds() : req.user!.accessibleSchoolIds;
    return sendSuccess(res, await monitoringService.listPrincipalsForSchoolAdmin(schoolIds));
  } catch (err) {
    return next(err);
  }
}

export async function getPrincipalHistory(req: Request, res: Response, next: NextFunction) {
  try {
    await monitoringService.assertPrincipalInAccessibleSchool(req.user!.accessibleSchoolIds, req.params.principalId, req.user!.isSuperAdmin);
    return sendSuccess(res, await monitoringService.getAttemptHistoryForUser(req.params.principalId, "principal"));
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// School Admin -> Super Admin (+ global stats)
// ---------------------------------------------------------------------------

export async function listSchoolAdmins(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await monitoringService.listSchoolAdminsForSuperAdmin());
  } catch (err) {
    return next(err);
  }
}

export async function getSchoolAdminHistory(req: Request, res: Response, next: NextFunction) {
  try {
    await monitoringService.assertIsSchoolAdmin(req.params.schoolAdminId);
    return sendSuccess(res, await monitoringService.getAttemptHistoryForUser(req.params.schoolAdminId, "school_admin"));
  } catch (err) {
    return next(err);
  }
}

export async function getGlobalStats(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await monitoringService.getGlobalStats());
  } catch (err) {
    return next(err);
  }
}

/**
 * Single role-aware "my team's progress" summary — dispatches to whichever
 * scope the caller's role actually has (spec §32-34): super_admin gets the
 * global rollup, principal gets their school's teacher rollup, a class
 * teacher gets their own class rollup. Anyone else (student, driver,
 * accountant, extracurricular_staff, a teacher who isn't a class teacher)
 * has no downward hierarchy to summarize.
 */
export async function getMySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    if (user.isSuperAdmin) {
      return sendSuccess(res, { scope: "global", ...(await monitoringService.getGlobalStats()) });
    }
    if (user.roles.includes("school_admin")) {
      const principals = await monitoringService.listPrincipalsForSchoolAdmin(user.accessibleSchoolIds);
      return sendSuccess(res, { scope: "school_admin", principals_overview: principals });
    }
    if (user.roles.includes("principal")) {
      const schoolId = resolveSchoolId(req);
      return sendSuccess(res, { scope: "principal", ...(await monitoringService.getPrincipalSummary(schoolId)) });
    }
    if (user.roles.includes("teacher")) {
      // getClassTeacherSummary returns all-zero counts for a teacher who
      // isn't a homeroom class teacher, rather than throwing — no separate
      // ownership probe needed here.
      return sendSuccess(res, { scope: "class_teacher", ...(await monitoringService.getClassTeacherSummary(user.id)) });
    }
    return sendSuccess(res, { scope: "none" });
  } catch (err) {
    return next(err);
  }
}
