import { z } from "zod";
import { EDITABLE_FIELDS } from "../services/studentProfileChangeRequest.service";

const changeEntry = z.object({ from: z.any(), to: z.any() });

export const submitChangeRequestSchema = z.object({
  body: z.object({
    changes: z.record(z.enum(EDITABLE_FIELDS), changeEntry).refine((v) => Object.keys(v).length > 0, {
      message: "At least one field change is required",
    }),
    reason: z.string().min(5).max(1000).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listStudentProfileChangeRequestsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listClassTeacherProfileChangeQueueSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  }),
  params: z.object({}).optional(),
});

export const reviewProfileChangeRequestSchema = z.object({
  body: z.object({
    status: z.enum(["approved", "rejected"]),
    reviewer_notes: z.string().max(1000).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
