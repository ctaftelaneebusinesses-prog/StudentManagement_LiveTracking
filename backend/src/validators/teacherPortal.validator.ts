import { z } from "zod";

export const classIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ classId: z.string().uuid() }),
});

export const listMyStudentsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    classId: z.string().uuid(),
    subjectId: z.string().uuid().optional(),
  }),
  params: z.object({}).optional(),
});

export const studentIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ studentId: z.string().uuid() }),
});

export const createAssessmentSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
    subject_id: z.string().uuid(),
    name: z.string().min(1),
    exam_date: z.string().date(),
    max_marks: z.coerce.number().positive().optional(),
    instructions: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const enhanceHomeworkSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    due_date: z.string().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateProfileSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).optional(),
    phone: z.string().min(5).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const applyForLeaveSchema = z.object({
  body: z
    .object({
      leave_type: z.enum(["casual", "sick", "other"]),
      start_date: z.string().date(),
      end_date: z.string().date(),
      reason: z.string().optional(),
    })
    .refine((v) => v.end_date >= v.start_date, {
      message: "end_date must be on or after start_date",
      path: ["end_date"],
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
