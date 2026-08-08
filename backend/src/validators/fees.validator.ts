import { z } from "zod";
import { optionalDate } from "./common";

export const studentIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listFeeStructuresSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid().optional() }),
  params: z.object({}).optional(),
});

export const createFeeStructureSchema = z.object({
  body: z
    .object({
      class_id: z.string().uuid().optional(),
      student_id: z.string().uuid().optional(),
      academic_year_id: z.string().uuid().optional(),
      term: z.string().min(1),
      amount: z.coerce.number().min(0),
      due_date: optionalDate,
      discount_amount: z.coerce.number().min(0).optional(),
      scholarship_amount: z.coerce.number().min(0).optional(),
    })
    .refine((v) => !!v.class_id || !!v.student_id, {
      message: "Either class_id or student_id is required",
      path: ["class_id"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const feeStructureIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const updateFeeStructureSchema = z.object({
  body: z.object({
    class_id: z.string().uuid().optional(),
    student_id: z.string().uuid().optional(),
    academic_year_id: z.string().uuid().optional(),
    term: z.string().min(1).optional(),
    amount: z.coerce.number().min(0).optional(),
    due_date: optionalDate,
    discount_amount: z.coerce.number().min(0).optional(),
    scholarship_amount: z.coerce.number().min(0).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const recordPaymentSchema = z.object({
  body: z.object({
    fee_structure_id: z.string().uuid().optional(),
    amount: z.coerce.number().positive(),
    payment_date: z.string().date().optional(),
    payment_method: z.enum(["cash", "card", "bank_transfer", "online", "cheque", "other"]).optional(),
    reference_no: z.string().optional(),
    notes: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const upsertStudentFeeOverrideSchema = z.object({
  body: z.object({
    override_amount: z.coerce.number().min(0),
    reason: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), feeStructureId: z.string().uuid() }),
});

export const studentFeeOverrideParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), feeStructureId: z.string().uuid() }),
});

export const feeDashboardQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ school_id: z.string().uuid().optional() }),
  params: z.object({}).optional(),
});

export const feeAnalyticsQuerySchema = feeDashboardQuerySchema;

export const listStudentFeeDetailsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    school_id: z.string().uuid().optional(),
    search: z.string().optional(),
    classId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    status: z.enum(["all", "paid", "partial", "unpaid"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(20),
  }),
  params: z.object({}).optional(),
});

export const listPaymentHistorySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    school_id: z.string().uuid().optional(),
    search: z.string().optional(),
    classId: z.string().uuid().optional(),
    method: z.enum(["cash", "card", "bank_transfer", "online", "cheque", "other"]).optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(20),
  }),
  params: z.object({}).optional(),
});

export const receiptParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ paymentId: z.string().uuid() }),
});

export const recentActivitySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ school_id: z.string().uuid().optional() }),
  params: z.object({}).optional(),
});

export const collectionReportSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    school_id: z.string().uuid().optional(),
    period: z.enum(["daily", "weekly", "monthly", "yearly"]),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  }),
  params: z.object({}).optional(),
});

export const classWiseCollectionSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ school_id: z.string().uuid().optional() }),
  params: z.object({}).optional(),
});

const bulkTargetShape = {
  scope: z.enum(["school", "class", "student"]),
  classIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  academicYearId: z.string().uuid().optional(),
};

export const bulkAssignFeesSchema = z.object({
  body: z
    .object({
      ...bulkTargetShape,
      term: z.string().min(1),
      amount: z.coerce.number().min(0),
      due_date: optionalDate,
      discount_amount: z.coerce.number().min(0).optional(),
      scholarship_amount: z.coerce.number().min(0).optional(),
    })
    .refine((v) => v.scope !== "class" || (v.classIds && v.classIds.length > 0), {
      message: "classIds is required when scope is 'class'",
      path: ["classIds"],
    })
    .refine((v) => v.scope !== "student" || (v.studentIds && v.studentIds.length > 0), {
      message: "studentIds is required when scope is 'student'",
      path: ["studentIds"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const bulkUpdateFeesSchema = z.object({
  body: z.object({
    classIds: z.array(z.string().uuid()).optional(),
    studentIds: z.array(z.string().uuid()).optional(),
    academicYearId: z.string().uuid().optional(),
    term: z.string().min(1).optional(),
    patch: z.object({
      amount: z.coerce.number().min(0).optional(),
      due_date: optionalDate,
      discount_amount: z.coerce.number().min(0).optional(),
      scholarship_amount: z.coerce.number().min(0).optional(),
    }),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const bulkRemoveFeesSchema = z.object({
  body: z.object({
    classIds: z.array(z.string().uuid()).optional(),
    studentIds: z.array(z.string().uuid()).optional(),
    academicYearId: z.string().uuid().optional(),
    term: z.string().min(1).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
