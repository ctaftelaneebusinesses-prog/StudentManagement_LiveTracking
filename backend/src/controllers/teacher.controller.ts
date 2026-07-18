import { Request, Response, NextFunction } from "express";
import * as teacherService from "../services/teacher.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listTeachers(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherService.listTeachers(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherService.getTeacher(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherService.createTeacher(schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherService.updateTeacher(schoolId, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deactivateTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherService.deactivateTeacher(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function listAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherService.listTeacherAssignments(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function assignToClassSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { class_id, subject_id } = req.body;
    return sendSuccess(
      res,
      await teacherService.assignToClassSubject(schoolId, req.params.id, class_id, subject_id),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function setHomeroomTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await teacherService.setHomeroomTeacher(schoolId, req.params.id, req.body.class_id)
    );
  } catch (err) {
    return next(err);
  }
}
