import { z } from "zod";

export const classIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ classId: z.string().uuid() }),
});
