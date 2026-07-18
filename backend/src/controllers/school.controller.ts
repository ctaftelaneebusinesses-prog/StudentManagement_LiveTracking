import { Request, Response, NextFunction } from "express";
import * as schoolService from "../services/school.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listSchools(_req: Request, res: Response, next: NextFunction) {
  try {
    const schools = await schoolService.listAllSchools();
    return sendSuccess(res, schools);
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
