import { Request, Response, NextFunction } from "express";
import * as syllabusService from "../services/syllabus.service";
import { supabaseAdmin } from "../config/supabase";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { ApiError } from "../utils/ApiError";
import { assertTeacherOwnsClassSubject, isStaff } from "../utils/teacherAccess";

function creatorRole(req: Request): "admin" | "principal" | "teacher" {
  if (req.user!.roles.includes("principal")) return "principal";
  if (req.user!.roles.includes("teacher")) return "teacher";
  return "admin";
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { academic_year, class_id, subject_id, search, is_published } = req.query as Record<string, string | undefined>;
    const teacherId = !isStaff(req.user!.roles) && req.user!.roles.includes("teacher") ? req.user!.id : undefined;
    return sendSuccess(
      res,
      await syllabusService.listSyllabus(schoolId, {
        academic_year,
        class_id,
        subject_id,
        search,
        is_published: is_published as "true" | "false" | undefined,
        teacherId,
      })
    );
  } catch (err) {
    return next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await syllabusService.getSyllabus(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    if (!isStaff(req.user!.roles)) {
      await assertTeacherOwnsClassSubject(req, req.body.class_id, req.body.subject_id);
    }
    const result = await syllabusService.createSyllabus(schoolId, req.user!.id, creatorRole(req), req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    if (!isStaff(req.user!.roles)) {
      const existing = await syllabusService.getSyllabusOwnership(schoolId, req.params.id);
      if (!existing) throw ApiError.notFound("Syllabus entry not found");
      await assertTeacherOwnsClassSubject(req, existing.class_id, existing.subject_id);
    }
    return sendSuccess(res, await syllabusService.updateSyllabus(schoolId, req.params.id, req.user!.id, req.body));
  } catch (err) {
    return next(err);
  }
}

/** Delete stays staff-only (admin/principal) — Teacher's capability list never includes Delete, only Upload/Edit/Replace/Preview/Download. Route-level requirePermission already enforces this; this check is defense-in-depth. */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await syllabusService.deleteSyllabus(schoolId, req.params.id);
    return sendSuccess(res, { message: "Deleted" });
  } catch (err) {
    return next(err);
  }
}

/** GET /syllabus/my-class — student portal read, scoped to their own class_id, published-only. */
export async function listForOwnClass(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    let classIds: string[] = [];

    if (req.user!.roles.includes("student")) {
      const { data, error } = await supabaseAdmin.from("students").select("class_id").eq("id", req.user!.id).eq("school_id", schoolId).maybeSingle();
      if (error) throw ApiError.internal(error.message);
      if (data?.class_id) classIds = [data.class_id as string];
    }

    return sendSuccess(res, await syllabusService.listPublishedForClasses(schoolId, classIds));
  } catch (err) {
    return next(err);
  }
}
