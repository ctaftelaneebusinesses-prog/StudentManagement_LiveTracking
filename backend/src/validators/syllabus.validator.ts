import { z } from "zod";

const empty = z.object({}).optional();

export const listSyllabusQuerySchema = z.object({
  body: empty,
  query: z.object({
    academic_year: z.string().optional(),
    class_id: z.string().uuid().optional(),
    subject_id: z.string().uuid().optional(),
    search: z.string().optional(),
    is_published: z.enum(["true", "false"]).optional(),
  }),
  params: empty,
});

export const syllabusIdParamSchema = z.object({
  body: empty,
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});

export const createSyllabusSchema = z.object({
  body: z.object({
    academic_year: z.string().min(4),
    class_id: z.string().uuid(),
    subject_id: z.string().uuid(),
    title: z.string().min(2),
    description: z.string().optional(),
    storage_path: z.string().min(1),
    file_name: z.string().min(1),
    is_published: z.boolean().optional(),
  }),
  query: empty,
  params: empty,
});

export const updateSyllabusSchema = z.object({
  body: z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    storage_path: z.string().min(1).optional(),
    file_name: z.string().min(1).optional(),
    is_published: z.boolean().optional(),
  }),
  query: empty,
  params: z.object({ id: z.string().uuid() }),
});
