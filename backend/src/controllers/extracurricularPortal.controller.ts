import { Request, Response, NextFunction } from "express";
import * as extracurricularPortalService from "../services/extracurricularPortal.service";
import * as timetableService from "../services/timetable.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

/** This staff member's full weekly timetable — every extracurricular period they've been assigned as instructor, across every class. Same call the Teacher Portal's "My Timetable" makes (`teacherPortal.controller.ts::getWeeklyTimetable`), since `timetable_periods.teacher_id` is reused as-is for the instructor. */
export async function getWeeklyTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await timetableService.getWeeklyForTeacher(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await extracurricularPortalService.getDashboard(req.user!.id, schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await extracurricularPortalService.getProfile(req.user!.id, schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await extracurricularPortalService.updateProfile(req.user!.id, schoolId, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function getMyActivities(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await extracurricularPortalService.getMyActivities(req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function markActivityCompleted(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await extracurricularPortalService.markActivityCompleted(req.user!.id, schoolId, req.params.activityId)
    );
  } catch (err) {
    return next(err);
  }
}

export async function getMyBatches(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await extracurricularPortalService.getMyBatches(req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function getBatchStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await extracurricularPortalService.getBatchStudents(req.user!.id, req.params.batchId, schoolId)
    );
  } catch (err) {
    return next(err);
  }
}

export async function getTodaySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await extracurricularPortalService.getTodaySchedule(req.user!.id, schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getWeeklySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await extracurricularPortalService.getWeeklySchedule(req.user!.id, schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function markAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await extracurricularPortalService.markAttendance(req.user!.id, schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function getAttendanceSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { batch_id } = req.query as { batch_id?: string };
    return sendSuccess(
      res,
      await extracurricularPortalService.getAttendanceSummary(req.user!.id, schoolId, batch_id)
    );
  } catch (err) {
    return next(err);
  }
}

export async function listPracticeWork(req: Request, res: Response, next: NextFunction) {
  try {
    const { batch_id } = req.query as { batch_id?: string };
    return sendSuccess(res, await extracurricularPortalService.listPracticeWork(req.user!.id, batch_id));
  } catch (err) {
    return next(err);
  }
}

export async function addPracticeWork(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await extracurricularPortalService.addPracticeWork(req.user!.id, schoolId, req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await extracurricularPortalService.listEvents(req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await extracurricularPortalService.createEvent(req.user!.id, schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listAchievements(req: Request, res: Response, next: NextFunction) {
  try {
    return sendSuccess(res, await extracurricularPortalService.listAchievements(req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function addAchievement(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await extracurricularPortalService.addAchievement(req.user!.id, schoolId, req.body),
      201
    );
  } catch (err) {
    return next(err);
  }
}
