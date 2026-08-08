import { Request, Response, NextFunction } from "express";
import * as classService from "../services/class.service";
import * as studentService from "../services/student.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listClasses(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.listClasses(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.getClass(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

/** Roster for a single class — search/pagination delegate to the same listing logic used by GET /students. */
export async function getClassStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search, page, pageSize } = req.query as unknown as { search?: string; page: number; pageSize: number };
    return sendSuccess(
      res,
      await studentService.listStudents(schoolId, { classId: req.params.id, search, page, pageSize })
    );
  } catch (err) {
    return next(err);
  }
}

export async function createClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.createClass(schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.updateClass(schoolId, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await classService.deleteClass(schoolId, req.params.id);
    return sendSuccess(res, { message: "Class deleted" });
  } catch (err) {
    return next(err);
  }
}

export async function listSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.listSubjects(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function createSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.createSubject(schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.updateSubject(schoolId, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await classService.deleteSubject(schoolId, req.params.id);
    return sendSuccess(res, { message: "Subject deleted" });
  } catch (err) {
    return next(err);
  }
}

export async function listClassSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await classService.listClassSubjects(schoolId, req.params.classId));
  } catch (err) {
    return next(err);
  }
}

export async function assignSubjectToClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await classService.assignSubjectToClass(schoolId, req.params.classId, req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function removeSubjectFromClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await classService.removeSubjectFromClass(schoolId, req.params.classId, req.params.subjectId);
    return sendSuccess(res, { message: "Subject removed from class" });
  } catch (err) {
    return next(err);
  }
}
