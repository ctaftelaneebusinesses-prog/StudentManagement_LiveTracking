import { z } from "zod";

export const listExamsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ classId: z.string().uuid().optional() }),
  params: z.object({}).optional(),
});

export const createExamSchema = z.object({
  body: z.object({
    class_id: z.string().uuid(),
    academic_year_id: z.string().uuid().optional(),
    name: z.string().min(1),
    exam_date: z.string().date().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const upsertMarksSchema = z.object({
  body: z.object({
    records: z
      .array(
        z.object({
          student_id: z.string().uuid(),
          subject_id: z.string().uuid(),
          marks_obtained: z.coerce.number().min(0),
          max_marks: z.coerce.number().positive().optional(),
          grade: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const examIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const studentIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().uuid() }),
});
