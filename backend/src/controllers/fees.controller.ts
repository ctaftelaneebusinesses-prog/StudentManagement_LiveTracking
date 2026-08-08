import { Request, Response, NextFunction } from "express";
import * as feesService from "../services/fees.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";
import { assertStudentFeeAccess } from "../utils/studentAccess";

export async function listClassesForFees(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.listClassesForFees(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function listFeeStructures(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { classId } = req.query as { classId?: string };
    return sendSuccess(res, await feesService.listFeeStructures(schoolId, classId));
  } catch (err) {
    return next(err);
  }
}

export async function createFeeStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.createFeeStructure(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateFeeStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.updateFeeStructure(schoolId, req.user!.id, req.params.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteFeeStructure(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await feesService.deleteFeeStructure(schoolId, req.user!.id, req.params.id);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
}

export async function getFeeSummaryForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentFeeAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.getFeeSummary(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function listPaymentsForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    await assertStudentFeeAccess(req, req.params.id);
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.listPayments(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function recordPaymentForStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.recordPayment(schoolId, req.params.id, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function upsertStudentFeeOverride(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await feesService.upsertStudentFeeOverride(schoolId, req.user!.id, req.params.id, req.params.feeStructureId, req.body)
    );
  } catch (err) {
    return next(err);
  }
}

export async function deleteStudentFeeOverride(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await feesService.deleteStudentFeeOverride(schoolId, req.user!.id, req.params.id, req.params.feeStructureId);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.getDashboardStats(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.getAnalytics(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function listStudentFeeDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search, classId, status, page, pageSize } = req.query as unknown as {
      search?: string;
      classId?: string;
      status?: "all" | "paid" | "partial" | "unpaid";
      page: number;
      pageSize: number;
    };
    return sendSuccess(res, await feesService.listStudentFeeDetails(schoolId, { search, classId, status, page, pageSize }));
  } catch (err) {
    return next(err);
  }
}

export async function listPaymentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search, classId, method, dateFrom, dateTo, page, pageSize } = req.query as unknown as {
      search?: string;
      classId?: string;
      method?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      pageSize: number;
    };
    return sendSuccess(
      res,
      await feesService.listPaymentHistory(schoolId, { search, classId, method, dateFrom, dateTo, page, pageSize })
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * fees.view is held broadly (including by every parent/student, for their
 * own /students/:id/fees/summary), but this endpoint takes a bare paymentId
 * with no student in the URL to scope it — without this check, any account
 * with fees.view could fetch any OTHER student's receipt just by guessing a
 * payment uuid. assertStudentFeeAccess's fees.view+school branch covers
 * staff (accountant/admin/principal); everyone else must own the receipt's
 * student.
 */
export async function getReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const receipt = await feesService.getReceipt(schoolId, req.params.paymentId);
    await assertStudentFeeAccess(req, receipt.studentId);
    return sendSuccess(res, receipt);
  } catch (err) {
    return next(err);
  }
}

export async function getRecentActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.getRecentActivity(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function getCollectionReport(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { period, dateFrom, dateTo } = req.query as unknown as {
      period: "daily" | "weekly" | "monthly" | "yearly";
      dateFrom?: string;
      dateTo?: string;
    };
    return sendSuccess(res, await feesService.getCollectionReport(schoolId, { period, dateFrom, dateTo }));
  } catch (err) {
    return next(err);
  }
}

export async function getClassWiseCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.getClassWiseCollection(schoolId));
  } catch (err) {
    return next(err);
  }
}

export async function bulkAssignFees(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.bulkAssignFees(schoolId, req.user!.id, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function bulkUpdateFees(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.bulkUpdateFees(schoolId, req.user!.id, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function bulkRemoveFees(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await feesService.bulkRemoveFees(schoolId, req.user!.id, req.body));
  } catch (err) {
    return next(err);
  }
}
