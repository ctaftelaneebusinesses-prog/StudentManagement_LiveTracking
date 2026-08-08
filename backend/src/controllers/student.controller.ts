import { Request, Response, NextFunction } from "express";
import * as studentService from "../services/student.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { logActivity } from "../services/auditLog.service";

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
    const student = await studentService.createStudent(schoolId, req.body);
    const studentId = (student as unknown as { id: string }).id;
    void logActivity(schoolId, req.user?.id ?? null, "student.created", { targetType: "student", targetId: studentId });
    return sendSuccess(res, student, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const student = await studentService.updateStudent(schoolId, req.params.id, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "student.updated", { targetType: "student", targetId: req.params.id });
    return sendSuccess(res, student);
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
    const student = await studentService.deactivateStudent(schoolId, req.params.id);
    void logActivity(schoolId, req.user?.id ?? null, "student.deactivated", { targetType: "student", targetId: req.params.id });
    return sendSuccess(res, student);
  } catch (err) {
    return next(err);
  }
}

export async function activateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const student = await studentService.activateStudent(schoolId, req.params.id);
    void logActivity(schoolId, req.user?.id ?? null, "student.activated", { targetType: "student", targetId: req.params.id });
    return sendSuccess(res, student);
  } catch (err) {
    return next(err);
  }
}

export async function permanentlyDeleteStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await studentService.permanentlyDeleteStudent(schoolId, req.params.id);
    void logActivity(schoolId, req.user?.id ?? null, "student.deleted", { targetType: "student", targetId: req.params.id });
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
}

export async function bulkDeleteStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const result = await studentService.bulkDeleteStudents(schoolId, req.body.studentIds);
    void logActivity(schoolId, req.user?.id ?? null, "student.bulk_deleted", { targetType: "student" });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function bulkCreateStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentService.bulkCreateStudents(schoolId, req.body.students), 201);
  } catch (err) {
    return next(err);
  }
}

export async function bulkAssignClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await studentService.bulkAssignClass(schoolId, req.body.studentIds, req.body.classId)
    );
  } catch (err) {
    return next(err);
  }
}
