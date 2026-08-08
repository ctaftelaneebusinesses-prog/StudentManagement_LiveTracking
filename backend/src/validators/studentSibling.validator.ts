import { z } from "zod";

export const searchSiblingCandidatesSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ search: z.string().optional() }),
  params: z.object({ id: z.string().uuid() }),
});

export const linkSiblingSchema = z.object({
  body: z.object({
    sibling_student_id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const unlinkSiblingSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid(), siblingId: z.string().uuid() }),
});
