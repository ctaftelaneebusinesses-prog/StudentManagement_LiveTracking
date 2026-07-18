import { z } from "zod";

export const createStudentSchema = z.object({
  body: z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: z.string().optional(),
    admission_no: z.string().min(1),
    roll_no: z.string().optional(),
    date_of_birth: z.string().date().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    address: z.string().optional(),
    class_id: z.string().uuid().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateStudentSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: z.string().optional(),
    roll_no: z.string().optional(),
    date_of_birth: z.string().date().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    address: z.string().optional(),
    is_active: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const assignClassSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listStudentsQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    classId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});
