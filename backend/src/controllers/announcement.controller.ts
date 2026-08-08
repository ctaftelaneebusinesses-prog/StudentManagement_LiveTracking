import { Request, Response, NextFunction } from "express";
import * as announcementService from "../services/announcement.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertMayTargetRestrictedAudience } from "../utils/announcementAccess";

export async function listAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search, page, pageSize } = req.query as unknown as { search?: string; page: number; pageSize: number };
    return sendSuccess(res, await announcementService.listAnnouncements(schoolId, { search, page, pageSize }));
  } catch (err) {
    return next(err);
  }
}

export async function getAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await announcementService.getAnnouncement(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    assertMayTargetRestrictedAudience(req, req.body.audience_type);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await announcementService.createAnnouncement(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body.audience_type !== undefined) assertMayTargetRestrictedAudience(req, req.body.audience_type);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await announcementService.updateAnnouncement(schoolId, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await announcementService.deleteAnnouncement(schoolId, req.params.id);
    return sendSuccess(res, { message: "Announcement deleted" });
  } catch (err) {
    return next(err);
  }
}
