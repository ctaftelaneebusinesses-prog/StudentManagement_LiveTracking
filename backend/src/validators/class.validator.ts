import { z } from "zod";

export const createClassSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    section: z.string().min(1),
    academic_year_id: z.string().uuid(),
    branch_id: z.string().uuid().optional(),
    class_teacher_id: z.string().uuid().optional(),
    capacity: z.coerce.number().int().positive().optional(),
    status: z.enum(["active", "inactive"]).optional(),
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
    capacity: z.coerce.number().int().positive().nullable().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const getClassSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const getClassStudentsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().min(1).max(20),
    description: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).max(20).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["active", "inactive"]).optional(),
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
