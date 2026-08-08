import { z } from "zod";

export const applyStudentLeaveSchema = z.object({
  body: z
    .object({
      start_date: z.string().date(),
      end_date: z.string().date(),
      reason: z.string().min(5).max(1000),
    })
    .refine((v) => v.end_date >= v.start_date, {
      message: "end_date must be on or after start_date",
      path: ["end_date"],
    }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listStudentLeaveSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listClassTeacherLeaveQueueSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  }),
  params: z.object({}).optional(),
});

export const reviewStudentLeaveSchema = z.object({
  body: z.object({ status: z.enum(["approved", "rejected"]) }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
