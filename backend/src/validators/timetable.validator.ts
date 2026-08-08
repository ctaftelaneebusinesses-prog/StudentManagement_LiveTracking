import { z } from "zod";

export const listTimetableSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid() }),
  params: z.object({}).optional(),
});

export const upsertPeriodSchema = z.object({
  body: z
    .object({
      class_id: z.string().uuid(),
      day_of_week: z.coerce.number().int().min(0).max(6),
      period_no: z.coerce.number().int().positive(),
      subject_id: z.string().uuid().optional(),
      teacher_id: z.string().uuid().optional(),
      room_number: z.string().max(50).optional(),
      start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:mm time"),
      end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:mm time"),
      period_type: z.enum(["academic", "extracurricular"]).default("academic"),
      activity_id: z.string().uuid().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.period_type === "extracurricular") {
        if (!data.activity_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["activity_id"],
            message: "activity_id is required when period_type is 'extracurricular'",
          });
        }
        if (data.subject_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["subject_id"],
            message: "subject_id is not applicable when period_type is 'extracurricular'",
          });
        }
      } else if (data.activity_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activity_id"],
          message: "activity_id is not applicable when period_type is 'academic'",
        });
      }
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const periodIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
