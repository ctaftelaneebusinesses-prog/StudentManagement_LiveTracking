import { z } from "zod";

export const listHomeworkSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid() }),
  params: z.object({}).optional(),
});

export const createHomeworkSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
    subject_id: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    due_date: z.string().date(),
    attachment_url: z.string().url().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateHomeworkSchema = z.object({
  body: z.object({
    subject_id: z.string().uuid().optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    due_date: z.string().date().optional(),
    attachment_url: z.string().url().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const homeworkIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
