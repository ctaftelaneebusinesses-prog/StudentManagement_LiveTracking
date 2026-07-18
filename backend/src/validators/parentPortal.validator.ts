import { z } from "zod";

const studentParams = z.object({ studentId: z.string().uuid() });

export const parentStudentParamsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: studentParams,
});

export const createLeaveRequestSchema = z.object({
  body: z
    .object({
      student_id: z.string().uuid(),
      start_date: z.string().date(),
      end_date: z.string().date(),
      reason: z.string().trim().min(5).max(1000),
    })
    .refine((value) => value.end_date >= value.start_date, {
      message: "End date must be on or after start date",
      path: ["end_date"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
