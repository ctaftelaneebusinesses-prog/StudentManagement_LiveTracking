import { z } from "zod";

export const createSuggestionSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
    period_id: z.string().uuid().optional(),
    day_of_week: z.coerce.number().int().min(0).max(6),
    period_no: z.coerce.number().int().min(1),
    proposed_change: z.object({
      subject_id: z.string().uuid().optional(),
      room_number: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
    }),
    reason: z.string().min(5).max(1000),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const reviewSuggestionSchema = z.object({
  body: z.object({ status: z.enum(["approved", "rejected"]) }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
