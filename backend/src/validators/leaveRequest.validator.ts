import { z } from "zod";

export const listLeaveRequestsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    teacherId: z.string().uuid().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    applicantRole: z.enum(["teacher", "principal"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});

export const listLeaveRequestsForTeacherSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createLeaveRequestSchema = z.object({
  body: z
    .object({
      teacher_id: z.string().uuid(),
      leave_type: z.enum(["casual", "sick", "other"]).optional(),
      start_date: z.string().date(),
      end_date: z.string().date(),
      reason: z.string().optional(),
    })
    .refine((data) => data.end_date >= data.start_date, {
      message: "end_date must be on or after start_date",
      path: ["end_date"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const reviewLeaveRequestSchema = z.object({
  body: z.object({
    status: z.enum(["approved", "rejected"]),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const applySelfLeaveSchema = z.object({
  body: z
    .object({
      leave_type: z.enum(["casual", "sick", "other"]),
      start_date: z.string().date(),
      end_date: z.string().date(),
      reason: z.string().optional(),
    })
    .refine((v) => v.end_date >= v.start_date, {
      message: "end_date must be on or after start_date",
      path: ["end_date"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const deleteLeaveRequestSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
