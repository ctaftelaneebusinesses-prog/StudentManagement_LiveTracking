import { Request, Response, NextFunction } from "express";
import * as studentDocumentService from "../services/studentDocument.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await studentDocumentService.listDocuments(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function addDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await studentDocumentService.addDocument(schoolId, req.params.id, req.user!.id, req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await studentDocumentService.deleteDocument(schoolId, req.params.id, req.params.docId);
    return sendSuccess(res, { message: "Document deleted" });
  } catch (err) {
    return next(err);
  }
}
