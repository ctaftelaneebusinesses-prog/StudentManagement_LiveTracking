import { Request, Response, NextFunction } from "express";
import * as homeworkService from "../services/homework.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import {
  assertTeacherOwnsClass,
  assertTeacherOwnsClassSubject,
  assertOwnHomeworkOrStaff,
  assertIsClassTeacher,
} from "../utils/teacherAccess";
import { ApiError } from "../utils/ApiError";
import { supabaseAdmin } from "../config/supabase";

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
    return sendSuccess(res, await homeworkService.updateHomework(schoolId, req.params.id, req.user!.id, req.body));
  } catch (err) {
    return next(err);
  }
}

/** Resolves a homework row's class_id, throwing 404 if it doesn't exist in this school — shared by the review/approve/request-changes endpoints. */
async function resolveHomeworkClassId(schoolId: string, homeworkId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("homework")
    .select("class_id")
    .eq("id", homeworkId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Homework not found");
  return data.class_id;
}

/** Class Teacher's review queue — every homework item (any status) for one of their homeroom classes. */
export async function listForReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.query as { classId: string };
    await assertIsClassTeacher(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await homeworkService.listForReview(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function approveHomework(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const classId = await resolveHomeworkClassId(schoolId, req.params.id);
    await assertIsClassTeacher(req, classId);
    return sendSuccess(res, await homeworkService.approveHomework(schoolId, req.params.id, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function requestChanges(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const classId = await resolveHomeworkClassId(schoolId, req.params.id);
    await assertIsClassTeacher(req, classId);
    return sendSuccess(
      res,
      await homeworkService.requestChanges(schoolId, req.params.id, req.user!.id, req.body.note)
    );
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

export async function listAllForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await homeworkService.listAllForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

/** Students submit only for themselves — enforced by the homework.submit permission (student role only). */
export async function submitHomework(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const studentId = req.user!.id;
    return sendSuccess(res, await homeworkService.submitHomework(schoolId, studentId, req.params.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listSubmissionsForHomework(req: Request, res: Response, next: NextFunction) {
  try {
    await assertOwnHomeworkOrStaff(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await homeworkService.listSubmissionsForHomework(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}
