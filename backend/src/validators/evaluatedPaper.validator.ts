import { z } from "zod";

export const addEvaluatedPaperSchema = z.object({
  body: z.object({
    exam_id: z.string().uuid(),
    subject_id: z.string().uuid(),
    file_name: z.string().min(1),
    storage_path: z.string().min(1),
    notes: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listEvaluatedPapersSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const deleteEvaluatedPaperSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), paperId: z.string().uuid() }),
});
