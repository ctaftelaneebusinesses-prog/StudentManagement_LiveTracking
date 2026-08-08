import { Request, Response, NextFunction } from "express";
import * as learningGamesService from "../services/learningGames.service";
import { sendSuccess } from "../utils/ApiResponse";

export async function getCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await learningGamesService.getCatalog());
  } catch (err) {
    return next(err);
  }
}

export async function submitAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await learningGamesService.submitGameAttempt(req.user!.id, req.user!.schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await learningGamesService.getProfile(req.user!.id));
  } catch (err) {
    return next(err);
  }
}
