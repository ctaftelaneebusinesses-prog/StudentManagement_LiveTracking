import { Request, Response, NextFunction } from "express";
import * as teacherDocumentService from "../services/teacherDocument.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherDocumentService.listDocuments(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function addDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await teacherDocumentService.addDocument(schoolId, req.params.id, req.user!.id, req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await teacherDocumentService.deleteDocument(schoolId, req.params.id, req.params.docId);
    return sendSuccess(res, { message: "Document deleted" });
  } catch (err) {
    return next(err);
  }
}
