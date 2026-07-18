import { Request, Response, NextFunction } from "express";
import * as parentService from "../services/parent.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function searchParents(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search } = req.query as { search?: string };
    return sendSuccess(res, await parentService.searchParents(schoolId, search));
  } catch (err) {
    return next(err);
  }
}

export async function listParentsForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await parentService.listParentsForStudent(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createAndLinkParent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await parentService.createAndLinkParent(schoolId, req.params.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function linkExistingParent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await parentService.linkExistingParent(schoolId, req.params.id, req.body.parent_id, req.body.relation),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function updateLinkedParent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await parentService.updateLinkedParent(schoolId, req.params.id, req.params.parentId, req.body)
    );
  } catch (err) {
    return next(err);
  }
}

export async function unlinkParent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await parentService.unlinkParent(schoolId, req.params.id, req.params.parentId));
  } catch (err) {
    return next(err);
  }
}
