import { Request, Response, NextFunction } from "express";
import * as teacherPortalService from "../services/teacherPortal.service";
import * as examService from "../services/exam.service";
import * as leaveRequestService from "../services/leaveRequest.service";
import * as timetableService from "../services/timetable.service";
import * as aiService from "../services/ai.service";
import * as teacherAttendanceService from "../services/teacherAttendance.service";
import * as teacherService from "../services/teacher.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertTeacherOwnsClass, assertTeacherOwnsClassSubject, assertTeacherOwnsStudent } from "../utils/teacherAccess";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.getDashboard(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

/** GET /teacher-portal/my-assignments — this teacher's own class+subject slots, for pickers that must be restricted to what they're actually assigned to teach (e.g. the Syllabus upload form). */
export async function listMyAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherService.listTeacherAssignments(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function listStudentsForClass(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsClass(req, req.params.classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.listStudentsForClass(schoolId, req.params.classId));
  } catch (err) {
    return next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.getProfile(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.updateProfile(schoolId, req.user!.id, req.body));
  } catch (err) {
    return next(err);
  }
}

/**
 * Class-teacher browsing their own class needs only `classId`; a
 * subject-teacher must also name the `subjectId` they teach in that class —
 * this is what actually distinguishes "my whole homeroom" from "students I
 * teach a specific subject to" at the access-control layer, since both paths
 * return the same enriched roster shape once ownership is confirmed.
 */
export async function listMyStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId, subjectId } = req.query as { classId: string; subjectId?: string };
    if (subjectId) {
      await assertTeacherOwnsClassSubject(req, classId, subjectId);
    } else {
      await assertTeacherOwnsClass(req, classId);
    }
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.listMyStudents(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function getStudentDetail(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsStudent(req, req.params.studentId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.getStudentDetail(schoolId, req.params.studentId));
  } catch (err) {
    return next(err);
  }
}

export async function getTodayTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherPortalService.getTodayTimetable(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function getWeeklyTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await timetableService.getWeeklyForTeacher(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function createAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    await assertTeacherOwnsClassSubject(req, req.body.class_id, req.body.subject_id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.createAssessment(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function listMyAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await examService.listAssessmentsCreatedByTeacher(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

/** Rule-based homework formatter (see ai.service.ts) — no ownership check needed, it doesn't touch any stored data. */
export async function enhanceHomework(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, description, due_date } = req.body as { title: string; description: string; due_date?: string };
    return sendSuccess(res, { enhanced: aiService.enhanceHomeworkDescription({ title, description, dueDate: due_date }) });
  } catch (err) {
    return next(err);
  }
}

export async function getLeaveSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await leaveRequestService.getLeaveSummary(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function listMyLeaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await leaveRequestService.listForTeacher(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function applyForLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await leaveRequestService.applyForLeave(schoolId, req.user!.id, "teacher", req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function getTodayAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherAttendanceService.getTodayStatus(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherAttendanceService.checkIn(schoolId, req.user!.id), 201);
  } catch (err) {
    return next(err);
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await teacherAttendanceService.checkOut(schoolId, req.user!.id));
  } catch (err) {
    return next(err);
  }
}
