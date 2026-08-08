import { Request, Response, NextFunction } from "express";
import * as achievementService from "../services/extracurricularAchievement.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listAchievements(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { studentId } = req.query as unknown as { studentId?: string };
    return sendSuccess(res, await achievementService.listAchievements(schoolId, req.params.id, { studentId }));
  } catch (err) {
    return next(err);
  }
}

export async function addAchievement(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await achievementService.addAchievement(schoolId, req.params.id, req.user!.id, req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function deleteAchievement(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await achievementService.deleteAchievement(schoolId, req.params.id, req.params.achievementId);
    return sendSuccess(res, { message: "Achievement deleted" });
  } catch (err) {
    return next(err);
  }
}
