import { Request, Response, NextFunction } from "express";
import * as reportsService from "../services/reports.service";
import * as reportsHubService from "../services/reportsHub.service";
import * as adminDashboardOverviewService from "../services/adminDashboardOverview.service";
import * as feesService from "../services/fees.service";
import * as trackingService from "../services/tracking.service";
import * as transportService from "../services/transport.service";
import * as examService from "../services/exam.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentAccess } from "../utils/studentAccess";
import { assertTeacherOwnsClass } from "../utils/teacherAccess";

export async function getAdminOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await reportsService.getAdminOverview(schoolId));
  } catch (err) {
    return next(err);
  }
}

/** The full stat-tile/chart/activity payload behind the premium Admin Dashboard home page. */
export async function getDashboardOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await adminDashboardOverviewService.getDashboardOverview(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getSchoolAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await reportsService.getSchoolAnalytics(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getClassPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.query as { classId: string };
    await assertTeacherOwnsClass(req, classId);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await reportsService.getClassPerformance(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function getStudentProgress(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await reportsService.getStudentProgress(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

// ----------------------------------------------------------------------------
// Reports console (Attendance/Student/Teacher/Fee/Transport/Exam tabs) —
// each handler reuses the relevant module's existing service, aggregating
// only where a merge is genuinely needed (see reportsHub.service.ts).
// ----------------------------------------------------------------------------

export async function getAttendanceReport(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { classId, from, to } = req.query as { classId?: string; from?: string; to?: string };
    return sendSuccess(res, await reportsHubService.getAttendanceReport(schoolId, { classId, from, to }));
  } catch (err) {
    return next(err);
  }
}

export async function getStudentReport(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { classId, search, page, pageSize } = req.query as unknown as {
      classId?: string;
      search?: string;
      page: number;
      pageSize: number;
    };
    return sendSuccess(res, await reportsHubService.getStudentReport(schoolId, { classId, search, page, pageSize }));
  } catch (err) {
    return next(err);
  }
}

export async function getTeacherReport(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search, page, pageSize } = req.query as unknown as { search?: string; page: number; pageSize: number };
    return sendSuccess(res, await reportsHubService.getTeacherReport(schoolId, { search, page, pageSize }));
  } catch (err) {
    return next(err);
  }
}

export async function getFeeReport(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const [stats, analytics] = await Promise.all([feesService.getDashboardStats(schoolId), feesService.getAnalytics(schoolId)]);
    return sendSuccess(res, { stats, analytics });
  } catch (err) {
    return next(err);
  }
}

export async function getTransportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { vehicleId, dateFrom, dateTo, page, pageSize } = req.query as unknown as {
      vehicleId?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      pageSize: number;
    };
    const [vehicles, drivers, routes, tripHistory] = await Promise.all([
      transportService.listVehicles(schoolId),
      transportService.listDrivers(schoolId),
      transportService.listRoutes(schoolId),
      trackingService.listTripHistory(schoolId, { vehicleId, dateFrom, dateTo, page, pageSize }),
    ]);
    return sendSuccess(res, {
      vehicleCount: (vehicles ?? []).length,
      driverCount: (drivers ?? []).length,
      routeCount: (routes ?? []).length,
      tripHistory,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getExamReportSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const [summary, analytics] = await Promise.all([
      reportsHubService.getExamReportSummary(schoolId),
      examService.getPerformanceAnalytics(schoolId),
    ]);
    return sendSuccess(res, { ...summary, analytics });
  } catch (err) {
    return next(err);
  }
}
