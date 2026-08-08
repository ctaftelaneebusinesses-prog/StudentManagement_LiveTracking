import { Request, Response, NextFunction } from "express";
import * as staffService from "../services/extracurricularStaff.service";
import { logActivity } from "../services/auditLog.service";
import { sendSuccess } from "../utils/ApiResponse";
import { resolveSchoolId } from "../utils/tenant";

export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const { search, staff_type_activity_id, activity_id, status, class_id, page, pageSize } = req.query as unknown as {
      search?: string;
      staff_type_activity_id?: string;
      activity_id?: string;
      status?: "active" | "inactive";
      class_id?: string;
      page: number;
      pageSize: number;
    };
    return sendSuccess(
      res,
      await staffService.listStaff(schoolId, { search, staff_type_activity_id, activity_id, status, class_id, page, pageSize })
    );
  } catch (err) {
    return next(err);
  }
}

export async function getStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await staffService.getStaff(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const staff = await staffService.createStaff(schoolId, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "extracurricular_staff.created", {
      targetType: "extracurricular_staff",
      targetId: staff.id,
      metadata: { staffCode: staff.staff_code },
    });
    return sendSuccess(res, staff, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const staff = await staffService.updateStaff(schoolId, req.params.id, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "extracurricular_staff.updated", {
      targetType: "extracurricular_staff",
      targetId: req.params.id,
    });
    return sendSuccess(res, staff);
  } catch (err) {
    return next(err);
  }
}

export async function setStaffStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const staff = await staffService.deactivateStaff(schoolId, req.params.id, req.body.is_active);
    void logActivity(
      schoolId,
      req.user?.id ?? null,
      req.body.is_active ? "extracurricular_staff.activated" : "extracurricular_staff.deactivated",
      { targetType: "extracurricular_staff", targetId: req.params.id }
    );
    return sendSuccess(res, staff);
  } catch (err) {
    return next(err);
  }
}

export async function assignActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const activities = await staffService.assignActivities(schoolId, req.params.id, req.body.activity_ids, req.user!.id);
    void logActivity(schoolId, req.user?.id ?? null, "extracurricular_staff.activities_assigned", {
      targetType: "extracurricular_staff",
      targetId: req.params.id,
      metadata: { activity_ids: req.body.activity_ids },
    });
    return sendSuccess(res, activities);
  } catch (err) {
    return next(err);
  }
}

export async function listBatches(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await staffService.listBatches(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    const batch = await staffService.createBatch(schoolId, req.params.id, req.user!.id, req.body);
    void logActivity(schoolId, req.user?.id ?? null, "extracurricular_staff.batch_created", {
      targetType: "extracurricular_batch",
      targetId: batch.id,
    });
    return sendSuccess(res, batch, 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await staffService.updateBatch(schoolId, req.params.batchId, req.body));
  } catch (err) {
    return next(err);
  }
}

export async function deleteBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await staffService.deleteBatch(schoolId, req.params.batchId);
    return sendSuccess(res, { message: "Batch deleted" });
  } catch (err) {
    return next(err);
  }
}

export async function addBatchStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(
      res,
      await staffService.addBatchStudents(schoolId, req.params.batchId, req.body.student_ids),
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function removeBatchStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await staffService.removeBatchStudent(schoolId, req.params.batchId, req.params.studentId);
    return sendSuccess(res, { message: "Student removed from batch" });
  } catch (err) {
    return next(err);
  }
}

export async function listScheduleSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await staffService.listScheduleSlots(schoolId, req.params.id));
  } catch (err) {
    return next(err);
  }
}

export async function createScheduleSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await staffService.upsertScheduleSlot(schoolId, req.body), 201);
  } catch (err) {
    return next(err);
  }
}

export async function deleteScheduleSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    await staffService.deleteScheduleSlot(schoolId, req.params.slotId);
    return sendSuccess(res, { message: "Schedule slot deleted" });
  } catch (err) {
    return next(err);
  }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = resolveSchoolId(req);
    return sendSuccess(res, await staffService.getDashboardStats(schoolId));
  } catch (err) {
    return next(err);
  }
}
