import { Request, Response, NextFunction } from "express";
import * as questionService from "../services/websiteKnowledgeQuestion.service";
import { sendSuccess } from "../utils/ApiResponse";

export async function listQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { role_name, category, is_active, search } = req.query as Record<string, string | undefined>;
    return sendSuccess(res, await questionService.listQuestions({ role_name, category, is_active, search }));
  } catch (err) {
    return next(err);
  }
}

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.createQuestion(req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.updateQuestion(req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    await questionService.deleteQuestion(req.params.id);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
}

export async function listQuestionSets(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.listQuestionSets(req.query.role_name as string | undefined));
  } catch (err) {
    return next(err);
  }
}

export async function createQuestionSet(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.createQuestionSet(req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateQuestionSet(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.updateQuestionSet(req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteQuestionSet(req: Request, res: Response, next: NextFunction) {
  try {
    await questionService.deleteQuestionSet(req.params.id);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
}

export async function getQuestionSetItems(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.getQuestionSetItems(req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function addQuestionToSet(req: Request, res: Response, next: NextFunction) {
  try {
    await questionService.addQuestionToSet(req.params.id, req.body.question_id, req.body.order_index);
    return sendSuccess(res, { added: true }, 201);
  } catch (err) {
    return next(err);
  }
}

export async function removeQuestionFromSet(req: Request, res: Response, next: NextFunction) {
  try {
    await questionService.removeQuestionFromSet(req.params.id, req.params.questionId);
    return sendSuccess(res, { removed: true });
  } catch (err) {
    return next(err);
  }
}

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.getSettings());
  } catch (err) {
    return next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await questionService.updateSettings(req.user!.id, req.body));
  } catch (err) {
    return next(err);
  }
}
