import { z } from "zod";

export const listTimetableSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid() }),
  params: z.object({}).optional(),
});

export const upsertPeriodSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
    day_of_week: z.coerce.number().int().min(0).max(6),
    period_no: z.coerce.number().int().positive(),
    subject_id: z.string().uuid().optional(),
    teacher_id: z.string().uuid().optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:mm time"),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:mm time"),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const periodIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
