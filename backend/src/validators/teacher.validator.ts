import { z } from "zod";
import { optionalPassword, optionalPhone, optionalDate } from "./common";

export const createTeacherSchema = z.object({
  body: z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: optionalPhone,
    password: optionalPassword,
    employee_id: z.string().min(1),
    qualification: z.string().optional(),
    joining_date: optionalDate,
    experience_years: z.coerce.number().int().min(0).max(80).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateTeacherSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: optionalPhone,
    qualification: z.string().optional(),
    experience_years: z.coerce.number().int().min(0).max(80).nullable().optional(),
    is_active: z.boolean().optional(),
    avatar_url: z.string().url().optional().nullable(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listTeachersQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    qualification: z.string().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    classId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  }),
  params: z.object({}).optional(),
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
    force: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const clearHomeroomTeacherSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const bulkAssignSubjectsSchema = z.object({
  body: z.object({
    assignments: z
      .array(
        z.object({
          class_id: z.string().uuid(),
          subject_id: z.string().uuid(),
        })
      )
      .min(1, "At least one subject assignment is required")
      .refine(
        (assignments) => {
          const keys = assignments.map((a) => `${a.class_id}:${a.subject_id}`);
          return new Set(keys).size === keys.length;
        },
        { message: "Duplicate class/subject assignment in the same request" }
      ),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
