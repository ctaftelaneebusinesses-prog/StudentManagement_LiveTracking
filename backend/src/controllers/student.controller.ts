import { Request, Response, NextFunction } from "express";
import * as studentService from "../services/student.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function listStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { classId, search, page, pageSize } = req.query as unknown as {
      classId?: string;
      search?: string;
      page: number;
      pageSize: number;
    };
    return sendSuccess(res, await studentService.listStudents(schoolId, { classId, search, page, pageSize }));
  } catch (err) {
    return next(err);
  }
}

/**
 * Full profile (personal + class + parent details) — reachable by staff,
 * the student themself, their linked parents, and a teacher of their class.
 */
export async function getStudentProfile(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentService.getStudentProfile(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentService.createStudent(schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentService.updateStudent(schoolId, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function assignClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentService.assignClass(schoolId, req.params.id, req.body.class_id));
  } catch (err) {
    return next(err);
  }
}

export async function deactivateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentService.deactivateStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}
