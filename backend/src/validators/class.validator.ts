import { z } from "zod";

export const createClassSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    section: z.string().min(1),
    academic_year_id: z.string().uuid(),
    branch_id: z.string().uuid().optional(),
    class_teacher_id: z.string().uuid().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateClassSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    section: z.string().min(1).optional(),
    branch_id: z.string().uuid().nullable().optional(),
    class_teacher_id: z.string().uuid().nullable().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().min(1).max(20),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).max(20).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const assignSubjectToClassSchema = z.object({
  body: z.object({
    subject_id: z.string().uuid(),
    teacher_id: z.string().uuid().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ classId: z.string().uuid() }),
});
