import { z } from "zod";

export const createTeacherSchema = z.object({
  body: z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: z.string().optional(),
    employee_id: z.string().min(1),
    qualification: z.string().optional(),
    joining_date: z.string().date().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateTeacherSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: z.string().optional(),
    qualification: z.string().optional(),
    is_active: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const assignTeacherToClassSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
    subject_id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const setHomeroomTeacherSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
