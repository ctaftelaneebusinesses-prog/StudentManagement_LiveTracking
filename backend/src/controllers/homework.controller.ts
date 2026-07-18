import { Request, Response, NextFunction } from "express";
import * as homeworkService from "../services/homework.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { assertTeacherOwnsClass, assertTeacherOwnsClassSubject, assertOwnHomeworkOrStaff } from "../utils/teacherAccess";

export async function listForClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.query as { classId: string };
    await assertTeacherOwnsClass(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await homeworkService.listForClass(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function createHomework(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsClass(req, req.body.class_id);
    if (req.body.subject_id) {
      await assertTeacherOwnsClassSubject(req, req.body.class_id, req.body.subject_id);
    }
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await homeworkService.createHomework(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateHomework(req: Request, res: Response, next: NextFunction) {
  try {
    await assertOwnHomeworkOrStaff(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await homeworkService.updateHomework(schoolId, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteHomework(req: Request, res: Response, next: NextFunction) {
  try {
    await assertOwnHomeworkOrStaff(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    await homeworkService.deleteHomework(schoolId, req.params.id);
    return sendSuccess(res, { message: "Homework deleted" });
  } catch (err) {
    return next(err);
  }
}

export async function listUpcomingForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await homeworkService.listUpcomingForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}
