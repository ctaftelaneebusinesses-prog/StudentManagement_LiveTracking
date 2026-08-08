import { Request, Response, NextFunction } from "express";
import * as attemptService from "../services/websiteKnowledgeAttempt.service";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { resolveQuizRole } from "../config/websiteKnowledge";

/** Every self-service endpoint below quizzes the caller "as" their own resolved role — never a role passed in the request. */
function requireOwnQuizRole(req: Request) {
  const role = resolveQuizRole(req.user!.roleName, req.user!.roles);
  if (!role) throw ApiError.forbidden("Your role does not take the Website Knowledge assessment");
  return role;
}

export async function startAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const role = requireOwnQuizRole(req);
    return sendSuccess(res, await attemptService.startAttempt(req.user!.schoolId, req.user!.id, role), 201);
  } catch (err) {
    return next(err);
  }
}

export async function submitAnswer(req: Request, res: Response, next: NextFunction) {
  try {
    const { question_id, selected_option } = req.body as { question_id: string; selected_option: string };
    return sendSuccess(res, await attemptService.submitAnswer(req.params.id, req.user!.id, question_id, selected_option));
  } catch (err) {
    return next(err);
  }
}

export async function completeAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await attemptService.completeAttempt(req.params.id, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function listMyAttempts(req: Request, res: Response, next: NextFunction) {
  try {
    const role = requireOwnQuizRole(req);
    return sendSuccess(res, await attemptService.listMyAttempts(req.user!.id, role));
  } catch (err) {
    return next(err);
  }
}

export async function getAttemptDetail(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await attemptService.getAttemptDetail(req.params.id, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function getMyCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const role = requireOwnQuizRole(req);
    return sendSuccess(res, await attemptService.getMyCertificate(req.user!.id, role));
  } catch (err) {
    return next(err);
  }
}
